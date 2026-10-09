import type { MdxHeading } from '@/src/lib/mdx/headings'
import type { ChangelogEntryTag } from '@/src/schemas/changelog-entry.schema'

export interface ChangelogEntryMetaDTO {
  slug: string
  title: string
  date: string
  summary: string
  tags: ChangelogEntryTag[]
  version: string | null
  cover: string | null
}

export type ChangelogEntryHeading = MdxHeading

export interface ChangelogEntryDTO extends ChangelogEntryMetaDTO {
  /** MDX body without the frontmatter (also served as plain markdown). */
  source: string
  headings: ChangelogEntryHeading[]
}
