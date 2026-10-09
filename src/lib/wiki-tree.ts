/** Tree helpers over the flat wiki page list (parentId + position). */
interface WikiPageNodeLike {
  id: string
  parentId: string | null
  position: number
  title: string
}

/**
 * The page the bare `/wiki` route opens: the first root page by position, so
 * one click on the rail lands on an editor instead of an empty screen. A list
 * whose roots all point at missing parents still opens its first page.
 */
export function firstWikiPageId(
  pages: readonly WikiPageNodeLike[],
): string | null {
  if (pages.length === 0) return null
  const ids = new Set(pages.map((page) => page.id))
  const roots = pages.filter(
    (page) => page.parentId === null || !ids.has(page.parentId),
  )
  const pool = roots.length > 0 ? roots : pages
  return [...pool].sort((a, b) => a.position - b.position)[0].id
}

/** The pages above `id`, root first (for the breadcrumb). */
export function wikiAncestors<T extends WikiPageNodeLike>(
  pages: readonly T[],
  id: string,
): T[] {
  const byId = new Map(pages.map((page) => [page.id, page]))
  const chain: T[] = []
  const seen = new Set<string>([id])
  let parentId = byId.get(id)?.parentId ?? null
  while (parentId && !seen.has(parentId)) {
    const parent = byId.get(parentId)
    if (!parent) break
    chain.unshift(parent)
    seen.add(parentId)
    parentId = parent.parentId
  }
  return chain
}
