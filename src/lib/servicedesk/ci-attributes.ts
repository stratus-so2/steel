/**
 * Atributos específicos de um item de configuração (CMDB), validados contra
 * o `attributeSchema` do tipo (`SdConfigItemType`). Lib pura.
 */

export type SdCiAttributeType =
  | 'text'
  | 'number'
  | 'date'
  | 'select'
  | 'boolean'

export interface SdCiAttributeDefinition {
  key: string
  label: string
  type: SdCiAttributeType
  options?: string[]
  required?: boolean
}

export type SdCiAttributeValue = string | number | boolean
export type SdCiAttributes = Record<string, SdCiAttributeValue>

export interface SdCiAttributeIssue {
  key: string
  message: string
}

export type SdCiAttributesValidation =
  | { ok: true; value: SdCiAttributes }
  | { ok: false; issues: SdCiAttributeIssue[] }

const DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:\d{2})?)?$/

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '')
  )
}

function coerce(
  def: SdCiAttributeDefinition,
  value: unknown,
): { ok: true; value: SdCiAttributeValue } | { ok: false; message: string } {
  switch (def.type) {
    case 'text':
      if (typeof value === 'string') return { ok: true, value: value.trim() }
      if (typeof value === 'number') return { ok: true, value: String(value) }
      return { ok: false, message: 'Deve ser um texto' }
    case 'number': {
      const n =
        typeof value === 'number'
          ? value
          : typeof value === 'string'
            ? Number(value.replace(',', '.'))
            : Number.NaN
      if (!Number.isFinite(n))
        return { ok: false, message: 'Deve ser um número' }
      return { ok: true, value: n }
    }
    case 'date':
      if (
        typeof value === 'string' &&
        DATE_RE.test(value) &&
        !Number.isNaN(Date.parse(value))
      ) {
        return { ok: true, value: value.slice(0, 10) }
      }
      return { ok: false, message: 'Deve ser uma data (AAAA-MM-DD)' }
    case 'select':
      if (typeof value === 'string' && (def.options ?? []).includes(value)) {
        return { ok: true, value }
      }
      return { ok: false, message: 'Opção inválida' }
    case 'boolean':
      if (typeof value === 'boolean') return { ok: true, value }
      if (value === 'true' || value === 'false') {
        return { ok: true, value: value === 'true' }
      }
      return { ok: false, message: 'Deve ser verdadeiro ou falso' }
  }
}

/**
 * Valida e normaliza os atributos. Valores vazios são descartados; chaves
 * fora do esquema são erro — ou descartadas com `dropUnknown` (troca de tipo
 * reaproveitando os atributos já salvos).
 */
export function validateCiAttributes(
  schema: SdCiAttributeDefinition[],
  values: Record<string, unknown>,
  options: { dropUnknown?: boolean } = {},
): SdCiAttributesValidation {
  const byKey = new Map(schema.map((def) => [def.key, def]))
  const issues: SdCiAttributeIssue[] = []
  const out: SdCiAttributes = {}

  for (const [key, value] of Object.entries(values)) {
    const def = byKey.get(key)
    if (!def) {
      if (!options.dropUnknown) {
        issues.push({ key, message: 'Atributo não existe neste tipo' })
      }
      continue
    }
    if (isEmpty(value)) continue
    const coerced = coerce(def, value)
    if (coerced.ok) out[key] = coerced.value
    else issues.push({ key, message: `${def.label}: ${coerced.message}` })
  }

  for (const def of schema) {
    if (def.required && out[def.key] === undefined) {
      if (!issues.some((i) => i.key === def.key)) {
        issues.push({ key: def.key, message: `${def.label} é obrigatório` })
      }
    }
  }

  return issues.length ? { ok: false, issues } : { ok: true, value: out }
}

/** Lê o JSON salvo como esquema (entradas malformadas são ignoradas). */
export function parseCiAttributeSchema(
  value: unknown,
): SdCiAttributeDefinition[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (def): def is SdCiAttributeDefinition =>
      Boolean(def) &&
      typeof def === 'object' &&
      typeof (def as SdCiAttributeDefinition).key === 'string' &&
      typeof (def as SdCiAttributeDefinition).label === 'string' &&
      ['text', 'number', 'date', 'select', 'boolean'].includes(
        (def as SdCiAttributeDefinition).type,
      ),
  )
}
