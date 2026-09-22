import {
  isSdCustomFieldApplicable,
  isSdCustomFieldEmpty,
} from '@/src/lib/servicedesk/custom-fields'
import type {
  SdAgentDTO,
  SdCustomFieldDefinitionDTO,
  SdCustomFieldEntityDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'

/** Contexto de aplicabilidade (tipo e categorias do chamado). */
export interface SdCustomFieldContext {
  ticketType?: SdTicketTypeDTO
  categoryIds?: (string | null | undefined)[]
}

/** Definições ativas da entidade, aplicáveis ao contexto, em ordem. */
export function sdApplicableCustomFields(
  definitions: SdCustomFieldDefinitionDTO[],
  entity: SdCustomFieldEntityDTO,
  context: SdCustomFieldContext = {},
  options: { portalOnly?: boolean } = {},
): SdCustomFieldDefinitionDTO[] {
  return definitions
    .filter(
      (d) =>
        d.entity === entity &&
        d.active &&
        (!options.portalOnly || d.visibleInPortal) &&
        isSdCustomFieldApplicable(d, context),
    )
    .sort((a, b) => a.position - b.position)
}

/** Valores iniciais: o que já existe + o padrão das definições ausentes. */
export function sdCustomFieldDefaults(
  definitions: SdCustomFieldDefinitionDTO[],
  values: Record<string, unknown> = {},
): Record<string, unknown> {
  const out = { ...values }
  for (const d of definitions) {
    if (out[d.key] === undefined && !isSdCustomFieldEmpty(d.defaultValue)) {
      out[d.key] = d.defaultValue
    }
  }
  return out
}

/** Obrigatórios vazios → `{ chave: mensagem }` (validação antes de enviar). */
export function sdCustomFieldRequiredErrors(
  definitions: SdCustomFieldDefinitionDTO[],
  values: Record<string, unknown>,
): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const d of definitions) {
    if (d.required && isSdCustomFieldEmpty(values[d.key])) {
      errors[d.key] = `${d.label} é obrigatório`
    }
  }
  return errors
}

/**
 * Só as chaves das definições aplicáveis, sem vazios (o que a API aceita na
 * criação: chave de campo que não se aplica é recusada).
 */
export function sdCustomFieldPayload(
  definitions: SdCustomFieldDefinitionDTO[],
  values: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const d of definitions) {
    const value = values[d.key]
    if (!isSdCustomFieldEmpty(value)) out[d.key] = value
  }
  return out
}

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const NUMBER = new Intl.NumberFormat('pt-BR')

/** Valor legível de um campo (visualização). */
export function sdFormatCustomFieldValue(
  definition: Pick<SdCustomFieldDefinitionDTO, 'type' | 'options'>,
  value: unknown,
  agents: Pick<SdAgentDTO, 'id' | 'name'>[] = [],
): string {
  if (isSdCustomFieldEmpty(value)) return '—'
  const optionLabel = (v: unknown) =>
    definition.options.find((o) => o.value === v)?.label ?? String(v)
  switch (definition.type) {
    case 'CHECKBOX':
      return value === true ? 'Sim' : 'Não'
    case 'CURRENCY': {
      const n = Number(value)
      return Number.isFinite(n) ? BRL.format(n) : String(value)
    }
    case 'NUMBER': {
      const n = Number(value)
      return Number.isFinite(n) ? NUMBER.format(n) : String(value)
    }
    case 'DATE': {
      const [y, m, d] = String(value).split('-')
      return y && m && d ? `${d}/${m}/${y}` : String(value)
    }
    case 'DATETIME': {
      const date = new Date(String(value))
      return Number.isNaN(date.getTime())
        ? String(value)
        : date.toLocaleString('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
          })
    }
    case 'SELECT':
      return optionLabel(value)
    case 'MULTI_SELECT':
      return Array.isArray(value)
        ? value.map(optionLabel).join(', ')
        : optionLabel(value)
    case 'USER':
      return agents.find((a) => a.id === value)?.name ?? String(value)
    default:
      return Array.isArray(value) ? value.join(', ') : String(value)
  }
}
