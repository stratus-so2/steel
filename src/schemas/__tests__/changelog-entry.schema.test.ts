import { describe, expect, it } from 'vitest'
import { ChangelogEntryFrontmatterSchema } from '../changelog-entry.schema'

const valid = {
  title: 'Busca global',
  slug: 'busca-global',
  date: '2026-10-08',
  summary: 'Uma busca que atravessa os três módulos.',
  tags: ['PLATAFORMA'],
}

describe('ChangelogEntryFrontmatterSchema', () => {
  it('accepts a minimal entry and coerces the date', () => {
    const parsed = ChangelogEntryFrontmatterSchema.parse(valid)
    expect(parsed.date).toBeInstanceOf(Date)
    expect(parsed.version).toBeUndefined()
  })

  it('accepts a CalVer version with a same-day suffix', () => {
    expect(
      ChangelogEntryFrontmatterSchema.safeParse({
        ...valid,
        version: '2026.10.08.2',
      }).success,
    ).toBe(true)
  })

  it.each([
    ['an uppercase slug', { slug: 'Busca' }],
    ['no tags', { tags: [] }],
    ['an unknown tag', { tags: ['BLOG'] }],
    ['a non-CalVer version', { version: 'v1.2.3' }],
    ['a short summary', { summary: 'curto' }],
  ])('rejects %s', (_label, patch) => {
    expect(
      ChangelogEntryFrontmatterSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false)
  })
})
