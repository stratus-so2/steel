import {
  FEATURE_CATALOG,
  FEATURE_KEYS,
  type FeatureKey,
  isFeatureKey,
} from '@/src/config/features'
import type { PlanTier } from '@/src/schemas/plan.schema'

/** Forma mínima de um override — serve ao model Prisma e ao snapshot em cache. */
export interface FeatureOverrideLike {
  key: string
  enabled: boolean
  expiresAt: Date | string | null
}

/** Um override vale até `expiresAt` (exclusivo); sem validade, vale sempre. */
export function isOverrideActive(
  override: Pick<FeatureOverrideLike, 'expiresAt'>,
  now: Date = new Date(),
): boolean {
  if (override.expiresAt === null) return true
  return new Date(override.expiresAt).getTime() > now.getTime()
}

/**
 * Valor efetivo de cada feature do catálogo: override ativo, senão o default
 * do plano. Overrides de chaves fora do catálogo são ignorados.
 */
export function resolveFeatureMap(
  plan: PlanTier,
  overrides: readonly FeatureOverrideLike[],
  now: Date = new Date(),
): Record<FeatureKey, boolean> {
  const active = new Map<FeatureKey, boolean>()
  for (const override of overrides) {
    if (isFeatureKey(override.key) && isOverrideActive(override, now)) {
      active.set(override.key, override.enabled)
    }
  }

  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [
      key,
      active.get(key) ?? FEATURE_CATALOG[key].planDefaults[plan],
    ]),
  ) as Record<FeatureKey, boolean>
}
