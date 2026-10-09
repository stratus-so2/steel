import { describe, expect, it } from 'vitest'
import { DevPageFrontmatterSchema, devPagePath } from '../dev-page.schema'

const valid = {
  title: 'Limites de requisição',
  description: 'Quantas chamadas cada entrada aceita por minuto e o 429.',
  section: 'fundamentos',
  order: 3,
}

describe('DevPageFrontmatterSchema', () => {
  it('accepts a complete frontmatter', () => {
    expect(DevPageFrontmatterSchema.parse(valid)).toEqual(valid)
  })

  it.each([
    ['an unknown section', { section: 'crm' }],
    ['a short description', { description: 'curta' }],
    ['a one-letter title', { title: 'L' }],
    ['a negative order', { order: -1 }],
    ['a fractional order', { order: 1.5 }],
    ['a missing title', { title: undefined }],
  ])('rejects %s', (_label, patch) => {
    expect(
      DevPageFrontmatterSchema.safeParse({ ...valid, ...patch }).success,
    ).toBe(false)
  })
})

describe('devPagePath', () => {
  it.each([
    ['limites', true],
    ['guias/criar-lead', true],
    ['guias/a/b', false],
    ['Guias/criar-lead', false],
    ['guias/', false],
    ['', false],
    ['api', false],
    ['api/extra', false],
    ['guias/api', true],
  ])('%s → %s', (value, ok) => {
    expect(devPagePath.safeParse(value).success).toBe(ok)
  })
})
