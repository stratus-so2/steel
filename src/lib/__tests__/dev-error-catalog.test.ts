import { describe, expect, it } from 'vitest'
import { ERROR_CODES, type ErrorCode } from '@/src/errors/codes'
import {
  buildErrorCatalog,
  errorCatalogMarkdown,
} from '@/src/lib/dev/error-catalog'

describe('buildErrorCatalog', () => {
  const catalog = buildErrorCatalog()

  it('lists every code of the registry exactly once, under its status', () => {
    const listed = catalog.flatMap((group) =>
      group.codes.map((entry) => entry.code),
    )
    expect([...listed].sort()).toEqual(Object.keys(ERROR_CODES).sort())
    for (const group of catalog) {
      for (const entry of group.codes) {
        expect(ERROR_CODES[entry.code].status).toBe(group.status)
      }
    }
  })

  it('orders groups by status and codes alphabetically', () => {
    const statuses = catalog.map((group) => group.status)
    expect(statuses).toEqual([...statuses].sort((a, b) => a - b))
    for (const group of catalog) {
      const codes = group.codes.map((entry) => entry.code)
      expect(codes).toEqual([...codes].sort())
    }
  })

  it('titles each status and carries the default factory message', () => {
    const forbidden = catalog.find((group) => group.status === 403)
    expect(forbidden?.title).toBe('Acesso negado')
    const rateLimited = catalog
      .flatMap((group) => group.codes)
      .find((entry) => entry.code === 'RATE_LIMITED')
    expect(rateLimited?.message).toBe('Muitas requisições')
  })

  it('falls back to a generic title and a null message', () => {
    const groups = buildErrorCatalog(['UNAUTHORIZED', 'CONFLICT'])
    expect(groups.map((group) => group.status)).toEqual([401, 409])

    // A code with no zero-argument factory has no default message.
    const bare = buildErrorCatalog(Object.keys(ERROR_CODES) as ErrorCode[])
      .flatMap((group) => group.codes)
      .filter((entry) => entry.message === null)
    expect(bare.length).toBeGreaterThan(0)
  })

  it('names a status without a title by its number', () => {
    expect(buildErrorCatalog(['RATE_LIMITED'])[0].title).toBe(
      'Limite de requisições excedido',
    )
    expect(buildErrorCatalog(['RATE_LIMITED'], {})[0].title).toBe('HTTP 429')
  })

  it('has a title for every status the registry uses', () => {
    for (const group of catalog) {
      expect(group.title).not.toMatch(/^HTTP /)
    }
  })
})

describe('errorCatalogMarkdown', () => {
  it('renders one table per status, escaping pipes', () => {
    const markdown = errorCatalogMarkdown([
      {
        status: 418,
        title: 'HTTP 418',
        codes: [
          { code: 'CONFLICT', message: 'a | b\nc' },
          { code: 'BAD_REQUEST', message: null },
        ],
      },
    ])
    expect(markdown).toBe(
      [
        '#### 418 — HTTP 418',
        '',
        '| Código | Mensagem padrão |',
        '| ------ | --------------- |',
        '| `CONFLICT` | a \\| b c |',
        '| `BAD_REQUEST` | — |',
      ].join('\n'),
    )
  })

  it('defaults to the whole registry', () => {
    const markdown = errorCatalogMarkdown()
    for (const code of Object.keys(ERROR_CODES)) {
      expect(markdown).toContain(`| \`${code}\` |`)
    }
  })
})
