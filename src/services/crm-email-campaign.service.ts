import { auditMutation } from '@/lib/axiom/audit'
import { crmEmailCampaignAlreadySent } from '@/src/errors'
import { sendEmail } from '@/src/lib/mail/send'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmEmailCampaignDTO,
  toCrmEmailCampaignRecipientDTO,
} from '@/src/mappers/crm-email-marketing.mapper'
import {
  CrmEmailCampaignRecipientRepository,
  CrmEmailCampaignRepository,
} from '@/src/repositories/crm-email-campaign.repository'
import { CrmMailingListMemberRepository } from '@/src/repositories/crm-mailing-list.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import type {
  CreateCrmEmailCampaignDTO,
  UpdateCrmEmailCampaignDTO,
} from '@/src/schemas/crm-email-campaign.schema'
import type {
  CrmEmailCampaignDTO,
  CrmEmailCampaignRecipientDTO,
} from '@/types/crm-email-marketing'
import { assertMember } from './authz'

export const CrmEmailCampaignService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailCampaignDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmEmailCampaignRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmEmailCampaignDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    campaignId: string,
  ): Promise<Result<CrmEmailCampaignDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmEmailCampaignRepository.findById(
      campaignId,
      workspaceId,
    )
    if (!result.ok) return result

    return ok(toCrmEmailCampaignDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmEmailCampaignDTO,
  ): Promise<Result<CrmEmailCampaignDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmEmailCampaignRepository.create({
      workspaceId,
      createdById: actorId,
      subject: dto.subject,
      contentHtml: dto.contentHtml,
      contentJson: dto.contentJson,
      fromAddress: dto.fromAddress,
      recipientScope: dto.recipientScope,
      scheduledAt: dto.scheduledAt,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_email_campaign',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    const recipients = await resolveRecipients(
      workspaceId,
      dto.recipientScope,
      dto.mailingListId,
      dto.personIds,
    )
    if (!recipients.ok) return recipients

    if (recipients.value.length > 0) {
      const created = await CrmEmailCampaignRecipientRepository.createMany(
        result.value.id,
        recipients.value,
      )
      if (!created.ok) return created
    }

    auditMutation({
      entity: 'crm_email_campaign',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { recipientCount: recipients.value.length },
    })

    return ok(toCrmEmailCampaignDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    campaignId: string,
    dto: UpdateCrmEmailCampaignDTO,
  ): Promise<Result<CrmEmailCampaignDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmEmailCampaignRepository.findById(
      campaignId,
      workspaceId,
    )
    if (!existing.ok) return existing
    if (
      existing.value.status !== 'DRAFT' &&
      existing.value.status !== 'SCHEDULED'
    ) {
      return err(crmEmailCampaignAlreadySent())
    }

    const result = await CrmEmailCampaignRepository.update(campaignId, {
      subject: dto.subject,
      contentHtml: dto.contentHtml,
      contentJson: dto.contentJson,
      fromAddress: dto.fromAddress,
      scheduledAt: dto.scheduledAt,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_email_campaign',
      action: 'update',
      actorId,
      targetId: campaignId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmEmailCampaignDTO(result.value))
  },

  async listRecipients(
    actorId: string,
    workspaceId: string,
    campaignId: string,
  ): Promise<Result<CrmEmailCampaignRecipientDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const campaign = await CrmEmailCampaignRepository.findById(
      campaignId,
      workspaceId,
    )
    if (!campaign.ok) return campaign

    const result =
      await CrmEmailCampaignRecipientRepository.listByCampaign(campaignId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmEmailCampaignRecipientDTO))
  },

  async send(
    actorId: string,
    workspaceId: string,
    campaignId: string,
  ): Promise<Result<CrmEmailCampaignDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const campaign = await CrmEmailCampaignRepository.findById(
      campaignId,
      workspaceId,
    )
    if (!campaign.ok) return campaign
    if (
      campaign.value.status !== 'DRAFT' &&
      campaign.value.status !== 'SCHEDULED'
    ) {
      return err(crmEmailCampaignAlreadySent())
    }

    await CrmEmailCampaignRepository.setStatus(campaignId, 'SENDING')

    const recipients =
      await CrmEmailCampaignRecipientRepository.listByCampaign(campaignId)
    if (!recipients.ok) return recipients

    let failures = 0
    for (const recipient of recipients.value) {
      try {
        const response = await sendEmail({
          from: campaign.value.fromAddress,
          to: recipient.email,
          subject: campaign.value.subject,
          html: campaign.value.contentHtml,
        })
        await CrmEmailCampaignRecipientRepository.markSent(
          recipient.id,
          response.id,
        )
      } catch (error) {
        failures += 1
        await CrmEmailCampaignRecipientRepository.markFailed(
          recipient.id,
          error instanceof Error ? error.message : 'Falha ao enviar',
        )
      }
    }

    const result = await CrmEmailCampaignRepository.setStatus(
      campaignId,
      failures === recipients.value.length && recipients.value.length > 0
        ? 'FAILED'
        : 'SENT',
      new Date(),
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_email_campaign',
      action: 'update',
      actorId,
      targetId: campaignId,
      meta: { sent: recipients.value.length - failures, failed: failures },
    })

    return ok(toCrmEmailCampaignDTO(result.value))
  },
}

async function resolveRecipients(
  workspaceId: string,
  scope: 'ALL' | 'SELECTED',
  mailingListId: string | undefined,
  personIds: string[] | undefined,
): Promise<Result<{ email: string; name?: string; personId?: string }[]>> {
  if (scope === 'ALL' || (!mailingListId && !personIds)) {
    const people = await CrmPersonRepository.listByWorkspace(workspaceId)
    if (!people.ok) return people
    return ok(
      people.value
        .filter((person) => person.emails.length > 0)
        .map((person) => ({
          email: person.emails[0],
          name: person.name,
          personId: person.id,
        })),
    )
  }

  if (mailingListId) {
    const members =
      await CrmMailingListMemberRepository.listByList(mailingListId)
    if (!members.ok) return members
    return ok(
      members.value.map((member) => ({
        email: member.email,
        name: member.name ?? undefined,
        personId: member.personId ?? undefined,
      })),
    )
  }

  const people = await Promise.all(
    (personIds ?? []).map((id) =>
      CrmPersonRepository.findById(id, workspaceId),
    ),
  )
  const resolved: { email: string; name?: string; personId?: string }[] = []
  for (const result of people) {
    if (result.ok && result.value.emails.length > 0) {
      resolved.push({
        email: result.value.emails[0],
        name: result.value.name,
        personId: result.value.id,
      })
    }
  }
  return ok(resolved)
}
