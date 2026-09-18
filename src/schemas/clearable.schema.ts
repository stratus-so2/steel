import z from 'zod'

/** Converte string vazia/só espaços em `null` (campo limpo pelo usuário). */
function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

/**
 * Texto opcional que pode ser limpo num PATCH: aceita `null` (e `''`, que é
 * normalizado para `null`) para apagar o valor persistido. Omitido = sem
 * alteração.
 */
export function clearableText(max: number) {
  return z.preprocess(emptyToNull, z.string().max(max).nullable().optional())
}

/** Variante de {@link clearableText} que exige URL válida quando preenchida. */
export function clearableUrl(max: number) {
  return z.preprocess(emptyToNull, z.url().max(max).nullable().optional())
}
