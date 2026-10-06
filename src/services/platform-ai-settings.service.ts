import { auditMutation } from '@/lib/axiom/audit'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { persistAdminAction } from '@/src/lib/admin-audit'
import { DEFAULT_AI_COST_MARGIN } from '@/src/lib/ai/models'
import { ok, type Result } from '@/src/lib/result'
import {
  toCostMargin,
  toPlatformAiSettingsDTO,
} from '@/src/mappers/platform-ai-settings.mapper'
import { PlatformAiSettingsRepository } from '@/src/repositories/platform-ai-settings.repository'
import type { UpdatePlatformAiSettingsDTO } from '@/src/schemas/platform-ai-settings.schema'
import type { PlatformAiSettingsDTO } from '@/types/platform-ai-settings'
import { assertPlatformAdmin } from './authz'

/**
 * How long a process reuses the margin it read. Every AI call needs it, so
 * it is not read from the database each time; after a change, other
 * processes (worker, other app replicas) pick it up within this window.
 */
export const COST_MARGIN_TTL_MS = 60_000

let cachedMargin: { value: number; expiresAt: number } | null = null

/**
 * Platform-wide AI settings (global admin): today only the margin applied
 * over the provider price of every AI call (ADR 0019).
 */
export const PlatformAiSettingsService = {
  /**
   * Margin for pricing a call. Never fails the AI call: on a database
   * error it logs and uses the last known value or the default (1.0).
   */
  async getCostMargin(now: number = Date.now()): Promise<number> {
    if (cachedMargin && cachedMargin.expiresAt > now) return cachedMargin.value
    const row = await PlatformAiSettingsRepository.find()
    if (!row.ok) {
      logger.warn(
        'ai.cost_margin_unavailable',
        logFields({
          component: 'PlatformAiSettingsService',
          message: row.error.message,
        }),
      )
      return cachedMargin?.value ?? DEFAULT_AI_COST_MARGIN
    }
    const value = toCostMargin(row.value)
    cachedMargin = { value, expiresAt: now + COST_MARGIN_TTL_MS }
    return value
  },

  /** Drops the in-process margin (tests, and after an update). */
  clearCache(): void {
    cachedMargin = null
  },

  async get(actorId: string): Promise<Result<PlatformAiSettingsDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin
    const row = await PlatformAiSettingsRepository.find()
    if (!row.ok) return row
    return ok(toPlatformAiSettingsDTO(row.value))
  },

  async update(
    actorId: string,
    input: UpdatePlatformAiSettingsDTO,
  ): Promise<Result<PlatformAiSettingsDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const current = await PlatformAiSettingsRepository.find()
    if (!current.ok) return current
    const previous = toCostMargin(current.value)

    const saved = await PlatformAiSettingsRepository.upsert({
      costMargin: input.costMargin,
      updatedById: actorId,
    })
    const meta = { previousMargin: previous, costMargin: input.costMargin }
    if (!saved.ok) {
      auditMutation({
        entity: 'platform_ai_settings',
        action: 'update',
        actorId,
        outcome: 'failure',
        reason: saved.error.code,
        meta,
      })
      return saved
    }

    PlatformAiSettingsService.clearCache()
    auditMutation({
      entity: 'platform_ai_settings',
      action: 'update',
      actorId,
      meta,
    })
    await persistAdminAction({
      actor: admin.value,
      action: 'ai.cost_margin_update',
      targetType: 'platform',
      targetLabel: 'Steel IA',
      reason: input.reason ?? null,
      meta,
    })
    return ok(toPlatformAiSettingsDTO(saved.value))
  },
}
