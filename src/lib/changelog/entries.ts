import 'server-only'
import fs from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import { cache } from 'react'
import { extractHeadings } from '@/src/lib/mdx/headings'
import {
  type ChangelogEntryFrontmatter,
  ChangelogEntryFrontmatterSchema,
} from '@/src/schemas/changelog-entry.schema'
import type {
  ChangelogEntryDTO,
  ChangelogEntryMetaDTO,
} from '@/types/changelog-entry'

export { extractHeadings }

/**
 * Public product changelog. Each entry is an MDX file in
 * `content/changelog/`, versioned with the code it describes. This is
 * separate from the admin "changelog" (`Changelog` model), which is an e-mail
 * send to users — the two can share copy, not storage.
 */
export const CHANGELOG_DIR = path.join(process.cwd(), 'content', 'changelog')

async function listEntryFiles(): Promise<string[]> {
  try {
    const names = await fs.readdir(CHANGELOG_DIR)
    return names.filter((name) => name.endsWith('.mdx')).sort()
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

async function readEntryFile(fileName: string) {
  const raw = await fs.readFile(path.join(CHANGELOG_DIR, fileName), 'utf-8')
  const { data, content } = matter(raw)
  const parsed = ChangelogEntryFrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(
      `Invalid frontmatter in content/changelog/${fileName}: ${parsed.error.message}`,
    )
  }
  return { frontmatter: parsed.data, source: content.trim() }
}

function toMeta(frontmatter: ChangelogEntryFrontmatter): ChangelogEntryMetaDTO {
  return {
    slug: frontmatter.slug,
    title: frontmatter.title,
    date: frontmatter.date.toISOString(),
    summary: frontmatter.summary,
    tags: frontmatter.tags,
    version: frontmatter.version ?? null,
    cover: frontmatter.cover ?? null,
  }
}

const byDateDesc = (a: ChangelogEntryMetaDTO, b: ChangelogEntryMetaDTO) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)

/** Every entry, newest first. Throws on a malformed file: fail the build. */
export const getAllEntries = cache(async (): Promise<ChangelogEntryDTO[]> => {
  const files = await listEntryFiles()
  const entries = await Promise.all(
    files.map(async (fileName) => {
      const { frontmatter, source } = await readEntryFile(fileName)
      return {
        ...toMeta(frontmatter),
        source,
        headings: extractHeadings(source),
      }
    }),
  )
  const slugs = new Set<string>()
  for (const entry of entries) {
    if (slugs.has(entry.slug)) {
      throw new Error(`Duplicate changelog slug: ${entry.slug}`)
    }
    slugs.add(entry.slug)
  }
  return entries.sort(byDateDesc)
})

export const getAllEntriesMeta = cache(
  async (): Promise<ChangelogEntryMetaDTO[]> =>
    (await getAllEntries()).map(
      ({ source: _source, headings: _headings, ...meta }) => meta,
    ),
)

export const getEntryBySlug = cache(
  async (slug: string): Promise<ChangelogEntryDTO | null> =>
    (await getAllEntries()).find((entry) => entry.slug === slug) ?? null,
)
