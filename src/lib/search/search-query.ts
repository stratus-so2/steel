/**
 * Pure helpers that turn what the user typed into the pieces the search
 * query needs. The heavy lifting (unaccent, stemming, trigrams) happens in
 * Postgres; these only shape the input so it can never inject tsquery
 * syntax and so exact codes (`INC-000123`, `#123`, a phone, an e-mail)
 * compare equal to the codes stored on each document.
 */

/** Longest query we accept; longer input is cut (not rejected). */
export const SEARCH_QUERY_MAX = 120
/** Up to this many tokens become the prefix tsquery. */
const MAX_TOKENS = 8

/** Lowercase, accent-free, single-spaced. Mirrors `f_unaccent` + `lower`. */
export function foldSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Canonical form of a record code: `INC-000123`, `inc123` and `inc-123`
 * become `inc-123`; `#123`, `000123` and `123` become `123`. Anything that
 * is not a code comes back folded and trimmed.
 */
export function canonicalCode(value: string): string {
  const folded = foldSearchText(value).replace(/^#/, '')
  const plain = /^0*(\d{1,12})$/.exec(folded)
  if (plain) return String(Number(plain[1]))
  const coded = /^([a-z][a-z0-9]*?)[-\s]?0*(\d{1,12})$/.exec(folded)
  if (coded) return `${coded[1]}-${Number(coded[2])}`
  return folded
}

/**
 * Phone variants stored as codes: the full digits plus the national number
 * without the Brazilian `55` country code, so `11 99999-0000` matches a
 * contact saved as `+55 11 99999-0000` and the other way around.
 */
export function phoneCodes(value: string): string[] {
  const digits = digitsOnly(value)
  if (digits.length < 8) return []
  const out = [digits]
  if (digits.startsWith('55') && digits.length >= 12) out.push(digits.slice(2))
  return out
}

/** Exact-match keys a document exposes for one raw value (code/e-mail/phone). */
export function codesFor(values: ReadonlyArray<string | null | undefined>) {
  const set = new Set<string>()
  for (const raw of values) {
    if (!raw) continue
    const value = raw.trim()
    if (!value) continue
    const phones = phoneCodes(value)
    // A formatted phone only contributes its digit forms.
    if (!phones.length || !/^[\d\s()+.-]+$/.test(value)) {
      set.add(canonicalCode(value))
    }
    for (const phone of phones) set.add(phone)
  }
  return [...set]
}

export interface ParsedSearchQuery {
  /** Folded query, as Postgres sees it after `lower(f_unaccent(...))`. */
  text: string
  /** Exact keys to look up in `codes` (canonical code, digits, e-mail…). */
  codes: string[]
  /** Safe `to_tsquery` expression (`tok1:* & tok2:*`) or `null`. */
  tsquery: string | null
}

/**
 * Splits the query into the exact-key candidates and a prefix tsquery
 * built only from `[a-z0-9]` tokens — the tsquery is AND of prefixes so
 * "impre conf" finds "Impressora não confirma".
 */
export function parseSearchQuery(raw: string): ParsedSearchQuery {
  const text = foldSearchText(raw.slice(0, SEARCH_QUERY_MAX))
  const codes = new Set<string>()
  if (text) {
    codes.add(text)
    codes.add(canonicalCode(text))
    for (const phone of phoneCodes(text)) codes.add(phone)
  }
  const tokens = text
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .slice(0, MAX_TOKENS)
  return {
    text,
    codes: [...codes],
    tsquery: tokens.length ? tokens.map((t) => `${t}:*`).join(' & ') : null,
  }
}

/**
 * Character ranges of `text` that match a query token (accent and case
 * insensitive), merged and sorted — the palette bolds them. Works on the
 * original string so the highlight keeps its accents.
 */
export function highlightRanges(
  text: string,
  query: string,
): Array<[number, number]> {
  const tokens = foldSearchText(query)
    .split(/[^a-z0-9@.]+/)
    .filter((t) => t.length >= 2 || /\d/.test(t))
  if (!tokens.length || !text) return []
  // Fold unit by unit so indexes map 1:1 to the original string.
  let folded = ''
  for (let i = 0; i < text.length; i++) {
    folded += foldSearchText(text[i]).padEnd(1, ' ').slice(0, 1)
  }
  const ranges: Array<[number, number]> = []
  for (const token of tokens) {
    let from = 0
    for (;;) {
      const at = folded.indexOf(token, from)
      if (at === -1) break
      ranges.push([at, at + token.length])
      from = at + token.length
    }
  }
  ranges.sort((a, b) => a[0] - b[0])
  const merged: Array<[number, number]> = []
  for (const range of ranges) {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
    else merged.push([...range])
  }
  return merged
}
