import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toWhatsAppSettingsDTO,
  WHATSAPP_SETTINGS_DEFAULTS,
} from '@/src/mappers/whatsapp-settings.mapper'
import { WhatsAppSettingsRepository } from '@/src/repositories/whatsapp-settings.repository'
import type { UpdateWhatsAppSettingsDTO } from '@/src/schemas/whatsapp-settings.schema'
import type { WhatsAppSettingsDTO } from '@/types/whatsapp-settings'
import { assertModulePrivileged } from './authz'

export const WhatsAppSettingsService = {
  /** Configurações de atendimento (OWNER/ADMIN). Sem linha salva, devolve
   * os padrões. */
  async get(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppSettingsDTO>> {
    const privileged = await assertModulePrivileged(
      actorId,
      workspaceId,
      'COMMUNICATION',
    )
    if (!privileged.ok) return privileged

    const row = await WhatsAppSettingsRepository.findByWorkspace(workspaceId)
    if (!row.ok) return row
    return ok(toWhatsAppSettingsDTO(workspaceId, row.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    dto: UpdateWhatsAppSettingsDTO,
  ): Promise<Result<WhatsAppSettingsDTO>> {
    const privileged = await assertModulePrivileged(
      actorId,
      workspaceId,
      'COMMUNICATION',
    )
    if (!privileged.ok) return privileged

    const existing =
      await WhatsAppSettingsRepository.findByWorkspace(workspaceId)
    if (!existing.ok) return existing
    const current = toWhatsAppSettingsDTO(workspaceId, existing.value)

    const saved = await WhatsAppSettingsRepository.upsert(workspaceId, {
      autoCloseAfterHours:
        dto.autoCloseAfterHours ?? current.autoCloseAfterHours,
    })
    if (!saved.ok) return saved

    auditMutation({
      entity: 'whatsapp_settings',
      action: existing.value ? 'update' : 'create',
      actorId,
      targetId: saved.value.id,
      meta: {
        workspaceId,
        autoCloseAfterHours: saved.value.autoCloseAfterHours,
      },
    })

    return ok(toWhatsAppSettingsDTO(workspaceId, saved.value))
  },

  /**
   * Janelas de fechamento automático, para o job (sistema): workspaces com
   * configuração salva e ligada, mais o padrão para quem nunca salvou.
   */
  async listAutoCloseWindows(): Promise<
    Result<{
      configured: { workspaceId: string; hours: number }[]
      /** Workspaces com linha salva (inclusive os desligados). */
      configuredWorkspaceIds: string[]
      defaultHours: number
    }>
  > {
    const rows = await WhatsAppSettingsRepository.listAll()
    if (!rows.ok) return rows
    return ok({
      configured: rows.value
        .filter((row) => row.autoCloseAfterHours > 0)
        .map((row) => ({
          workspaceId: row.workspaceId,
          hours: row.autoCloseAfterHours,
        })),
      configuredWorkspaceIds: rows.value.map((row) => row.workspaceId),
      defaultHours: WHATSAPP_SETTINGS_DEFAULTS.autoCloseAfterHours,
    })
  },
}
