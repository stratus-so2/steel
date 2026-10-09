/**
 * Client-side search over the manual: titles, section names, blurbs and
 * headings. Small enough (a few dozen pages) to run on every keystroke
 * without an index. Accents and case are ignored, and every word of the
 * query must appear somewhere in the page.
 */

export interface DocsSearchable {
  href: string
  title: string
  description: string
  section: string
  headings: { id: string; text: string }[]
}

export interface DocsSearchResult {
  /** Page url, with the heading anchor when the match is in a heading. */
  href: string
  title: string
  section: string
  /** Heading that matched, or the page blurb. */
  excerpt: string
}

export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

const tokenize = (query: string) =>
  normalizeSearchText(query).split(/\s+/).filter(Boolean)

const countHits = (text: string, tokens: string[]) =>
  tokens.filter((token) => text.includes(token)).length

export function searchDocs(
  pages: DocsSearchable[],
  query: string,
  limit = 8,
): DocsSearchResult[] {
  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  const scored: { result: DocsSearchResult; score: number }[] = []
  for (const page of pages) {
    const title = normalizeSearchText(page.title)
    const section = normalizeSearchText(page.section)
    const description = normalizeSearchText(page.description)
    const headings = page.headings.map((heading) => ({
      ...heading,
      norm: normalizeSearchText(heading.text),
    }))
    const haystack = [
      title,
      section,
      description,
      ...headings.map((h) => h.norm),
    ].join(' ')
    if (countHits(haystack, tokens) < tokens.length) continue

    // The heading that carries most of the query, if it beats the title.
    const titleHits = countHits(title, tokens)
    let best: (typeof headings)[number] | null = null
    let bestHits = titleHits
    for (const heading of headings) {
      const hits = countHits(heading.norm, tokens)
      if (hits > bestHits) {
        best = heading
        bestHits = hits
      }
    }

    const score =
      titleHits * 10 +
      (title.startsWith(tokens[0]) ? 5 : 0) +
      bestHits * 4 +
      countHits(section, tokens) * 3 +
      countHits(description, tokens) * 2

    scored.push({
      score,
      result: {
        href: best ? `${page.href}#${best.id}` : page.href,
        title: page.title,
        section: page.section,
        excerpt: best ? best.text : page.description,
      },
    })
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.result)
}
