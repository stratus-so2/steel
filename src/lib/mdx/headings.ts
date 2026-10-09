import GithubSlugger from 'github-slugger'

export interface MdxHeading {
  level: 2 | 3
  id: string
  text: string
}

const HEADING_LINE = /^(#{2,3})\s+(.+?)\s*#*\s*$/
const FENCE_LINE = /^\s*(```|~~~)/

/**
 * `##`/`###` headings in document order, with the ids rehype-slug gives them
 * (both use github-slugger, fresh per document). Lines inside code fences are
 * skipped. Shared by the changelog and the user manual.
 */
export function extractHeadings(source: string): MdxHeading[] {
  const slugger = new GithubSlugger()
  const headings: MdxHeading[] = []
  let inFence = false
  for (const line of source.split('\n')) {
    if (FENCE_LINE.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = HEADING_LINE.exec(line)
    if (!match) continue
    const text = match[2].replace(/[*_`]/g, '').trim()
    headings.push({
      level: match[1].length as MdxHeading['level'],
      id: slugger.slug(text),
      text,
    })
  }
  return headings
}
