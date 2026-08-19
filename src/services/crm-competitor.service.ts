import type { CrmTrackedCompetitor } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import type { SyncablePlatform } from '@/src/lib/social/discovery'
import { fetchOwnMetrics, fetchPublicProfile } from '@/src/lib/social/discovery'
import { toCrmCompetitorDTO } from '@/src/mappers/crm-competitor.mapper'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import type {
  CreateCrmCompetitorDTO,
  CrmCompetitorMetricsRange,
  PreviewCrmCompetitorDTO,
  UpdateCrmCompetitorDTO,
} from '@/src/schemas/crm-competitor.schema'
import type {
  CrmCompetitorDTO,
  CrmCompetitorMetricsDTO,
  CrmCompetitorMetricsSeriesDTO,
  CrmCompetitorPreviewDTO,
} from '@/types/crm-competitor'
import { assertMember } from './authz'
import { getFreshAccessToken } from './crm-social-token'

const RANGE_DAYS: Record<CrmCompetitorMetricsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** Variação absoluta/percentual entre o primeiro e o último snapshot da janela. */
function buildMetricsSeries(
  snapshots: {
    id: string
    followersCount: number
    postsCount: number | null
    capturedAt: Date
  }[],
): CrmCompetitorMetricsSeriesDTO {
  const first = snapshots[0]
  const last = snapshots[snapshots.length - 1]

  return {
    followersCount: last ? last.followersCount : null,
    growth:
      first && last
        ? {
            absolute: last.followersCount - first.followersCount,
            percent:
              first.followersCount > 0
                ? ((last.followersCount - first.followersCount) /
                    first.followersCount) *
                  100
                : null,
          }
        : null,
    snapshots: snapshots.map((s) => ({
      id: s.id,
      followersCount: s.followersCount,
      postsCount: s.postsCount,
      capturedAt: s.capturedAt.toISOString(),
    })),
  }
}

type SyncResult = { processed: number; synced: number; failed: number }

/**
 * Agrupa por workspace+plataforma pra reaproveitar o token e gravar um
 * único snapshot da própria conta conectada por grupo, em vez de um por
 * concorrente. Compartilhado por `syncAll()` (todos os workspaces, job
 * diário) e `syncWorkspace()` (um workspace, disparo manual).
 */
async function syncCompetitorGroups(
  competitors: CrmTrackedCompetitor[],
): Promise<SyncResult> {
  const groups = new Map<string, CrmTrackedCompetitor[]>()
  for (const competitor of competitors) {
    const key = `${competitor.workspaceId}:${competitor.platform}`
    const group = groups.get(key) ?? []
    group.push(competitor)
    groups.set(key, group)
  }

  const now = new Date()
  let synced = 0
  let failed = 0

  for (const group of groups.values()) {
    const { workspaceId, platform } = group[0]
    // Seguro: `listSyncable()` já filtra por plataformas com discovery.
    const syncablePlatform = platform as SyncablePlatform

    const fresh = await getFreshAccessToken(workspaceId, syncablePlatform)
    if (!fresh.ok) {
      for (const competitor of group) {
        await CrmCompetitorRepository.recordSyncResult(competitor.id, {
          syncStatus: 'SYNC_FAILED',
          lastSyncedAt: now,
        })
        failed += 1
      }
      continue
    }

    const ownMetrics = await fetchOwnMetrics(
      syncablePlatform,
      fresh.value.accessToken,
      fresh.value.connection.externalAccountId,
    )
    if (ownMetrics.ok) {
      await CrmSocialConnectionRepository.createMetricSnapshot(
        fresh.value.connection.id,
        {
          followersCount: ownMetrics.value.followersCount,
          postsCount: ownMetrics.value.postsCount,
        },
      )
    } else {
      logger.error('crm_competitor_sync.own_metrics_failed', {
        component: 'CrmCompetitorService',
        workspaceId,
        platform: syncablePlatform,
        reason: ownMetrics.error.code,
      })
    }

    for (const competitor of group) {
      const profile = await fetchPublicProfile(
        syncablePlatform,
        fresh.value.accessToken,
        fresh.value.connection.externalAccountId,
        competitor.handle,
      )
      if (!profile.ok) {
        await CrmCompetitorRepository.recordSyncResult(competitor.id, {
          syncStatus: 'SYNC_FAILED',
          lastSyncedAt: now,
        })
        failed += 1
        continue
      }

      await CrmCompetitorRepository.recordSyncResult(competitor.id, {
        syncStatus: 'SYNCED',
        lastSyncedAt: now,
        followersCount: profile.value.followersCount,
        avatarUrl: profile.value.avatarUrl,
        displayName: profile.value.externalName,
        bio: profile.value.bio,
      })
      await CrmCompetitorRepository.createSnapshot(competitor.id, {
        followersCount: profile.value.followersCount,
        postsCount: profile.value.postsCount,
      })
      synced += 1
    }
  }

  return { processed: competitors.length, synced, failed }
}

