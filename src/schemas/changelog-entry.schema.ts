import z from 'zod'

const slugRegex = /^[a-z0-9-]+$/

export const CHANGELOG_ENTRY_TAGS = [
  'SERVICEDESK',
  'CRM',
  'COMUNICACAO',
  'IA',
  'PLATAFORMA',
] as const

export type ChangelogEntryTag = (typeof CHANGELOG_ENTRY_TAGS)[number]

export const changelogEntrySlug = z
  .string()
  .trim()
  .min(2, 'Slug deve ter ao menos 2 caracteres')
  .max(100, 'Slug deve ter no máximo 100 caracteres')
  .regex(
    slugRegex,
    'slug deve conter apenas letras minúsculas, números e hífens',
  )

/** Frontmatter of a `content/changelog/*.mdx` file. */
export const ChangelogEntryFrontmatterSchema = z.object({
  title: z.string().trim().min(2).max(120),
  slug: changelogEntrySlug,
  date: z.coerce.date(),
  summary: z.string().trim().min(10).max(300),
  tags: z.array(z.enum(CHANGELOG_ENTRY_TAGS)).min(1),
  /** CalVer release tag the entry shipped in (ADR 0003), when known. */
  version: z
    .string()
    .trim()
    .regex(/^\d{4}\.\d{2}\.\d{2}(\.\d+)?$/)
    .optional(),
  cover: z.string().trim().optional(),
})

export type ChangelogEntryFrontmatter = z.infer<
  typeof ChangelogEntryFrontmatterSchema
>
