import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  type WorkspaceFeatureSnapshot,
  WorkspaceFeaturesCache,
} from '@/src/cache/workspace-features.cache'
import type { FeatureKey } from '@/src/config/features'
import { featureNotEnabled } from '@/src/errors'
import { resolveFeatureMap } from '@/src/lib/feature-flags'
import { err, ok, type Result } from '@/src/lib/result'
import { toWorkspaceFeatureDTOs } from '@/src/mappers/feature-flag.mapper'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WorkspaceFeatureOverrideRepository } from '@/src/repositories/workspace-feature-override.repository'
import type { SetFeatureOverrideInput } from '@/src/schemas/feature-flag.schema'
import type {
  WorkspaceFeatureDTO,
  WorkspaceFeatureMapDTO,
} from '@/types/feature-flag'
import { assertMember, assertPlatformAdmin } from './authz'

/** Plano + overrides do workspace, via Redis (read-through). */
async function loadSnapshot(
  workspaceId: string,
): Promise<Result<WorkspaceFeatureSnapshot>> {
  const cached = await WorkspaceFeaturesCache.get(workspaceId)
  if (cached) return ok(cached)

  const [workspace, overrides] = await Promise.all([
    WorkspaceRepository.findById(workspaceId),
    WorkspaceFeatureOverrideRepository.listByWorkspace(workspaceId),
  ])
  if (!workspace.ok) return workspace
  if (!overrides.ok) return overrides

  const snapshot: WorkspaceFeatureSnapshot = {
    plan: workspace.value.activePlan,
    overrides: overrides.value.map((o) => ({
      key: o.key,
      enabled: o.enabled,
      expiresAt: o.expiresAt?.toISOString() ?? null,
    })),
  }
  await WorkspaceFeaturesCache.set(workspaceId, snapshot)
  return ok(snapshot)
}

async function getFeatureMap(
  workspaceId: string,
): Promise<Result<WorkspaceFeatureMapDTO>> {
  const snapshot = await loadSnapshot(workspaceId)
  if (!snapshot.ok) return snapshot
  return ok(resolveFeatureMap(snapshot.value.plan, snapshot.value.overrides))
}

async function hasFeature(
  workspaceId: string,
  key: FeatureKey,
): Promise<Result<boolean>> {
  const map = await getFeatureMap(workspaceId)
  if (!map.ok) return map
  return ok(map.value[key])
}

/**
 * Gate de service: `FEATURE_NOT_ENABLED` quando a feature está desligada para
 * o workspace. Chame depois de `assertMember` (a checagem de associação vem
 * primeiro, para não vazar a configuração de workspaces alheios).
 */
export async function assertFeature(
  workspaceId: string,
  key: FeatureKey,
): Promise<Result<true>> {
  const enabled = await hasFeature(workspaceId, key)
  if (!enabled.ok) return enabled
  if (!enabled.value) {
    logger.info('feature_flag.blocked', { workspaceId, key })
    return err(featureNotEnabled())
  }
  return ok(true)
}

async function listFresh(
  workspaceId: string,
): Promise<Result<WorkspaceFeatureDTO[]>> {
  const [workspace, overrides] = await Promise.all([
    WorkspaceRepository.findById(workspaceId),
    WorkspaceFeatureOverrideRepository.listByWorkspace(workspaceId),
  ])
  if (!workspace.ok) return workspace
  if (!overrides.ok) return overrides
  return ok(toWorkspaceFeatureDTOs(workspace.value.activePlan, overrides.value))
}

export const FeatureFlagService = {
  hasFeature,
  getFeatureMap,

  /** Mapa efetivo para a UI do workspace (esconder o que está desligado). */
  async getForMember(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceFeatureMapDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership
    return getFeatureMap(workspaceId)
  },

  /** Painel admin: catálogo + default do plano + override, direto do banco. */
  async listForAdmin(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceFeatureDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin
    return listFresh(workspaceId)
  },

  async setOverride(
    actorId: string,
    workspaceId: string,
    input: SetFeatureOverrideInput,
  ): Promise<Result<WorkspaceFeatureDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const workspace = await WorkspaceRepository.findById(workspaceId)
    if (!workspace.ok) return workspace

    const action = input.enabled === null ? 'delete' : 'update'
    const write =
      input.enabled === null
        ? await WorkspaceFeatureOverrideRepository.remove(
            workspaceId,
            input.key,
          )
        : await WorkspaceFeatureOverrideRepository.upsert({
            workspaceId,
            key: input.key,
            enabled: input.enabled,
            note: input.note,
            expiresAt: input.expiresAt,
            updatedById: actorId,
          })

    const meta = {
      key: input.key,
      enabled: input.enabled,
      expiresAt: input.expiresAt?.toISOString() ?? null,
    }

    if (!write.ok) {
      auditMutation({
        entity: 'workspace_feature_override',
        action,
        actorId,
        targetId: workspaceId,
        outcome: 'failure',
        reason: write.error.code,
        meta,
      })
      return write
    }

    await WorkspaceFeaturesCache.invalidate(workspaceId)
    auditMutation({
      entity: 'workspace_feature_override',
      action,
      actorId,
      targetId: workspaceId,
      meta,
    })

    return listFresh(workspaceId)
  },
}