export const CrmCompetitorService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmCompetitorDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompetitorRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmCompetitorDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmCompetitorDTO,
  ): Promise<Result<CrmCompetitorDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompetitorRepository.create({
      workspaceId,
      createdById: actorId,
      platform: dto.platform,
      handle: dto.handle,
      profileUrl: dto.profileUrl,
      followersCount: dto.followersCount,
      avatarUrl: dto.avatarUrl,
      displayName: dto.displayName,
      bio: dto.bio,
      notes: dto.notes,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_tracked_competitor',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmCompetitorDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    competitorId: string,
    dto: UpdateCrmCompetitorDTO,
  ): Promise<Result<CrmCompetitorDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmCompetitorRepository.update(competitorId, {
      updatedById: actorId,
      platform: dto.platform,
      handle: dto.handle,
      profileUrl: dto.profileUrl,
      followersCount: dto.followersCount,
      avatarUrl: dto.avatarUrl,
      displayName: dto.displayName,
      bio: dto.bio,
      notes: dto.notes,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'update',
      actorId,
      targetId: competitorId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmCompetitorDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    competitorId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmCompetitorRepository.softDelete(
      competitorId,
      actorId,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'delete',
      actorId,
      targetId: competitorId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmCompetitorRepository.reorder(workspaceId, orderedIds)
  },

  /**
   * Busca dados públicos (nome, avatar, bio, seguidores) para pré-preencher
   * o cadastro — não persiste nada. Exige uma conta CONECTADA da mesma
   * plataforma no workspace: é o token dela que "empresta" acesso para ler
   * dados públicos do concorrente (ver `src/lib/social/discovery`).
   */
  async preview(
    actorId: string,
    workspaceId: string,
    dto: PreviewCrmCompetitorDTO,
  ): Promise<Result<CrmCompetitorPreviewDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const fresh = await getFreshAccessToken(workspaceId, dto.platform)
    if (!fresh.ok) return fresh

    const profile = await fetchPublicProfile(
      dto.platform,
      fresh.value.accessToken,
      fresh.value.connection.externalAccountId,
      dto.handle,
    )
    if (!profile.ok) return profile

    return ok({
      displayName: profile.value.externalName,
      avatarUrl: profile.value.avatarUrl,
      bio: profile.value.bio,
      followersCount: profile.value.followersCount,
      postsCount: profile.value.postsCount,
      profileUrl: profile.value.profileUrl,
    })
  },

  /**
   * Série histórica do concorrente (seguidores/posts) vs. a conta conectada
   * da mesma plataforma no workspace, para a janela pedida.
   */
  async getMetrics(
    actorId: string,
    workspaceId: string,
    competitorId: string,
    range: CrmCompetitorMetricsRange,
  ): Promise<Result<CrmCompetitorMetricsDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const competitor = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!competitor.ok) return competitor

    const since = new Date(Date.now() - RANGE_DAYS[range] * 86_400_000)

    const snapshots = await CrmCompetitorRepository.listSnapshotsSince(
      competitorId,
      since,
    )
    if (!snapshots.ok) return snapshots

    let ownAccount: CrmCompetitorMetricsDTO['ownAccount'] = null
    const connection =
      await CrmSocialConnectionRepository.findPrimaryByPlatform(
        workspaceId,
        competitor.value.platform,
      )
    if (connection.ok && connection.value) {
      const ownSnapshots =
        await CrmSocialConnectionRepository.listMetricSnapshotsSince(
          connection.value.id,
          since,
        )
      if (ownSnapshots.ok) {
        ownAccount = {
          connectionId: connection.value.id,
          accountName: connection.value.accountName,
          ...buildMetricsSeries(ownSnapshots.value),
        }
      }
    }

    return ok({
      range,
      competitor: buildMetricsSeries(snapshots.value),
      ownAccount,
    })
  },

  /**
   * Sincroniza TODOS os concorrentes com sync automático (Instagram/YouTube)
   * de TODOS os workspaces — chamado pelo job diário `CrmCompetitorSync`
   * (contexto de sistema, sem `actorId`/authz de usuário). Agrupa por
   * workspace+plataforma para reaproveitar o token e gravar um único
   * snapshot da própria conta conectada por grupo, em vez de um por
   * concorrente.
   */
  async syncAll(): Promise<SyncResult> {
    const due = await CrmCompetitorRepository.listSyncable()
    if (!due.ok) {
      throw new Error(`Failed to list syncable competitors: ${due.error.code}`)
    }

    return syncCompetitorGroups(due.value)
  },

  /**
   * Mesma sincronização de `syncAll()`, mas escopada a UM workspace — usada
   * pelo botão "sincronizar agora" (`POST .../competitors/sync`) pra não
   * esperar o job diário quando o usuário quer os dados na hora.
   */
  async syncWorkspace(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SyncResult>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const due = await CrmCompetitorRepository.listSyncable(workspaceId)
    if (!due.ok) return due

    return ok(await syncCompetitorGroups(due.value))
  },
}
