import { describe, expect, it } from 'vitest'
import { DocsPageFrontmatterSchema, docsPageSlug } from '../docs-page.schema'

const valid = {
  title: 'Leads',
  description: 'As etapas do funil de leads e o que cada uma exige.',
  section: 'crm',
  order: 1,
}

describe('DocsPageFrontmatterSchema', () => {
  it('accepts a complete frontmatter', () => {
    expect(DocsPageFrontmatterSchema.parse(valid)).toEqual(valid)
  })

  it.each([
    ['an unknown section', { section: 'blog' }],
    ['a short description', { description: 'curta' }],
    ['a negative order', { order: -1 }],
    ['a fractional order', { order: 1.5 }],
    ['a missing title', { title: undefined }],
  ])('rejects %s', (_label, patch) => {
    expect(
      DocsPageFrontmatterSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false)
  })
})

describe('docsPageSlug', () => {
  it.each([
    ['index', true],
    ['portal-do-solicitante', true],
    ['Leads', false],
    ['dois--hifens', false],
    ['-inicio', false],
  ])('%s → %s', (slug, ok) => {
    expect(docsPageSlug.safeParse(slug).success).toBe(ok)
  })
})
