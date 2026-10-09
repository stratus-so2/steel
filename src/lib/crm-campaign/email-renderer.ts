import 'server-only'
import { crmEmailTemplateNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from '@/src/repositories/db-error'
import {
  CAMPAIGN_FIRST_NAME_MERGE_TAG,
  CAMPAIGN_LINK_MERGE_TAG,
  CAMPAIGN_LINK_MERGE_TAG_ALIAS,
  CAMPAIGN_NAME_MERGE_TAG,
} from './campaign-url'
import { firstName } from './whatsapp-rules'

/**
 * Campaign e-mail rendering seam (ADR 0025). The campaign only depends on
 * `renderCampaignEmail(templateId, contact)`; today it renders the existing
 * `CrmEmailTemplate`. When the visual e-mail builder lands, point the
 * export below at its renderer — one line, nothing else changes.
 */

export interface CampaignEmailContact {
  name: string
  email: string
  /** Tracked campaign link of this recipient (CTA target). */
  campaignLink: string
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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Plain-text alternative of an HTML e-mail. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<a\s[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Merge tags of the legacy templates: `{{nome}}`, `{{primeiro_nome}}` and
 * `{{link_campanha}}`. Empty CTA targets (`href="#"`, `href=""`) default to
 * the campaign link, so a ready-made layout already leads to the
 * destination.
 */
export function applyCampaignMergeTags(
  html: string,
  contact: CampaignEmailContact,
): string {
  const link = escapeHtml(contact.campaignLink)
  return html
    .replaceAll(CAMPAIGN_LINK_MERGE_TAG, link)
    .replaceAll(CAMPAIGN_LINK_MERGE_TAG_ALIAS, link)
    .replaceAll(
      CAMPAIGN_FIRST_NAME_MERGE_TAG,
      escapeHtml(firstName(contact.name)),
    )
    .replaceAll(CAMPAIGN_NAME_MERGE_TAG, escapeHtml(contact.name))
    .replace(/href=(["'])(#?)\1/gi, `href="${link}"`)
}

export const renderLegacyCampaignEmail: RenderCampaignEmail = async (
  templateId,
  contact,
) => {
  try {
    const template = await prisma.crmEmailTemplate.findFirst({
      where: { id: templateId, deletedAt: null },
    })
    if (!template) return err(crmEmailTemplateNotFound())
    const html = applyCampaignMergeTags(template.contentHtml, contact)
    return ok({
      subject: template.subject,
      html,
      text: htmlToText(html),
    })
  } catch (error) {
    return err(dbError('Failed to render campaign e-mail template', error))
  }
}

export const renderCampaignEmail: RenderCampaignEmail =
  renderLegacyCampaignEmail
