/**
 * WhatsApp identity of a CRM phone: digits only, with country code (E.164
 * without the "+"), which is the `waId` used by both providers. Brazilian
 * numbers saved without the country code (10–11 digits) get `55`.
 */
export function toCampaignWaId(raw: string | null | undefined): string | null {
  if (!raw) return null
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`
  if (digits.length < 12 || digits.length > 15) return null
  return digits
}

/** Display form, e.g. `+5511999990000`. */
export function formatE164(waId: string): string {
  return `+${waId}`
}
