/**
 * Prompt prefix for "Perguntar ao Steel AI" on a record screen. Pure (no
 * React) so the builder is unit-testable and every screen phrases the
 * reference the same way.
 */

export type AskSteelAiRecordKind =
  | 'ticket'
  | 'lead'
  | 'opportunity'
  | 'person'
  | 'company'
  | 'conversation'

export interface AskSteelAiReference {
  kind: AskSteelAiRecordKind
  /** Human code of the record (e.g. `INC-000123`), when it has one. */
  code?: string | null
  /** Title or name of the record. */
  label: string
}

/** Cap on the record label inside the prompt. */
export const ASK_STEEL_AI_LABEL_MAX = 120

/** Question used when the user submits only the reference. */
export const ASK_STEEL_AI_DEFAULT_QUESTION =
  'faça um resumo do contexto e sugira os próximos passos.'

const NOUN: Record<AskSteelAiRecordKind, string> = {
  ticket: 'o chamado',
  lead: 'o lead',
  opportunity: 'a oportunidade',
  person: 'a pessoa',
  company: 'a empresa',
  conversation: 'a conversa com',
}

/** Collapses whitespace and caps the label with an ellipsis. */
export function cleanAskSteelAiLabel(label: string): string {
  const clean = label.replace(/\s+/g, ' ').trim()
  if (clean.length <= ASK_STEEL_AI_LABEL_MAX) return clean
  return `${clean.slice(0, ASK_STEEL_AI_LABEL_MAX - 1).trimEnd()}…`
}

/** `Sobre o chamado INC-000123 — Impressora parada: ` */
export function buildAskSteelAiPrompt(ref: AskSteelAiReference): string {
  const label = cleanAskSteelAiLabel(ref.label)
  const code = ref.code?.trim()
  const subject =
    code && label ? `${code} — ${label}` : code || label || 'este registro'
  return `Sobre ${NOUN[ref.kind]} ${subject}: `
}

/**
 * Final prompt sent to the chat: the typed text, or the prefix plus the
 * default question when nothing was typed after the reference.
 */
export function finalizeAskSteelAiPrompt(
  prefix: string,
  typed: string,
): string {
  const text = typed.trim()
  if (!text) return `${prefix.trim()} ${ASK_STEEL_AI_DEFAULT_QUESTION}`
  if (text === prefix.trim()) {
    return `${text} ${ASK_STEEL_AI_DEFAULT_QUESTION}`
  }
  return text
}
