import type { WorkspaceFeatureOverride } from '@prisma/client'
import { FEATURE_CATALOG, FEATURE_KEYS } from '@/src/config/features'
import { isOverrideActive, resolveFeatureMap } from '@/src/lib/feature-flags'
import type { PlanTier } from '@/src/schemas/plan.schema'
import type { WorkspaceFeatureDTO } from '@/types/feature-flag'

/** Catálogo + plano + overrides (Prisma) → linhas do painel admin. */
export function toWorkspaceFeatureDTOs(
  plan: PlanTier,
  overrides: readonly WorkspaceFeatureOverride[],
  now: Date = new Date(),
): WorkspaceFeatureDTO[] {
  const effective = resolveFeatureMap(plan, overrides, now)
  const byKey = new Map(overrides.map((o) => [o.key, o]))

  return FEATURE_KEYS.map((key) => {
    const definition = FEATURE_CATALOG[key]
    const override = byKey.get(key)
    return {
      key,
      module: definition.module,
      label: definition.label,
      description: definition.description,
      planDefault: definition.planDefaults[plan],
      override: override
        ? {
            enabled: override.enabled,
            note: override.note,
            expiresAt: override.expiresAt?.toISOString() ?? null,
            expired: !isOverrideActive(override, now),
            updatedById: override.updatedById,
            updatedAt: override.updatedAt.toISOString(),
          }
        : null,
      enabled: effective[key],
    }
  })
}
