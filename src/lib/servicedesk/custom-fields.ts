import z from 'zod'
import { appError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import type { SdCustomFieldTypeDTO, SdTicketTypeDTO } from '@/types/sd-config'

/**
 * Validação pura dos valores de campos customizados do ServiceDesk (chamado,
 * cliente, contato, CI). Contrato estável, usado pelas fatias de chamados e
 * de cadastros — ver `validateSdCustomFieldValues`.
 */

/** O mínimo de uma definição que a validação precisa (o DTO serve). */
export interface SdCustomFieldDefinitionLike {
  key: string
  label: string
  type: SdCustomFieldTypeDTO
  /** SELECT/MULTI_SELECT: `[{ value, label }]`. */
  options?: unknown
  /** Vazio = todos os tipos. */
  ticketTypes?: SdTicketTypeDTO[]
  /** Vazio = todas as categorias. */
  categoryIds?: string[]
  required: boolean
  active: boolean
  defaultValue?: unknown
}

export interface SdCustomFieldValidationContext {
  /** Tipo do chamado (filtra `ticketTypes`); ausente = não filtra. */
  ticketType?: SdTicketTypeDTO
  /** Categoria/subcategoria/serviço do chamado; ausente = não filtra. */
  categoryIds?: (string | null | undefined)[]
  /**
   * Atualização parcial (PATCH): só valida as chaves enviadas, não exige os
   * obrigatórios ausentes nem aplica padrões; limpar (`null`/`''`/`[]`) um
   * obrigatório é erro. Chaves limpas voltam como `null` no resultado.
   */
  partial?: boolean
}

export interface SdCustomFieldIssue {
  key: string
  label: string
  message: string
}

type FieldCheck = { ok: true; value: unknown } | { ok: false; message: string }

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const PHONE = /^\+?[0-9 ()./-]{8,20}$/

function optionValues(options: unknown): Set<string> {
  if (!Array.isArray(options)) return new Set()
  return new Set(
    options.flatMap((o) =>
      o &&
      typeof o === 'object' &&
      typeof (o as { value?: unknown }).value === 'string'
        ? [(o as { value: string }).value]
        : [],
    ),
  )
}

/** `undefined`, `null`, texto em branco e lista vazia contam como vazio. */
export function isSdCustomFieldEmpty(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  )
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.replace(',', '.'))
    return Number.isFinite(n) ? n : null
  }
  return null
}

function text(value: unknown, max: number): FieldCheck {
  if (typeof value !== 'string')
    return { ok: false, message: 'deve ser um texto' }
  const trimmed = value.trim()
  if (trimmed.length > max) {
    return { ok: false, message: `deve ter no máximo ${max} caracteres` }
  }
  return { ok: true, value: trimmed }
}

/**
 * Valida e normaliza um valor **não vazio** contra o tipo do campo.
 * Números aceitam string numérica (vírgula ou ponto); moeda arredonda em 2
 * casas; data vira `AAAA-MM-DD`; data/hora vira ISO 8601 (UTC).
 */
export function validateSdCustomFieldValue(
  definition: Pick<SdCustomFieldDefinitionLike, 'type' | 'options'>,
  value: unknown,
): FieldCheck {
  switch (definition.type) {
    case 'TEXT':
      return text(value, 1000)
    case 'TEXTAREA':
      return text(value, 10_000)
    case 'NUMBER': {
      const n = toNumber(value)
      return n === null
        ? { ok: false, message: 'deve ser um número' }
        : { ok: true, value: n }
    }
    case 'CURRENCY': {
      const n = toNumber(value)
      return n === null
        ? { ok: false, message: 'deve ser um valor monetário' }
        : { ok: true, value: Math.round(n * 100) / 100 }
    }
    case 'DATE': {
      if (typeof value !== 'string' || !DATE_ONLY.test(value)) {
        return { ok: false, message: 'deve ser uma data (AAAA-MM-DD)' }
      }
      const date = new Date(`${value}T00:00:00.000Z`)
      if (
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      ) {
        return { ok: false, message: 'deve ser uma data válida' }
      }
      return { ok: true, value }
    }
    case 'DATETIME': {
      const date = typeof value === 'string' ? new Date(value) : null
      if (!date || Number.isNaN(date.getTime())) {
        return { ok: false, message: 'deve ser uma data e hora válida' }
      }
      return { ok: true, value: date.toISOString() }
    }
    case 'CHECKBOX':
      return typeof value === 'boolean'
        ? { ok: true, value }
        : { ok: false, message: 'deve ser verdadeiro ou falso' }
    case 'SELECT': {
      const allowed = optionValues(definition.options)
      return typeof value === 'string' && allowed.has(value)
        ? { ok: true, value }
        : { ok: false, message: 'não é uma opção válida' }
    }
    case 'MULTI_SELECT': {
      const allowed = optionValues(definition.options)
      if (
        !Array.isArray(value) ||
        value.some((v) => typeof v !== 'string' || !allowed.has(v))
      ) {
        return { ok: false, message: 'contém opções inválidas' }
      }
      return { ok: true, value: [...new Set(value as string[])] }
    }
    case 'USER':
      return typeof value === 'string' && value.length <= 64
        ? { ok: true, value }
        : { ok: false, message: 'deve ser um usuário' }
    case 'EMAIL': {
      const parsed = z
        .email()
        .safeParse(typeof value === 'string' ? value.trim() : value)
      return parsed.success
        ? { ok: true, value: parsed.data.toLowerCase() }
        : { ok: false, message: 'deve ser um e-mail válido' }
    }
    case 'URL': {
      const parsed = z
        .url({ protocol: /^https?$/ })
        .safeParse(typeof value === 'string' ? value.trim() : value)
      return parsed.success
        ? { ok: true, value: parsed.data }
        : { ok: false, message: 'deve ser uma URL http(s) válida' }
    }
    case 'PHONE':
      return typeof value === 'string' && PHONE.test(value.trim())
        ? { ok: true, value: value.trim() }
        : { ok: false, message: 'deve ser um telefone válido' }
    default:
      return { ok: false, message: 'tipo de campo desconhecido' }
  }
}

