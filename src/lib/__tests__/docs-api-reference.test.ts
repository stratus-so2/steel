import { describe, expect, it } from 'vitest'
import {
  API_REFERENCE_TITLE,
  buildApiReferenceHtml,
  SCALAR_INTEGRITY,
  SCALAR_SRC,
} from '@/src/lib/docs/api-reference'
import { toPublicOpenApi } from '@/src/lib/docs/public-openapi'

describe('buildApiReferenceHtml', () => {
  const html = buildApiReferenceHtml({
    nonce: 'abc"<',
    specUrl: '/dev/api/openapi.json',
    canonicalUrl: 'https://steel.test/dev/api',
  })

  it('loads a pinned Scalar bundle with SRI and the request nonce', () => {
    expect(SCALAR_SRC).toMatch(/@scalar\/api-reference@\d+\.\d+\.\d+\//)
    expect(html).toContain(`src="${SCALAR_SRC}"`)
    expect(html).toContain(`integrity="${SCALAR_INTEGRITY}"`)
    // Two scripts, both carrying the escaped nonce.
    expect(html.match(/nonce="abc&quot;&lt;"/g)).toHaveLength(2)
  })

  it('carries the title, canonical and spec url', () => {
    expect(html).toContain(`<title>${API_REFERENCE_TITLE}</title>`)
    expect(html).toContain(
      '<link rel="canonical" href="https://steel.test/dev/api" />',
    )
    expect(html).toContain('"url":"/dev/api/openapi.json"')
  })
})

describe('toPublicOpenApi', () => {
  const spec = {
    openapi: '3.1.0',
    servers: [{ url: 'http://localhost:3001/api' }],
    tags: [{ name: 'CRM · Leads' }, { name: 'Admin · Métricas' }],
    'x-tagGroups': [
      { name: 'CRM', tags: ['CRM · Leads'] },
      { name: 'Admin', tags: ['Admin · Métricas'] },
    ],
    paths: {
      '/crm/leads': { get: { tags: ['CRM · Leads'] } },
      '/workspaces/{id}': { get: {} },
      '/admin/metrics': { get: { tags: ['Admin · Métricas'] } },
      '/admin': { get: { tags: ['Admin · Métricas'] } },
      '/status/collect/core': { post: {} },
      '/administrators': { get: { tags: ['CRM · Leads'] } },
    },
  }

  it('drops the internal routes, their tags and empty tag groups', () => {
    const out = toPublicOpenApi(spec, 'https://steel.test')
    expect(Object.keys(out.paths ?? {})).toEqual([
      '/crm/leads',
      '/workspaces/{id}',
      '/administrators',
    ])
    expect(out.tags).toEqual([{ name: 'CRM · Leads' }])
    expect(out['x-tagGroups']).toEqual([{ name: 'CRM', tags: ['CRM · Leads'] }])
    expect(out.servers).toEqual([
      { url: 'https://steel.test/api', description: 'Steel' },
    ])
    expect(out.openapi).toBe('3.1.0')
  })

  it('tolerates a spec without paths, tags or groups', () => {
    expect(toPublicOpenApi({}, 'https://x.test')).toMatchObject({
      paths: {},
      tags: [],
      'x-tagGroups': [],
    })
  })
})
