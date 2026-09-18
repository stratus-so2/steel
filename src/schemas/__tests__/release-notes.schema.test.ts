import { describe, expect, it } from 'vitest'
import { ReleaseDraftRequestSchema } from '../release-notes.schema'

describe('ReleaseDraftRequestSchema', () => {
  it('accepts a GitHub request', () => {
    expect(
      ReleaseDraftRequestSchema.safeParse({ source: 'github' }).success,
    ).toBe(true)
  })

  it('requires non-blank markdown for a manual request', () => {
    expect(
      ReleaseDraftRequestSchema.safeParse({ source: 'manual', markdown: '  ' })
        .success,
    ).toBe(false)
    expect(
      ReleaseDraftRequestSchema.safeParse({
        source: 'manual',
        markdown: '- feat: x',
      }).success,
    ).toBe(true)
  })

  it('rejects an unknown source', () => {
    expect(
      ReleaseDraftRequestSchema.safeParse({ source: 'gitlab' }).success,
    ).toBe(false)
  })
})