/** A definição vale para o contexto (tipo e categorias do chamado)? */
export function isSdCustomFieldApplicable(
  definition: Pick<SdCustomFieldDefinitionLike, 'ticketTypes' | 'categoryIds'>,
  context: Pick<SdCustomFieldValidationContext, 'ticketType' | 'categoryIds'>,
): boolean {
  const types = definition.ticketTypes ?? []
  if (
    context.ticketType &&
    types.length > 0 &&
    !types.includes(context.ticketType)
  ) {
    return false
  }
  const categories = definition.categoryIds ?? []
  if (context.categoryIds && categories.length > 0) {
    const selected = context.categoryIds.filter((id): id is string => !!id)
    if (!selected.some((id) => categories.includes(id))) return false
  }
  return true
}

/**
 * Valida o objeto `customFields` de uma entidade contra as definições.
 *
 * - Participam só as definições **ativas** e aplicáveis ao contexto
 *   (`ticketType`/`categoryIds`, ver `isSdCustomFieldApplicable`).
 * - Chave sem definição ativa → erro "campo desconhecido"; chave de uma
 *   definição que não se aplica ao contexto → erro.
 * - Criação (`partial` falso): aplica `defaultValue` às chaves ausentes e
 *   exige os obrigatórios; vazios são omitidos do resultado.
 * - PATCH (`partial: true`): ver `SdCustomFieldValidationContext.partial`.
 *
 * Sucesso: `ok(valores normalizados)` (só chaves conhecidas). Falha:
 * `SD_CUSTOM_FIELD_INVALID` (422) com a mensagem do primeiro problema e
 * `details.issues: SdCustomFieldIssue[]` com todos.
 */
export function validateSdCustomFieldValues(
  definitions: SdCustomFieldDefinitionLike[],
  values: unknown,
  context: SdCustomFieldValidationContext = {},
): Result<Record<string, unknown>> {
  if (
    values !== undefined &&
    values !== null &&
    (typeof values !== 'object' || Array.isArray(values))
  ) {
    return err(
      appError('SD_CUSTOM_FIELD_INVALID', 'Campos customizados inválidos', {
        issues: [],
      }),
    )
  }
  const input = (values ?? {}) as Record<string, unknown>
  const active = definitions.filter((d) => d.active)
  const byKey = new Map(active.map((d) => [d.key, d]))
  const issues: SdCustomFieldIssue[] = []
  const output: Record<string, unknown> = {}

  for (const key of Object.keys(input)) {
    const definition = byKey.get(key)
    if (!definition) {
      issues.push({ key, label: key, message: `Campo desconhecido: ${key}` })
    } else if (!isSdCustomFieldApplicable(definition, context)) {
      issues.push({
        key,
        label: definition.label,
        message: `${definition.label}: não se aplica a este chamado`,
      })
    }
  }

  for (const definition of active) {
    if (!isSdCustomFieldApplicable(definition, context)) continue
    const present = Object.hasOwn(input, definition.key)
    if (context.partial && !present) continue

    let value = input[definition.key]
    if (
      !context.partial &&
      value === undefined &&
      !isSdCustomFieldEmpty(definition.defaultValue)
    ) {
      value = definition.defaultValue
    }

    if (isSdCustomFieldEmpty(value)) {
      if (definition.required) {
        issues.push({
          key: definition.key,
          label: definition.label,
          message: `${definition.label} é obrigatório`,
        })
      } else if (context.partial) {
        output[definition.key] = null
      }
      continue
    }

    const checked = validateSdCustomFieldValue(definition, value)
    if (checked.ok) {
      output[definition.key] = checked.value
    } else {
      issues.push({
        key: definition.key,
        label: definition.label,
        message: `${definition.label} ${checked.message}`,
      })
    }
  }

  if (issues.length > 0) {
    return err(
      appError('SD_CUSTOM_FIELD_INVALID', issues[0].message, { issues }),
    )
  }
  return ok(output)
}
