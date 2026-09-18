import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calVerToSemver, isCalVerTag, semverToCalVer } from '@/lib/version'

const root = join(__dirname, '..', '..')

describe('calVerToSemver', () => {
  it('drops leading zeros for the first release of the day', () => {
    expect(calVerToSemver('2026.08.31')).toBe('2026.8.31')
  })

  it('maps the same-day counter to a prerelease suffix', () => {
    expect(calVerToSemver('2026.08.28.4')).toBe('2026.8.28-4')
  })

  it('rejects non-CalVer tags', () => {
    expect(isCalVerTag('v2.2.0')).toBe(false)
    expect(() => calVerToSemver('2.2.0')).toThrow(/CalVer/)
  })
})

describe('semverToCalVer', () => {
  it('restores the zero-padded CalVer tag', () => {
    expect(semverToCalVer('2026.8.31')).toBe('2026.08.31')
    expect(semverToCalVer('2026.8.28-4')).toBe('2026.08.28.4')
  })

  it('round-trips with calVerToSemver', () => {
    for (const tag of ['2026.01.02', '2026.12.31.7']) {
      expect(semverToCalVer(calVerToSemver(tag))).toBe(tag)
    }
  })

  it('rejects versions that did not come from a CalVer tag', () => {
    expect(() => semverToCalVer('2.2.0')).toThrow(/CalVer/)
  })
})

describe('versioned files', () => {
  it('keep package.json and openapi info.version on the same CalVer release', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'))
    const openapi = JSON.parse(
      readFileSync(join(root, 'public/openapi.json'), 'utf-8'),
    )

    expect(isCalVerTag(openapi.info.version)).toBe(true)
    expect(pkg.version).toBe(calVerToSemver(openapi.info.version))
  })
})
