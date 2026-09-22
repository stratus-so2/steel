import z from 'zod'

/**
 * Peças comuns aos cadastros do ServiceDesk (clientes/empresas, contatos e
 * itens de configuração): valores de campos customizados, paginação,
 * booleanos de query string e o seletor leve (`/options`).
 */

/** Valor primitivo aceito num campo customizado. */
const CustomFieldPrimitive = z.union([
  z.string().max(5000),
  z.number().finite(),
  z.boolean(),
  z.null(),
])

/**
 * Valores de campos customizados: objeto `{ chave: primitivo | primitivo[] }`.
 * Aqui só a forma é validada. TODO(servicedesk-integração): validar contra
 * as definições da fatia config com
 * `validateSdCustomFieldValues(definitions, values, …)` de
 * `src/lib/servicedesk/custom-fields.ts` (tipo, obrigatório, opções).
 */
export const SdCustomFieldValuesSchema = z
  .record(
    z.string().min(1).max(100),
    z.union([CustomFieldPrimitive, z.array(CustomFieldPrimitive).max(200)]),
  )
  .refine((value) => Object.keys(value).length <= 200, {
    message: 'Campos customizados demais (máx. 200)',
  })

export type SdCustomFieldValues = z.infer<typeof SdCustomFieldValuesSchema>

/** `'true'`/`'false'` da query string → boolean (omitido = sem filtro). */
export const QueryBoolean = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true')

export const SdPageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  order: z.enum(['asc', 'desc']).default('asc'),
})

/** Busca leve dos seletores (combobox do formulário de chamado). */
export const SdOptionsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

export type SdOptionsQueryDTO = z.infer<typeof SdOptionsQuerySchema>

/** Texto obrigatório com trim. */
export function requiredText(max: number, message: string) {
  return z.string().trim().min(1, message).max(max)
}

/** Converte `''`/espaços em `null` (campo limpo). */
export function emptyToNull(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? null : value
}

/**
 * Texto opcional: `''` vira `null`; `null` limpa; omitido = sem alteração.
 * Faz trim do valor preenchido.
 */
export function optionalText(max: number) {
  return z.preprocess(
    emptyToNull,
    z.string().trim().max(max).nullable().optional(),
  )
}

/** E-mail opcional, limpável. */
export function optionalEmail() {
  return z.preprocess(
    emptyToNull,
    z.email('E-mail inválido').max(320).nullable().optional(),
  )
}

/** ID opcional, limpável (`''`/`null` desvincula). */
export function optionalId() {
  return z.preprocess(emptyToNull, z.string().max(64).nullable().optional())
}

/** Data opcional (ISO ou `YYYY-MM-DD`), limpável. */
export function optionalDate() {
  return z.preprocess(emptyToNull, z.coerce.date().nullable().optional())
}
