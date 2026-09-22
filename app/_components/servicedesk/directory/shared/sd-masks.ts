/** Máscaras de digitação dos cadastros (a API normaliza para dígitos). */

/**
 * `(11) 98765-4321` progressivo. Números salvos com DDI (`5511…`) aparecem
 * como `+55 (11) …`; outros formatos internacionais ficam só com dígitos.
 */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 13)
  const withDdi =
    digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : null
  const local = withDdi ?? digits
  if (local.length > 11) return `+${digits}`
  let out = ''
  if (local.length > 0) out = `(${local.slice(0, 2)}`
  if (local.length >= 2) out += ') '
  if (local.length > 2) {
    const cut = local.length > 10 ? 7 : 6
    out += local.slice(2, cut)
    if (local.length > cut) out += `-${local.slice(cut)}`
  }
  return withDdi ? `+55 ${out}` : out
}

/** `00000-000` progressivo. */
export function maskCep(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

/** `''` → `null` (campo limpo no PATCH). */
export function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
