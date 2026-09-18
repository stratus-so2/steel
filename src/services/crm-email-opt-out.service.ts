import type { CrmEmailOptOutSource } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { crmEmailUnsubscribeInvalid } from '@/src/errors'
import { verifyCrmUnsubscribeToken } from '@/src/lib/crm-email-unsubscribe'
import { err, ok, type Result } from '@/src/lib/result'
import { toCrmEmailOptOutDTO } from '@/src/mappers/crm-email-marketing.mapper'
import { CrmEmailCampaignRecipientRepository } from '@/src/repositories/crm-email-campaign.repository'
import { CrmEmailOptOutRepository } from '@/src/repositories/crm-email-opt-out.repository'
import type {
  CrmEmailOptOutDTO,
  CrmEmailUnsubscribeResultDTO,
} from '@/types/crm-email-marketing'
import { assertModuleMember } from './authz'

/** Resolve o token assinado para o destinatário. Qualquer falha vira o
 * mesmo erro genérico — não revela se o destinatário existe. */
async function resolveRecipient(token: string) {
  const verified = verifyCrmUnsubscribeToken(token)
  if (!verified.ok) return err(crmEmailUnsubscribeInvalid())

  const recipient =
    await CrmEmailCampaignRecipientRepository.findByIdWithCampaign(
      verified.value,
    )
  if (!recipient.ok) {
    return recipient.error.code === 'RESOURCE_NOT_FOUND'
      ? err(crmEmailUnsubscribeInvalid())
      : recipient
  }

  // Sem checagem de módulo, de propósito: o direito de descadastro (LGPD)
  // vale para qualquer e-mail já enviado, mesmo que o CRM tenha sido
  // desligado depois. O token assinado já limita o escopo ao destinatário.
  return ok(recipient.value)
}

/**
 * Descadastro LGPD de campanhas de e-mail do CRM. Público (sem sessão): o
 * token HMAC é a autorização. Só afeta campanhas — e-mails transacionais
 * (auth, senha, convites) não consultam o opt-out.
 */
export const CrmEmailOptOutService = {
  /** Dados para a página de confirmação — não grava nada (GET pode ser
   * disparado por scanners de link; o descadastro exige POST). */
  async preview(token: string): Promise<Result<{ email: string }>> {
    const recipient = await resolveRecipient(token)
    if (!recipient.ok) return recipient
    return ok({ email: recipient.value.email.trim().toLowerCase() })
  },

  async unsubscribe(
    token: string,
    source: CrmEmailOptOutSource,
  ): Promise<Result<CrmEmailUnsubscribeResultDTO>> {
    const recipient = await resolveRecipient(token)
    if (!recipient.ok) return recipient

    const { campaign } = recipient.value
    const result = await CrmEmailOptOutRepository.upsert({
      workspaceId: campaign.workspaceId,
      email: recipient.value.email,
      personId: recipient.value.personId,
      campaignId: campaign.id,
      source,
    })
    if (!result.ok) {
      auditMutation({
        entity: 'crm_email_opt_out',
        action: 'opt_out',
        actorId: null,
        outcome: 'failure',
        reason: result.error.code,
        meta: { workspaceId: campaign.workspaceId, campaignId: campaign.id },
      })
      return result
    }

    // Registro LGPD: quando (timestamp do log + createdAt) e como (source,
    // campanha de origem). O e-mail fica só no banco, não no log.
    if (result.value.created) {
      auditMutation({
        entity: 'crm_email_opt_out',
        action: 'opt_out',
        actorId: null,
        targetId: result.value.optOut.id,
        meta: {
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          recipientId: recipient.value.id,
          personId: recipient.value.personId,
          channel: 'email',
          source,
        },
      })
    }

    return ok({
      email: result.value.optOut.email,
      alreadyOptedOut: !result.value.created,
    })
  },

  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailOptOutDTO[]>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM', {
      resource: 'email',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

    const result = await CrmEmailOptOutRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmEmailOptOutDTO))
  },
}
