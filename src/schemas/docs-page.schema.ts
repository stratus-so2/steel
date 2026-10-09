import z from 'zod'

/**
 * Sections of the user manual (`/docs`), in reading order. Each one is a
 * folder under `content/docs/`; a page's `section` must match its folder.
 */
export const DOCS_SECTION_SLUGS = [
  'comecando',
  'workspace',
  'servicedesk',
  'crm',
  'comunicacao',
  'steel-ai',
  'seguranca',
  'suporte',
  'faq',
] as const

export type DocsSectionSlug = (typeof DOCS_SECTION_SLUGS)[number]

/** File name of a page (without `.mdx`): also the last segment of its url. */
export const docsPageSlug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'slug inválido')

/** Frontmatter of a `content/docs/<section>/<page>.mdx` file. */
export const DocsPageFrontmatterSchema = z.object({
  title: z.string().trim().min(2).max(90),
  description: z.string().trim().min(20).max(220),
  section: z.enum(DOCS_SECTION_SLUGS),
  /** Position inside the section; `index.mdx` is always shown first. */
  order: z.number().int().min(0).max(999),
})

export type DocsPageFrontmatter = z.infer<typeof DocsPageFrontmatterSchema>
