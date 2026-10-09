import type {
  CrmCampaign,
  CrmCampaignChannel,
  CrmCampaignConversionKind,
} from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { BETTER_AUTH_URL } from '@/lib/env/server'
import { crmCampaignLinkInvalid } from '@/src/errors'
import {
  buildDestinationUrl,
  withCampaignParams,
} from '@/src/lib/crm-campaign/campaign-url'
import { verifyCampaignLinkToken } from '@/src/lib/crm-campaign/tokens'
import { err, ok, type Result } from '@/src/lib/result'
import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import {
  CrmCampaignConversionRepository,
  CrmCampaignRecipientRepository,
  CrmCampaignRepository,
} from '@/src/repositories/crm-campaign.repository'
import { CrmCampaignLookupRepository } from '@/src/repositories/crm-campaign-lookup.repository'
import type {
  CrmCampaignRefDTO,
  ResendWebhookEvent,
} from '@/src/schemas/crm-campaign.schema'

/**
 * Funnel tracking of multichannel campaigns (ADR 0025): e-mail open pixel
 * and click redirect, Resend delivery events, WhatsApp status/replies from
 * the Comunicação webhooks, and conversions on the destination. Every
 * public entry point is best-effort — tracking never breaks the visitor's
 * page, the webhook or the form submission that triggered it.
 */

/** A reply counts for campaign messages sent in the last 30 days. */
const REPLY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000

function conversionKindOf(campaign: CrmCampaign): CrmCampaignConversionKind {
  return campaign.destinationType === 'FORM'
    ? 'FORM_SUBMISSION'
    : 'LANDING_VIEW'
}

function sourceChannel(value: string | undefined): CrmCampaignChannel | null {
  if (value === 'email') return 'EMAIL'
  if (value === 'whatsapp') return 'WHATSAPP'
  return null
}

