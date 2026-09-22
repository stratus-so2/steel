/**
 * Código de exibição do chamado: `<prefixo>-<número com 6 dígitos>`
 * (ex.: `INC-000123`). O prefixo vem de `SdSettings.ticketPrefixes`, por
 * tipo; o número é o sequencial do workspace (`SdTicket.number`).
 */

export type SdTicketTypeKey =
  | 'INCIDENT'
  | 'SERVICE_REQUEST'
  | 'CHANGE'
  | 'PROBLEM'

export type SdTicketPrefixes = Record<SdTicketTypeKey, string>

export const DEFAULT_SD_TICKET_PREFIXES: SdTicketPrefixes = {
  INCIDENT: 'INC',
  SERVICE_REQUEST: 'REQ',
  CHANGE: 'CHG',
  PROBLEM: 'PRB',
}

const TYPES = Object.keys(DEFAULT_SD_TICKET_PREFIXES) as SdTicketTypeKey[]
const PREFIX = /^[A-Za-z][A-Za-z0-9]{0,9}$/
const NUMBER_DIGITS = 6

/**
 * Normaliza o JSON salvo em `SdSettings.ticketPrefixes`: prefixos ausentes
 * ou inválidos (1–10 caracteres alfanuméricos começando por letra) caem no
 * padrão. Sempre em maiúsculas.
 */
export function resolveSdTicketPrefixes(raw: unknown): SdTicketPrefixes {
  const source =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const result = { ...DEFAULT_SD_TICKET_PREFIXES }
  for (const type of TYPES) {
    const value = source[type]
    if (typeof value === 'string' && PREFIX.test(value.trim())) {
      result[type] = value.trim().toUpperCase()
    }
  }
  return result
}

/** `INC-000123`. Números maiores que 6 dígitos não são truncados. */
export function formatSdTicketCode(
  type: SdTicketTypeKey,
  number: number,
  prefixes: SdTicketPrefixes = DEFAULT_SD_TICKET_PREFIXES,
): string {
  return `${prefixes[type]}-${String(number).padStart(NUMBER_DIGITS, '0')}`
}

export interface ParsedSdTicketCode {
  /** `null` quando só o número foi informado (`123`, `#123`). */
  type: SdTicketTypeKey | null
  number: number
}

/**
 * Lê `INC-000123`, `inc-123`, `INC123`, `#123` ou `123`. Prefixo
 * desconhecido → `null`.
 */
export function parseSdTicketCode(
  input: string,
  prefixes: SdTicketPrefixes = DEFAULT_SD_TICKET_PREFIXES,
): ParsedSdTicketCode | null {
  const value = input.trim()
  const plain = /^#?(\d{1,9})$/.exec(value)
  if (plain) {
    const number = Number(plain[1])
    return number > 0 ? { type: null, number } : null
  }
  const coded = /^([A-Za-z][A-Za-z0-9]*?)-?(\d{1,9})$/.exec(value)
  if (!coded) return null
  const prefix = coded[1].toUpperCase()
  const type = TYPES.find((t) => prefixes[t] === prefix)
  const number = Number(coded[2])
  if (!type || number <= 0) return null
  return { type, number }
}
