/**
 * Texto plano do conteúdo Plate de um artigo da KB — alimenta a busca
 * (`to_tsvector('portuguese', ...)`), o trecho dos resultados, o tempo de
 * leitura e o contexto da IA. Puro: sem Plate em runtime, só percorre o JSON.
 */

/** Teto do texto guardado em `plainText` (a busca não precisa de mais). */
export const SD_KB_PLAIN_TEXT_MAX = 100_000

const WORDS_PER_MINUTE = 200

type PlateNode = Record<string, unknown>

function isRecord(value: unknown): value is PlateNode {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const INLINE_TYPES = new Set([
  'a',
  'mention',
  'inline_equation',
  'date',
  'emoji',
  'footnoteReference',
])

function isInline(node: PlateNode): boolean {
  return (
    typeof node.text === 'string' ||
    (typeof node.type === 'string' && INLINE_TYPES.has(node.type))
  )
}

function nodeText(node: PlateNode): string {
  if (typeof node.text === 'string') return node.text
  const children = (Array.isArray(node.children) ? node.children : []).filter(
    isRecord,
  )
  // Bloco que contém blocos (lista, tabela, colunas, toggle): um por linha.
  // Folhas e inlines (link, menção, data) ficam no mesmo texto.
  const joined = children
    .map(nodeText)
    .join(children.every(isInline) ? '' : '\n')
  if (joined.trim()) return joined
  // Menção guarda o nome em `value`; equação em `texExpression`.
  if (typeof node.value === 'string') return node.value
  if (typeof node.texExpression === 'string') return node.texExpression
  return joined
}

/** Concatena o texto dos blocos (um por linha), sem linhas vazias repetidas. */
export function extractSdKbPlainText(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const lines = content
    .filter(isRecord)
    .map((node) =>
      nodeText(node)
        .replace(/[ \t]+/g, ' ')
        .trim(),
    )
    .filter((line) => line.length > 0)
  return lines.join('\n').slice(0, SD_KB_PLAIN_TEXT_MAX)
}

export function countSdKbWords(text: string): number {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

/** Minutos de leitura (mínimo 1). */
export function sdKbReadingMinutes(text: string): number {
  return Math.max(1, Math.ceil(countSdKbWords(text) / WORDS_PER_MINUTE))
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

/**
 * Trecho de até `size` caracteres em volta da primeira ocorrência de algum
 * termo de `query` (sem acento/caixa). Sem ocorrência: o começo do texto.
 */
export function sdKbExcerpt(text: string, query: string, size = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= size) return flat
  const haystack = normalize(flat)
  const terms = normalize(query)
    .split(/\s+/)
    .filter((t) => t.length >= 2)
  const hit = terms
    .map((t) => haystack.indexOf(t))
    .filter((i) => i >= 0)
    .sort((a, b) => a - b)[0]
  if (hit === undefined) return `${flat.slice(0, size).trimEnd()}…`
  const start = Math.max(0, hit - Math.floor(size / 3))
  const end = Math.min(flat.length, start + size)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < flat.length ? '…' : ''
  return `${prefix}${flat.slice(start, end).trim()}${suffix}`
}
