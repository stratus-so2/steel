import {
  extractTemplateFillableFields,
  parseMetaTemplateComponents,
  type TemplateFillableFields,
} from '@/src/lib/whatsapp/template-variables'
import type {
  CrmCampaignVariableSource,
  CrmCampaignWhatsAppVariables,
} from '@/src/schemas/crm-campaign.schema'

/**
 * WhatsApp rules of a campaign, per provider (ADR 0025):
 *
 * - **Meta Cloud API**: business-initiated messages outside the 24 h
 *   customer-service window must be an **approved template**. Every
 *   variable of the template (header, body, dynamic URL buttons) must be
 *   mapped to a source; free text and media are not used.
 * - **Z-API**: free text (with `{nome}`, `{primeiro_nome}` and `{link}`)
 *   plus an optional media URL; templates do not exist there. The text must
 *   carry `{link}` — the campaign link is the point of the message.
 */

export type CampaignWhatsAppProvider = 'META' | 'ZAPI'

/** Tokens of the Z-API free text. */
export const ZAPI_TEXT_TOKENS = {
  name: '{nome}',
  firstName: '{primeiro_nome}',
  link: '{link}',
} as const

/** Meta tier 1: 1,000 business-initiated conversations per 24 h. */
export const META_DAILY_CONVERSATION_LIMIT = 1000

export interface CampaignWhatsAppConfig {
  provider: CampaignWhatsAppProvider
  template: { status: string; components: unknown } | null
  variables: CrmCampaignWhatsAppVariables | null
  text: string | null
  mediaUrl: string | null
}

export function templateFields(components: unknown): TemplateFillableFields {
  return extractTemplateFillableFields(
    parseMetaTemplateComponents(Array.isArray(components) ? components : []),
  )
}

function missingMappings(
  count: number,
  map: Record<string, CrmCampaignVariableSource> | undefined,
): number {
  let missing = 0
  for (let i = 1; i <= count; i += 1) {
    if (!map?.[String(i)]) missing += 1
  }
  return missing
}

/** pt-BR problems of the WhatsApp configuration; empty when it can send. */
export function validateCampaignWhatsApp(
  config: CampaignWhatsAppConfig,
): string[] {
  if (config.provider === 'ZAPI') {
    const text = config.text?.trim() ?? ''
    if (!text) return ['Escreva a mensagem do WhatsApp']
    if (!text.includes(ZAPI_TEXT_TOKENS.link)) {
      return ['Inclua {link} na mensagem para levar o contato ao destino']
    }
    return []
  }

  if (!config.template) return ['Escolha um template aprovado pela Meta']
  if (config.template.status !== 'APPROVED') {
    return ['O template escolhido não está aprovado pela Meta']
  }
  const fields = templateFields(config.template.components)
  const variables = config.variables
  const missing =
    missingMappings(fields.header.variableCount, variables?.header) +
    missingMappings(fields.body.variableCount, variables?.body) +
    fields.urlButtonVariables.filter(
      (index) => !variables?.buttons?.[String(index)],
    ).length
  if (missing > 0) {
    return [`Preencha as ${missing} variável(is) do template`]
  }
  return []
}

export interface CampaignMessageContext {
  name: string
  /** Full tracked link of this recipient. */
  link: string
  /** Token part of the link — for URL buttons whose base is fixed. */
  linkCode: string
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

function resolveSource(
  source: CrmCampaignVariableSource | undefined,
  ctx: CampaignMessageContext,
): string {
  switch (source?.source) {
    case 'name':
      return ctx.name.trim() || 'cliente'
    case 'first_name':
      return firstName(ctx.name) || 'cliente'
    case 'link':
      return ctx.link
    case 'link_code':
      return ctx.linkCode
    case 'static':
      return source.value ?? ''
    default:
      return ''
  }
}

function resolveMap(
  count: number,
  map: Record<string, CrmCampaignVariableSource> | undefined,
  ctx: CampaignMessageContext,
): Record<number, string> {
  const values: Record<number, string> = {}
  for (let i = 1; i <= count; i += 1) {
    values[i] = resolveSource(map?.[String(i)], ctx)
  }
  return values
}

/** Values of a Meta template for one recipient. */
export function resolveTemplateValues(
  fields: TemplateFillableFields,
  variables: CrmCampaignWhatsAppVariables | null,
  ctx: CampaignMessageContext,
): {
  header: Record<number, string>
  body: Record<number, string>
  buttons: Record<number, string>
} {
  const buttons: Record<number, string> = {}
  for (const index of fields.urlButtonVariables) {
    buttons[index] = resolveSource(variables?.buttons?.[String(index)], ctx)
  }
  return {
    header: resolveMap(fields.header.variableCount, variables?.header, ctx),
    body: resolveMap(fields.body.variableCount, variables?.body, ctx),
    buttons,
  }
}

/** Z-API free text for one recipient. */
export function renderZapiText(
  text: string,
  ctx: CampaignMessageContext,
): string {
  return text
    .replaceAll(ZAPI_TEXT_TOKENS.firstName, firstName(ctx.name) || 'cliente')
    .replaceAll(ZAPI_TEXT_TOKENS.name, ctx.name.trim() || 'cliente')
    .replaceAll(ZAPI_TEXT_TOKENS.link, ctx.link)
}
