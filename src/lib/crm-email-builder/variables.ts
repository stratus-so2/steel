import type { EmailBuilderContact } from '@/src/schemas/crm-email-builder.schema'

/**
 * Personalization variables of the e-mail builder. Templates keep them as
 * `{{key}}` (optionally `{{key|fallback}}`) through rendering; each recipient
 * only gets a string substitution over the already-rendered HTML/text.
 */

export type EmailVariableKey =
  | 'nome'
  | 'primeiro_nome'
  | 'email'
  | 'empresa'
  | 'cargo'
  | 'telefone'
  | 'cidade'
  | 'campaign_link'
  | 'unsubscribe_url'

export type EmailVariable = {
  key: EmailVariableKey
  label: string
  /** Shown in the picker; system variables (unsubscribe) are hidden. */
  pickable: boolean
  /** `true` for variables that hold a URL (offered in link fields). */
  link: boolean
}

export const EMAIL_VARIABLES: readonly EmailVariable[] = [
  { key: 'nome', label: 'Nome completo', pickable: true, link: false },
  { key: 'primeiro_nome', label: 'Primeiro nome', pickable: true, link: false },
  { key: 'email', label: 'E-mail', pickable: true, link: false },
  { key: 'empresa', label: 'Empresa', pickable: true, link: false },
  { key: 'cargo', label: 'Cargo', pickable: true, link: false },
  { key: 'telefone', label: 'Telefone', pickable: true, link: false },
  { key: 'cidade', label: 'Cidade', pickable: true, link: false },
  {
    key: 'campaign_link',
    label: 'Link da campanha',
    pickable: true,
    link: true,
  },
  {
    key: 'unsubscribe_url',
    label: 'Link de descadastro',
    pickable: false,
    link: true,
  },
]

export const CAMPAIGN_LINK = '{{campaign_link}}'
export const UNSUBSCRIBE_URL = '{{unsubscribe_url}}'

/** Sample contact used by the editor preview when none is picked. */
export const SAMPLE_CONTACT: EmailBuilderContact = {
  name: 'Maria Silva',
  email: 'maria.silva@exemplo.com.br',
  company: 'Acme Ltda.',
  jobTitle: 'Gerente de compras',
  phone: '(11) 98765-4321',
  city: 'São Paulo',
}

export type EmailVariableValues = Partial<Record<EmailVariableKey, string>>

export function contactToVariables(
  contact: EmailBuilderContact,
  extra: { campaignLink?: string; unsubscribeUrl?: string } = {},
): EmailVariableValues {
  const name = contact.name?.trim() ?? ''
  return {
    nome: name,
    primeiro_nome: name.split(/\s+/)[0] ?? '',
    email: contact.email,
    empresa: contact.company ?? '',
    cargo: contact.jobTitle ?? '',
    telefone: contact.phone ?? '',
    cidade: contact.city ?? '',
    campaign_link: extra.campaignLink ?? '',
    unsubscribe_url: extra.unsubscribeUrl ?? '',
  }
}

const VARIABLE = /\{\{\s*([a-z_]+)\s*(?:\|([^}]*))?\}\}/g

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** Undo the entity encoding React applies to text/attributes, only inside a
 * variable token (`{{a|b &amp; c}}` → fallback "b & c"). */
function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

/** Lists the variable keys used in a string (deduped, in order). */
export function extractVariables(source: string): string[] {
  const keys = new Set<string>()
  for (const match of source.matchAll(VARIABLE)) keys.add(match[1])
  return [...keys]
}

/**
 * Replaces `{{key}}`/`{{key|fallback}}` with the contact values. `html`
 * escapes values (safe in text and attribute context); `text` keeps them raw.
 * Unknown keys and empty values fall back to the default (or nothing).
 */
export function applyVariables(
  source: string,
  values: EmailVariableValues,
  mode: 'html' | 'text',
): string {
  const replaced = source.replace(VARIABLE, (_match, key: string, fallback) => {
    const raw = values[key as EmailVariableKey]?.trim()
    const value = raw || decodeEntities(fallback ?? '').trim()
    return mode === 'html' ? escapeHtml(value) : value
  })
  return mode === 'html'
    ? fixHrefQuerySeparators(replaced)
    : fixTextQuerySeparators(replaced)
}

function fixQuery(url: string): string {
  const hash = url.indexOf('#')
  const head = hash === -1 ? url : url.slice(0, hash)
  const tail = hash === -1 ? '' : url.slice(hash)
  const first = head.indexOf('?')
  if (first === -1) return url
  return `${head.slice(0, first + 1)}${head.slice(first + 1).replace(/\?/g, '&')}${tail}`
}

/** Same as `fixHrefQuerySeparators`, for bare URLs in plain text. */
export function fixTextQuerySeparators(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/g, fixQuery)
}

/**
 * A link like `{{campaign_link}}?nota=3` ends up with two `?` once the
 * campaign link (which carries UTMs) is substituted; keep the first and turn
 * the rest into `&` so the query string stays valid.
 */
export function fixHrefQuerySeparators(html: string): string {
  return html.replace(
    /href="([^"]*)"/g,
    (_match, url: string) => `href="${fixQuery(url)}"`,
  )
}
