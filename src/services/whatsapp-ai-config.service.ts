import { auditMutation } from '@/lib/axiom/audit'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { ok, type Result } from '@/src/lib/result'
import { toWhatsAppAiConfigDTO } from '@/src/mappers/whatsapp-ai-config.mapper'
import { WhatsAppAiConfigRepository } from '@/src/repositories/whatsapp-ai-config.repository'
import type { SaveWhatsAppAiConfigDTO } from '@/src/schemas/whatsapp-ai-config.schema'
import type { WhatsAppAiConfigDTO } from '@/types/whatsapp-ai-config'
import { assertModulePrivileged } from './authz'

const DEFAULT_MODEL = 'gpt-4o-mini'
const DEFAULT_PROMPT =
  'Você é um assistente de atendimento via WhatsApp. Seja educado, objetivo e ajude o cliente da melhor forma possível.'

export const WhatsAppAiConfigService = {
  async get(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppAiConfigDTO | null>> {
    const privileged = await assertModulePrivileged(
      actorId,
      workspaceId,
      'COMMUNICATION',
    )
    if (!privileged.ok) return privileged

    const result = await WhatsAppAiConfigRepository.findByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value ? toWhatsAppAiConfigDTO(result.value) : null)
  },

  async save(
    actorId: string,
    workspaceId: string,
    dto: SaveWhatsAppAiConfigDTO,
  ): Promise<Result<WhatsAppAiConfigDTO>> {
    const privileged = await assertModulePrivileged(
      actorId,
      workspaceId,
      'COMMUNICATION',
    )
    if (!privileged.ok) return privileged

    const existing =
      await WhatsAppAiConfigRepository.findByWorkspace(workspaceId)
    if (!existing.ok) return existing

    // A IA usa as chaves da plataforma e o provedor/modelo definidos em
    // Ajustes > Steel IA; uma chave própria enviada por clientes antigos
    // ainda é guardada (criptografada), mas não é mais obrigatória.
    const encryptedOpenaiApiKey = dto.openaiApiKey
      ? await encryptConnectionSecret(dto.openaiApiKey)
      : (existing.value?.encryptedOpenaiApiKey ?? null)

    const result = await WhatsAppAiConfigRepository.upsert(workspaceId, {
      encryptedOpenaiApiKey,
      model: dto.model ?? existing.value?.model ?? DEFAULT_MODEL,
      systemPrompt:
        dto.systemPrompt ?? existing.value?.systemPrompt ?? DEFAULT_PROMPT,
      active: dto.active ?? existing.value?.active ?? false,
      readMedia: dto.readMedia ?? existing.value?.readMedia ?? false,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'whatsapp_ai_config',
      action: existing.value ? 'update' : 'create',
      actorId,
      targetId: result.value.id,
      meta: { active: result.value.active },
    })

    return ok(toWhatsAppAiConfigDTO(result.value))
  },
}
