import type { Value } from 'platejs'
import type {
  SdKbArticleStatusDTO,
  SdKbArticleSummaryDTO,
  SdKbVisibilityDTO,
} from '@/types/sd-kb-article'

export const SD_KB_STATUS_LABEL: Record<SdKbArticleStatusDTO, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicado',
}

export const SD_KB_VISIBILITY_LABEL: Record<SdKbVisibilityDTO, string> = {
  INTERNAL: 'Interno',
  PORTAL: 'Portal',
}

export interface SdKbTreeNode extends SdKbArticleSummaryDTO {
  children: SdKbTreeNode[]
}

/** Monta a árvore (pais antes dos filhos; órfãos viram raiz). */
export function buildSdKbTree(
  articles: SdKbArticleSummaryDTO[],
): SdKbTreeNode[] {
  const nodes = new Map<string, SdKbTreeNode>(
    articles.map((a) => [a.id, { ...a, children: [] }]),
  )
  const roots: SdKbTreeNode[] = []
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }
  const sort = (list: SdKbTreeNode[]) => {
    list.sort((a, b) => a.position - b.position)
    for (const n of list) sort(n.children)
  }
  sort(roots)
  return roots
}

/** IDs dos ancestrais (para abrir a árvore até o artigo atual). */
export function sdKbAncestorIds(
  articles: SdKbArticleSummaryDTO[],
  id: string,
): string[] {
  const byId = new Map(articles.map((a) => [a.id, a]))
  const out: string[] = []
  let current = byId.get(id)?.parentId ?? null
  while (current && !out.includes(current)) {
    out.push(current)
    current = byId.get(current)?.parentId ?? null
  }
  return out
}

export interface SdKbHeading {
  level: 1 | 2 | 3
  text: string
  /** Índice entre os títulos do documento (âncora no DOM). */
  index: number
}

const HEADING_LEVEL: Record<string, 1 | 2 | 3> = { h1: 1, h2: 2, h3: 3 }

function textOf(node: unknown): string {
  if (!node || typeof node !== 'object') return ''
  const n = node as { text?: unknown; children?: unknown }
  if (typeof n.text === 'string') return n.text
  return Array.isArray(n.children) ? n.children.map(textOf).join('') : ''
}

/** Sumário: títulos H1–H3 de primeiro nível do documento, em ordem. */
export function sdKbHeadings(content: Value): SdKbHeading[] {
  const out: SdKbHeading[] = []
  let index = 0
  for (const node of content) {
    const level = HEADING_LEVEL[String(node.type)]
    if (!level) continue
    const text = textOf(node).trim()
    if (text) out.push({ level, text, index })
    index += 1
  }
  return out
}

/** "há 3 dias" etc., em pt-BR, sem depender do fuso do servidor. */
export function sdKbRelativeTime(iso: string, now = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `há ${days} ${days === 1 ? 'dia' : 'dias'}`
  const months = Math.floor(days / 30)
  if (months < 12) return `há ${months} ${months === 1 ? 'mês' : 'meses'}`
  const years = Math.floor(months / 12)
  return `há ${years} ${years === 1 ? 'ano' : 'anos'}`
}

/** Top N por um critério numérico/data, sem mutar a lista. */
export function sdKbTop(
  articles: SdKbArticleSummaryDTO[],
  by: 'updatedAt' | 'viewCount' | 'helpfulCount',
  limit = 5,
): SdKbArticleSummaryDTO[] {
  const score = (a: SdKbArticleSummaryDTO) =>
    by === 'updatedAt' ? new Date(a.updatedAt).getTime() : a[by]
  return [...articles]
    .filter((a) => by === 'updatedAt' || a[by] > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit)
}

/** % de votos úteis (ou `null` sem votos). */
export function sdKbHelpfulRatio(a: {
  helpfulCount: number
  notHelpfulCount: number
}): number | null {
  const total = a.helpfulCount + a.notHelpfulCount
  return total === 0 ? null : Math.round((a.helpfulCount / total) * 100)
}
