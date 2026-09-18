import { z } from 'zod'

export type JsonSchema = { [key: string]: unknown }

export type SchemaIo = 'input' | 'output'

/** Formatos cujo `pattern` gerado pelo Zod é só ruído na documentação. */
const FORMATS_WITHOUT_PATTERN = new Set([
  'email',
  'date-time',
  'date',
  'time',
  'uri',
  'url',
  'uuid',
  'cuid',
  'cuid2',
  'ulid',
  'ipv4',
  'ipv6',
  'base64url',
])

/** `id` do schema no `z.globalRegistry` (definido com `.meta({ id })`). */
export function schemaId(schema: z.ZodType): string | undefined {
  const meta = z.globalRegistry.get(schema)
  return typeof meta?.id === 'string' ? meta.id : undefined
}

export function isZodSchema(value: unknown): value is z.ZodType {
  return typeof value === 'object' && value !== null && '_zod' in value
}

function isPlainObject(value: unknown): value is JsonSchema {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Limpa o JSON Schema gerado pelo Zod para leitura humana: tira `$schema`,
 * `pattern` redundante com `format`, `propertyNames: { type: string }` e
 * `additionalProperties: false` (os DTOs de resposta não são contratos
 * fechados — campos novos podem aparecer sem quebrar clientes).
 */
function clean(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(clean)
  if (!isPlainObject(node)) return node

  const out: JsonSchema = {}
  for (const [key, value] of Object.entries(node)) {
    if (key === '$schema') continue
    if (key === 'additionalProperties' && value === false) continue
    if (
      key === 'propertyNames' &&
      isPlainObject(value) &&
      Object.keys(value).length === 1 &&
      value.type === 'string'
    ) {
      continue
    }
    if (
      key === 'pattern' &&
      typeof node.format === 'string' &&
      FORMATS_WITHOUT_PATTERN.has(node.format)
    ) {
      continue
    }
    out[key] = clean(value)
  }
  return out
}

/** Reescreve `#/$defs/<x>` para `#/components/schemas/<prefix><x>`. */
function rewriteDefsRefs(node: unknown, rename: Map<string, string>): unknown {
  if (Array.isArray(node))
    return node.map((item) => rewriteDefsRefs(item, rename))
  if (!isPlainObject(node)) return node

  const out: JsonSchema = {}
  for (const [key, value] of Object.entries(node)) {
    if (
      key === '$ref' &&
      typeof value === 'string' &&
      value.startsWith('#/$defs/')
    ) {
      const target = rename.get(value.slice('#/$defs/'.length))
      out[key] = target ? `#/components/schemas/${target}` : value
      continue
    }
    out[key] = rewriteDefsRefs(value, rename)
  }
  return out
}

export interface ConvertedSchema {
  schema: JsonSchema
  /** Definições internas (`$defs`) já renomeadas para `components.schemas`. */
  defs: Record<string, JsonSchema>
}

/**
 * Converte um schema Zod em JSON Schema (draft 2020-12, o dialeto do
 * OpenAPI 3.1) com o `z.toJSONSchema` nativo do Zod 4.
 *
 * - `io: 'input'` descreve o que o cliente envia (antes de `default`,
 *   `transform`, `coerce`); `io: 'output'` descreve o que a API devolve.
 * - `z.date()` vira `string` `date-time` (é assim que trafega no JSON).
 * - Transforms/refinements não representáveis viram `{}` em vez de lançar.
 * - Sub-schemas com `.meta({ id })` viram `$ref` para
 *   `components.schemas.<id>`; `$defs` anônimos (ciclos) são içados com o
 *   prefixo `defsPrefix`.
 */
export function zodToJsonSchema(
  schema: z.ZodType,
  io: SchemaIo,
  defsPrefix: string,
): ConvertedSchema {
  const raw = z.toJSONSchema(schema, {
    io,
    unrepresentable: 'any',
    override: (ctx) => {
      const def = (ctx.zodSchema as { _zod: { def: { type: string } } })._zod
        .def
      if (def.type === 'date') {
        ctx.jsonSchema.type = 'string'
        ctx.jsonSchema.format = 'date-time'
      }
      // `.default(() => new Date())` seria avaliado na geração e deixaria o
      // spec não determinístico: um default de data vira "agora" no texto.
      if (
        ctx.jsonSchema.default instanceof Date ||
        (typeof ctx.jsonSchema.default === 'string' &&
          ctx.jsonSchema.format === 'date-time')
      ) {
        delete ctx.jsonSchema.default
        ctx.jsonSchema.description ??= 'Omitido = o instante da requisição.'
      }
    },
  }) as JsonSchema

  const { $defs, ...rest } = raw
  const rename = new Map<string, string>()
  if (isPlainObject($defs)) {
    for (const key of Object.keys($defs)) {
      // Schemas com `.meta({ id })` viram componentes com o próprio id;
      // os anônimos (`__schema0`, ciclos) ganham o prefixo do contexto.
      rename.set(key, key.startsWith('__schema') ? `${defsPrefix}${key}` : key)
    }
  }

  const defs: Record<string, JsonSchema> = {}
  if (isPlainObject($defs)) {
    for (const [key, value] of Object.entries($defs)) {
      defs[rename.get(key) as string] = clean(
        rewriteDefsRefs(value, rename),
      ) as JsonSchema
    }
  }

  return {
    schema: clean(rewriteDefsRefs(rest, rename)) as JsonSchema,
    defs,
  }
}
