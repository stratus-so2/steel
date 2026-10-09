import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { cache } from 'react'
import {
  DOCS_SECTIONS,
  docsSectionLabel,
  docsSectionRank,
} from '@/src/lib/docs/sections'
import { extractHeadings, type MdxHeading } from '@/src/lib/mdx/headings'
import {
  DOCS_SECTION_SLUGS,
  DocsPageFrontmatterSchema,
  type DocsSectionSlug,
  docsPageSlug,
} from '@/src/schemas/docs-page.schema'

/**
 * The user manual. Each page is an MDX file in
 * `content/docs/<section>/<page>.mdx`, versioned with the code it describes.
 * `index.mdx` is the section's overview, served at `/docs/<section>`; any
 * other file is served at `/docs/<section>/<page>`. A malformed file throws,
 * so a bad page fails the build instead of shipping.
 */
export const DOCS_ROOT = '/docs'

export interface DocsPageMeta {
  section: DocsSectionSlug
  /** File name without `.mdx` (`index` for the section overview). */
  slug: string
  href: string
  title: string
  description: string
  order: number
}

export interface DocsPage extends DocsPageMeta {
  source: string
  headings: MdxHeading[]
}

export interface DocsNavSection {
  slug: DocsSectionSlug
  label: string
  description: string
  pages: Pick<DocsPageMeta, 'href' | 'title'>[]
}

export interface DocsSearchEntry {
  href: string
  title: string
  description: string
  section: string
  headings: Pick<MdxHeading, 'id' | 'text'>[]
}

const docsDir = () => path.join(process.cwd(), 'content', 'docs')

const isSection = (name: string): name is DocsSectionSlug =>
  (DOCS_SECTION_SLUGS as readonly string[]).includes(name)

export function docsHref(section: DocsSectionSlug, slug: string): string {
  return slug === 'index'
    ? `${DOCS_ROOT}/${section}`
    : `${DOCS_ROOT}/${section}/${slug}`
}

async function readDir(dir: string) {
  try {
    return await fs.readdir(dir, { withFileTypes: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readPage(
  section: DocsSectionSlug,
  fileName: string,
): Promise<DocsPage> {
  const where = `content/docs/${section}/${fileName}`
  const slug = fileName.replace(/\.mdx$/, '')
  if (!docsPageSlug.safeParse(slug).success) {
    throw new Error(`Invalid docs file name: ${where}`)
  }

  const raw = await fs.readFile(
    path.join(docsDir(), section, fileName),
    'utf-8',
  )
  const { data, content } = matter(raw)
  const parsed = DocsPageFrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(`Invalid frontmatter in ${where}: ${parsed.error.message}`)
  }
  if (parsed.data.section !== section) {
    throw new Error(
      `Section mismatch in ${where}: frontmatter says "${parsed.data.section}"`,
    )
  }

  const source = content.trim()
  return {
    ...parsed.data,
    slug,
    href: docsHref(section, slug),
    source,
    headings: extractHeadings(source),
  }
}

function comparePages(a: DocsPage, b: DocsPage): number {
  const bySection = docsSectionRank(a.section) - docsSectionRank(b.section)
  if (bySection !== 0) return bySection
  if (a.slug === 'index' || b.slug === 'index') {
    return a.slug === 'index' ? -1 : 1
  }
  return a.order - b.order || a.title.localeCompare(b.title, 'pt-BR')
}

/** Every page, in reading order (section, overview first, then `order`). */
export const getAllDocs = cache(async (): Promise<DocsPage[]> => {
  const pages: DocsPage[] = []
  for (const entry of await readDir(docsDir())) {
    if (!entry.isDirectory()) continue
    if (!isSection(entry.name)) {
      throw new Error(`Unknown docs section folder: content/docs/${entry.name}`)
    }
    const section = entry.name
    const files = (await readDir(path.join(docsDir(), section)))
      .filter((file) => file.isFile() && file.name.endsWith('.mdx'))
      .map((file) => file.name)
    pages.push(
      ...(await Promise.all(files.map((file) => readPage(section, file)))),
    )
  }
  return pages.sort(comparePages)
})

export const getAllDocsMeta = cache(
  async (): Promise<DocsPageMeta[]> =>
    (await getAllDocs()).map(
      ({ source: _source, headings: _headings, ...meta }) => meta,
    ),
)

/** The page at `/docs/<segments...>`, or `null`. */
export const getDocByPath = cache(
  async (segments: string[]): Promise<DocsPage | null> => {
    const href = `${DOCS_ROOT}/${segments.join('/')}`
    return (await getAllDocs()).find((page) => page.href === href) ?? null
  },
)

/** Sidebar data: the sections that have pages, each with its pages. */
export const getDocsNav = cache(async (): Promise<DocsNavSection[]> => {
  const pages = await getAllDocs()
  return DOCS_SECTIONS.map((section) => ({
    ...section,
    pages: pages
      .filter((page) => page.section === section.slug)
      .map(({ href, title }) => ({ href, title })),
  })).filter((section) => section.pages.length > 0)
})

/** Previous and next page in reading order, across sections. */
export async function getAdjacentDocs(href: string): Promise<{
  prev: DocsPageMeta | null
  next: DocsPageMeta | null
}> {
  const pages = await getAllDocsMeta()
  const index = pages.findIndex((page) => page.href === href)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: pages[index - 1] ?? null,
    next: pages[index + 1] ?? null,
  }
}

/** What the client-side search looks at: titles, blurbs and headings. */
export const getDocsSearchIndex = cache(
  async (): Promise<DocsSearchEntry[]> => {
    const pages = await getAllDocs()
    return pages.map((page) => ({
      href: page.href,
      title: page.title,
      description: page.description,
      section: docsSectionLabel(page.section),
      headings: page.headings.map(({ id, text }) => ({ id, text })),
    }))
  },
)
