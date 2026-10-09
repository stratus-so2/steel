import 'server-only'
import type { Result } from '@/src/lib/result'
import { renderCampaignEmail as renderBuilderEmail } from '@/src/services/crm-email-builder.service'

/**
 * Campaign e-mail rendering seam (ADR 0025). The campaign only depends on
 * `renderCampaignEmail(templateId, contact)`; it delegates to the visual
 * e-mail builder's render API (`crm-email-builder.service`), which handles
 * builder and legacy templates, the `{{campaign_link}}` variable and the
 * LGPD unsubscribe footer.
 */

export interface CampaignEmailContact {
  /** Tenant scope — the template must belong to this workspace. */
  workspaceId: string
  name: string
  email: string
  /** Tracked campaign link of this recipient (CTA target). */
  campaignLink: string
  /**
   * Unsubscribe page of this recipient; omitted on previews and test sends
   * (the builder then links its generic page).
   */
  unsubscribeUrl?: string
}

export interface RenderedCampaignEmail {
  subject: string
  html: string
  text: string
}

export type RenderCampaignEmail = (
  templateId: string,
  contact: CampaignEmailContact,
) => Promise<Result<RenderedCampaignEmail>>

export const renderCampaignEmail: RenderCampaignEmail = (templateId, contact) =>
  renderBuilderEmail(
    templateId,
    { name: contact.name, email: contact.email },
    {
      workspaceId: contact.workspaceId,
      campaignLink: contact.campaignLink,
      unsubscribeUrl: contact.unsubscribeUrl,
    },
  )
