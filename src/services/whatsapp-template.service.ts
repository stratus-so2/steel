import { auditMutation } from '@/lib/axiom/audit'
import { badRequest, whatsappConnectionNotFound } from '@/src/errors'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { err, ok, type Result } from '@/src/lib/result'
import {
  createMetaTemplate,
  fetchMetaTemplates,
} from '@/src/lib/whatsapp/meta-templates'
import type { MetaTemplateComponent } from '@/src/lib/whatsapp/template-variables'
import { toWhatsAppTemplateDTO } from '@/src/mappers/whatsapp-template.mapper'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppTemplateRepository } from '@/src/repositories/whatsapp-template.repository'
import type { CreateWhatsAppTemplateInput } from '@/src/schemas/whatsapp-template.schema'
import type { WhatsAppTemplateDTO } from '@/types/whatsapp-template'
import { assertMember } from './authz'

const STATUS_MAP: Record<string, 'APPROVED' | 'PENDING' | 'REJECTED'> = {
  APPROVED: 'APPROVED',
  PENDING: 'PENDING',
  REJECTED: 'REJECTED',
}

function buildComponents(
  input: CreateWhatsAppTemplateInput,
): MetaTemplateComponent[] {
  const components: MetaTemplateComponent[] = []
  if (input.headerText) {
    components.push({ type: 'HEADER', format: 'TEXT', text: input.headerText })
  }
  components.push({ type: 'BODY', text: input.body })
  if (input.footer) {
    components.push({ type: 'FOOTER', text: input.footer })
  }
  if (input.buttons && input.buttons.length > 0) {
    components.push({ type: 'BUTTONS', buttons: input.buttons })
  }
  return components
}

export const WhatsAppTemplateService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WhatsAppTemplateDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await WhatsAppTemplateRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWhatsAppTemplateDTO))
  },

  async sync(
    actorId: string,
    workspaceId: string,
    connectionId: string,
  ): Promise<Result<WhatsAppTemplateDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const connection = await WhatsAppConnectionRepository.findById(
      connectionId,
      workspaceId,
    )
    if (!connection.ok) return connection
    if (!connection.value) return err(whatsappConnectionNotFound())
    if (
      connection.value.provider !== 'META' ||
      !connection.value.metaWabaId ||
      !connection.value.encryptedMetaAccessToken
    ) {
      return err(
        badRequest(
          'Sincronização de templates está disponível apenas para conexões Meta',
        ),
      )
    }

    const accessToken = await decryptConnectionSecret(
      connection.value.encryptedMetaAccessToken,
    )

    let raw: Awaited<ReturnType<typeof fetchMetaTemplates>>
    try {
      raw = await fetchMetaTemplates({
        wabaId: connection.value.metaWabaId,
        accessToken,
      })
    } catch (error) {
      return err(
        badRequest(
          error instanceof Error
            ? error.message
            : 'Falha ao sincronizar templates',
        ),
      )
    }

    const synced: WhatsAppTemplateDTO[] = []
    for (const item of raw) {
      const result = await WhatsAppTemplateRepository.upsertSynced({
        workspaceId,
        connectionId,
        name: item.name,
        language: item.language,
        category: item.category,
        status: STATUS_MAP[item.status] ?? 'PENDING',
        components: item.components as never,
      })
      if (result.ok) synced.push(toWhatsAppTemplateDTO(result.value))
    }

    auditMutation({
      entity: 'whatsapp_template',
      action: 'sync',
      actorId,
      targetId: connectionId,
      meta: { count: synced.length },
    })

    return ok(synced)
  },

  async create(
    actorId: string,
    workspaceId: string,
    input: CreateWhatsAppTemplateInput,
  ): Promise<Result<WhatsAppTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const connection = await WhatsAppConnectionRepository.findById(
      input.connectionId,
      workspaceId,
    )
    if (!connection.ok) return connection
    if (!connection.value) return err(whatsappConnectionNotFound())
    if (
      connection.value.provider !== 'META' ||
      !connection.value.metaWabaId ||
      !connection.value.encryptedMetaAccessToken
    ) {
      return err(
        badRequest(
          'Criação de templates está disponível apenas para conexões Meta',
        ),
      )
    }

    const accessToken = await decryptConnectionSecret(
      connection.value.encryptedMetaAccessToken,
    )
    const components = buildComponents(input)

    let created: Awaited<ReturnType<typeof createMetaTemplate>>
    try {
      created = await createMetaTemplate({
        wabaId: connection.value.metaWabaId,
        accessToken,
        name: input.name,
        language: input.language,
        category: input.category,
        components: components as unknown[],
      })
    } catch (error) {
      return err(
        badRequest(
          error instanceof Error ? error.message : 'Falha ao criar template',
        ),
      )
    }

    const saved = await WhatsAppTemplateRepository.upsertSynced({
      workspaceId,
      connectionId: input.connectionId,
      name: input.name,
      language: input.language,
      category: input.category,
      status: STATUS_MAP[created.status] ?? 'PENDING',
      components: components as never,
    })
    if (!saved.ok) return saved

    auditMutation({
      entity: 'whatsapp_template',
      action: 'create',
      actorId,
      targetId: saved.value.id,
      meta: { name: input.name, category: input.category },
    })

    return ok(toWhatsAppTemplateDTO(saved.value))
  },
}
