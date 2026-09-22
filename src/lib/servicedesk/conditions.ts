import type { SdCondition } from '@/src/schemas/sd-rule.schema'

/**
 * Avaliação das condições das regras do ServiceDesk (políticas de SLA,
 * escalonamento e automação) contra os "fatos" de um chamado. Semântica do
 * contrato em `src/schemas/sd-rule.schema.ts`:
 *
 * - Todas as condições precisam casar (AND); lista vazia sempre casa.
 * - `customFields.<key>` lê `facts.customFields[key]`.
 * - Campo lista (ex.: `tags`): `equals`/`contains` = contém o valor;
 *   `in` = interseção não vazia; `not_*` = negação.
 * - Comparação de igualdade tolera tipos (`"3"` casa `3`); texto em
 *   `contains` ignora maiúsculas/minúsculas.
 * - `gt`/`lt` comparam números, ou datas ISO quando não forem números.
 */

export interface SdConditionFacts {
  [field: string]: unknown
  customFields?: Record<string, unknown> | null
}

function readFact(facts: SdConditionFacts, field: string): unknown {
  if (field.startsWith('customFields.')) {
    const key = field.slice('customFields.'.length)
    return facts.customFields?.[key]
  }
  return facts[field]
}

function normalize(value: unknown): unknown {
  return value instanceof Date ? value.toISOString() : value
}

function samePrimitive(a: unknown, b: unknown): boolean {
  const x = normalize(a)
  const y = normalize(b)
  if (x === y) return true
  if (x === null || x === undefined || y === null || y === undefined) {
    return false
  }
  return String(x) === String(y)
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object' && !(value instanceof Date)) {
    return Object.keys(value).length === 0
  }
  return false
}

function equals(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) {
    return actual.some((item) => samePrimitive(item, expected))
  }
  return samePrimitive(actual, expected)
}

function inList(actual: unknown, expected: unknown): boolean {
  const list = Array.isArray(expected) ? expected : [expected]
  if (Array.isArray(actual)) {
    return actual.some((item) => list.some((e) => samePrimitive(item, e)))
  }
  return list.some((e) => samePrimitive(actual, e))
}

function contains(actual: unknown, expected: unknown): boolean {
  if (Array.isArray(actual)) return equals(actual, expected)
  if (actual === null || actual === undefined) return false
  if (expected === null || expected === undefined) return false
  return String(normalize(actual))
    .toLowerCase()
    .includes(String(expected).toLowerCase())
}

function toComparable(value: unknown): number | null {
  const v = normalize(value)
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'boolean') return v ? 1 : 0
  if (typeof v !== 'string' || v.trim() === '') return null
  const asNumber = Number(v)
  if (Number.isFinite(asNumber)) return asNumber
  const asDate = Date.parse(v)
  return Number.isNaN(asDate) ? null : asDate
}

function compare(
  actual: unknown,
  expected: unknown,
  fn: (a: number, b: number) => boolean,
): boolean {
  const a = toComparable(actual)
  const b = toComparable(expected)
  if (a === null || b === null) return false
  return fn(a, b)
}

/** Avalia uma condição. */
export function evaluateSdCondition(
  condition: SdCondition,
  facts: SdConditionFacts,
): boolean {
  const actual = readFact(facts, condition.field)
  const expected = condition.value
  switch (condition.operator) {
    case 'equals':
      return equals(actual, expected)
    case 'not_equals':
      return !equals(actual, expected)
    case 'in':
      return inList(actual, expected)
    case 'not_in':
      return !inList(actual, expected)
    case 'contains':
      return contains(actual, expected)
    case 'is_empty':
      return isEmpty(actual)
    case 'is_not_empty':
      return !isEmpty(actual)
    case 'gt':
      return compare(actual, expected, (a, b) => a > b)
    case 'lt':
      return compare(actual, expected, (a, b) => a < b)
  }
}

/** Todas as condições casam (AND). Lista vazia → `true`. */
export function evaluateSdConditions(
  conditions: readonly SdCondition[],
  facts: SdConditionFacts,
): boolean {
  return conditions.every((condition) => evaluateSdCondition(condition, facts))
}