export const CrmCampaignTrackingService = {
  /** Open pixel: first open of an e-mail recipient. */
  async recordOpen(token: string, now: Date): Promise<Result<boolean>> {
    const verified = verifyCampaignLinkToken(token)
    if (verified?.channel !== 'EMAIL') return ok(false)
    return CrmCampaignRecipientRepository.markFirst(
      { id: verified.recipientId },
      'emailOpenedAt',
      now,
    )
  },

  /**
   * Click on a campaign link: marks the click (and the open, for e-mail)
   * and returns the destination URL with the UTM parameters + the token.
   */
  async resolveClick(token: string, now: Date): Promise<Result<string>> {
    const verified = verifyCampaignLinkToken(token)
    if (!verified) return err(crmCampaignLinkInvalid())

    const recipient = await CrmCampaignRecipientRepository.findWithCampaign(
      verified.recipientId,
    )
    if (!recipient.ok) return recipient
    if (!recipient.value || recipient.value.campaign.deletedAt) {
      return err(crmCampaignLinkInvalid())
    }
    const { campaign } = recipient.value

    const destination =
      campaign.destinationType === 'FORM' && campaign.formId
        ? await CrmCampaignLookupRepository.findForm(
            campaign.workspaceId,
            campaign.formId,
          )
        : campaign.landingPageId
          ? await CrmCampaignLookupRepository.findLandingPage(
              campaign.workspaceId,
              campaign.landingPageId,
            )
          : ok(null)
    if (!destination.ok) return destination
    if (!destination.value || !campaign.destinationType) {
      return err(crmCampaignLinkInvalid())
    }

    const where = { id: verified.recipientId }
    if (verified.channel === 'EMAIL') {
      await CrmCampaignRecipientRepository.markFirst(
        where,
        'emailClickedAt',
        now,
      )
      await CrmCampaignRecipientRepository.markFirst(
        where,
        'emailOpenedAt',
        now,
      )
    } else {
      await CrmCampaignRecipientRepository.markFirst(
        where,
        'whatsappClickedAt',
        now,
      )
    }

    return ok(
      withCampaignParams(
        buildDestinationUrl(BETTER_AUTH_URL, {
          type: campaign.destinationType,
          token: destination.value.token,
        }),
        {
          source: verified.channel === 'EMAIL' ? 'email' : 'whatsapp',
          medium: campaign.utmMedium,
          campaign: campaign.slug,
          ref: token,
        },
      ),
    )
  },

  /**
   * A visit (landing page) or submission (form) arriving with campaign
   * parameters. Attributed to the recipient when the signed token matches,
   * otherwise to the campaign by its `utm_campaign` slug. The destination
   * must be the campaign's. Returns whether a conversion was recorded.
   */
  async attribute(
    input: {
      workspaceId: string
      kind: CrmCampaignConversionKind
      sourceRef: string
      ref: CrmCampaignRefDTO
      landingPageId?: string
      formId?: string
      leadId?: string | null
      personId?: string | null
    },
    now: Date,
  ): Promise<Result<boolean>> {
    let campaign: CrmCampaign | null = null
    let recipientId: string | null = null
    let channel = sourceChannel(input.ref.utmSource)

    const verified = input.ref.ref
      ? verifyCampaignLinkToken(input.ref.ref)
      : null
    if (verified) {
      const recipient = await CrmCampaignRecipientRepository.findWithCampaign(
        verified.recipientId,
      )
      if (!recipient.ok) return recipient
      if (recipient.value) {
        campaign = recipient.value.campaign
        recipientId = recipient.value.id
        channel = verified.channel
      }
    }
    if (!campaign && input.ref.utmCampaign) {
      const bySlug = await CrmCampaignRepository.findBySlug(
        input.workspaceId,
        input.ref.utmCampaign,
      )
      if (!bySlug.ok) return bySlug
      campaign = bySlug.value
    }
    if (!campaign || campaign.workspaceId !== input.workspaceId)
      return ok(false)

    const matches =
      input.kind === 'LANDING_VIEW'
        ? campaign.destinationType === 'LANDING_PAGE' &&
          campaign.landingPageId === input.landingPageId
        : campaign.destinationType === 'FORM' &&
          campaign.formId === input.formId
    if (!matches) return ok(false)

    const recorded = await CrmCampaignConversionRepository.record({
      campaignId: campaign.id,
      recipientId,
      channel,
      kind: input.kind,
      sourceRef: input.sourceRef,
      leadId: input.leadId ?? null,
      personId: input.personId ?? null,
    })
    if (!recorded.ok) return recorded
    if (
      recorded.value &&
      recipientId &&
      input.kind === conversionKindOf(campaign)
    ) {
      await CrmCampaignRecipientRepository.markFirst(
        { id: recipientId },
        'convertedAt',
        now,
      )
    }
    return ok(recorded.value !== null)
  },

  /** Resend webhook: delivery, bounce, complaint, open and click. */
  async onEmailEvent(
    event: ResendWebhookEvent,
    now: Date,
  ): Promise<Result<boolean>> {
    const recipient =
      await CrmCampaignRecipientRepository.findByProviderMessageId(
        'EMAIL',
        event.data.email_id,
      )
    if (!recipient.ok) return recipient
    if (!recipient.value) return ok(false)
    const where = { id: recipient.value.id }
    const R = CrmCampaignRecipientRepository

    switch (event.type) {
      case 'email.delivered':
        return R.markFirst(where, 'emailDeliveredAt', now)
      case 'email.opened':
        return R.markFirst(where, 'emailOpenedAt', now)
      case 'email.clicked':
        await R.markFirst(where, 'emailOpenedAt', now)
        return R.markFirst(where, 'emailClickedAt', now)
      case 'email.bounced':
        return R.markFirst(where, 'emailBouncedAt', now)
      case 'email.complained':
        return R.markFirst(where, 'unsubscribedAt', now)
      default:
        return ok(false)
    }
  },

  /** WhatsApp delivered/read from the provider webhooks. */
  async onWhatsAppStatus(
    providerMessageId: string,
    status: string,
    now: Date,
  ): Promise<Result<boolean>> {
    if (status !== 'DELIVERED' && status !== 'READ') return ok(false)
    const recipient =
      await CrmCampaignRecipientRepository.findByProviderMessageId(
        'WHATSAPP',
        providerMessageId,
      )
    if (!recipient.ok) return recipient
    if (!recipient.value) return ok(false)
    const where = { id: recipient.value.id }
    const delivered = await CrmCampaignRecipientRepository.markFirst(
      where,
      'whatsappDeliveredAt',
      now,
    )
    if (status === 'DELIVERED') return delivered
    return CrmCampaignRecipientRepository.markFirst(
      where,
      'whatsappReadAt',
      now,
    )
  },

  /**
   * An inbound WhatsApp message: if the number got a campaign message
   * recently, marks the reply, links the Comunicação conversation to the
   * recipient and logs it on the CRM person's timeline.
   */
  async onWhatsAppInbound(
    input: { workspaceId: string; waId: string; conversationId: string },
    now: Date,
  ): Promise<Result<boolean>> {
    const awaiting = await CrmCampaignRecipientRepository.listAwaitingReply(
      input.workspaceId,
      input.waId,
      new Date(now.getTime() - REPLY_WINDOW_MS),
    )
    if (!awaiting.ok) return awaiting
    const recipient = awaiting.value[0]
    if (!recipient) return ok(false)

    const marked = await CrmCampaignRecipientRepository.markReplied(
      recipient.id,
      { at: now, conversationId: input.conversationId },
    )
    if (!marked.ok) return marked

    if (recipient.personId) {
      await CrmActivityRepository.record({
        workspaceId: input.workspaceId,
        action: 'CAMPAIGN_REPLIED',
        entity: 'campaign',
        entityId: recipient.campaignId,
        personId: recipient.personId,
        summary: `respondeu pelo WhatsApp à campanha ${recipient.campaign.name}`,
      })
    }
    logger.info('crm.campaign.whatsapp_replied', {
      component: 'CrmCampaignTrackingService',
      campaignId: recipient.campaignId,
      recipientId: recipient.id,
    })
    return ok(true)
  },
}
