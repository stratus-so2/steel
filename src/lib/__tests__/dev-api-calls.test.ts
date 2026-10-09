import { describe, expect, it } from 'vitest'
import {
  extractApiCalls,
  matchSpecPath,
  matchSpecPrefix,
  specPathPattern,
} from '@/src/lib/dev/api-calls'

/** Writes JS template placeholders without tripping the lint: `#{x}`. */
const js = (text: string) => text.replaceAll('#{', '$' + '{')

const calls = (source: string) =>
  extractApiCalls(source).map(({ path, method, prefix }) => ({
    path,
    method,
    prefix,
  }))

describe('extractApiCalls', () => {
  it('reads the method of curl -X, fetch, requests and request lines', () => {
    const source = [
      'curl -X POST "$STEEL_URL/api/crm/integrations/leads" \\',
      '  -H "Authorization: Bearer $KEY"',
      '```',
      js(
        'const response = await fetch(`#{process.env.STEEL_URL}/api/crm/workflows/#{token}/trigger`, {',
      ),
      "  method: 'POST',",
      '})',
      '```',
      'response = requests.post(',
      '    f"{base}/api/servicedesk/monitoring/{token}",',
      ')',
      '```',
      'POST /api/integrations/gitlab/webhook HTTP/1.1',
    ].join('\n')

    expect(calls(source)).toEqual([
      { path: '/crm/integrations/leads', method: 'POST', prefix: false },
      {
        path: js('/crm/workflows/#{token}/trigger'),
        method: 'POST',
        prefix: false,
      },
      {
        path: '/servicedesk/monitoring/{token}',
        method: 'POST',
        prefix: false,
      },
      {
        path: '/integrations/gitlab/webhook',
        method: 'POST',
        prefix: false,
      },
    ])
  })

  it('pairs each path of a table row with the method written before it', () => {
    const row =
      '| `GET /api/crm/forms/<token>` e `POST /api/crm/forms/<token>/submit` | 100 |'
    expect(calls(row)).toEqual([
      { path: '/crm/forms/<token>', method: 'GET', prefix: false },
      { path: '/crm/forms/<token>/submit', method: 'POST', prefix: false },
    ])
  })

  it('treats a bare curl as GET, or POST when it sends data', () => {
    expect(calls('curl "$STEEL_URL/api/crm/forms/$TOKEN"')[0].method).toBe(
      'GET',
    )
    expect(
      calls('curl "$STEEL_URL/api/crm/forms/$TOKEN/submit" \\\n  -d \'{}\'')[0]
        .method,
    ).toBe('POST')
    expect(
      calls('curl -G "$STEEL_URL/api/a" \\\n  --data-urlencode "q=1"')[0]
        .method,
    ).toBe('GET')
  })

  it('treats a fetch without a method as GET', () => {
    expect(
      calls(
        js(
          'const r = await fetch(\n  `#{base}/api/workspaces/#{id}/notifications?#{q}`,\n)',
        ),
      ),
    ).toEqual([
      {
        path: js('/workspaces/#{id}/notifications'),
        method: 'GET',
        prefix: false,
      },
    ])
  })

  it('leaves the method unknown in prose and drops trailing punctuation', () => {
    expect(
      calls('A rota `/api/crm/integrations/leads`. E também /api/status.'),
    ).toEqual([
      { path: '/crm/integrations/leads', method: null, prefix: false },
      { path: '/status', method: null, prefix: false },
    ])
  })

  it('marks a trailing /... as a family of routes', () => {
    expect(
      calls('As rotas em `/api/workspaces/<id>/...` exigem sessão'),
    ).toEqual([{ path: '/workspaces/<id>', method: null, prefix: true }])
  })

  it('ignores the reference page and bare /api', () => {
    expect(calls('Veja [a referência](/dev/api) e o prefixo `/api`.')).toEqual(
      [],
    )
  })

  it('reports the line of each call', () => {
    expect(extractApiCalls('texto\n\n`/api/status`')[0].line).toBe(3)
  })
})

const PATHS = {
  '/crm/leads/reorder': { post: {} },
  '/crm/leads/{leadId}': { get: {}, patch: {}, parameters: [] },
  '/crm/forms/{publicToken}/submit': { post: {} },
  '/workspaces/{id}/notifications': { get: {} },
  '/status': { get: {} },
}

describe('specPathPattern', () => {
  it('turns template parameters into one segment', () => {
    const pattern = specPathPattern('/crm/forms/{publicToken}/submit')
    expect(pattern.test('/crm/forms/<token>/submit')).toBe(true)
    expect(pattern.test('/crm/forms/a/b/submit')).toBe(false)
    expect(specPathPattern('/a.b').test('/aXb')).toBe(false)
  })
})

describe('matchSpecPath', () => {
  it('prefers a literal template and lists its methods', () => {
    expect(matchSpecPath(PATHS, '/crm/leads/reorder')).toEqual({
      template: '/crm/leads/reorder',
      methods: ['POST'],
    })
    expect(matchSpecPath(PATHS, '/crm/leads/<id>')).toEqual({
      template: '/crm/leads/{leadId}',
      methods: ['GET', 'PATCH'],
    })
  })

  it('breaks ties between equally templated paths alphabetically', () => {
    const paths = { '/x/{b}': { get: {} }, '/x/{a}': { put: {} } }
    expect(matchSpecPath(paths, '/x/1')).toEqual({
      template: '/x/{a}',
      methods: ['PUT'],
    })
  })

  it('returns null for a route the spec does not have', () => {
    expect(matchSpecPath(PATHS, '/crm/leads')).toBeNull()
  })
})

describe('matchSpecPrefix', () => {
  it('finds a template that continues the prefix', () => {
    expect(matchSpecPrefix(PATHS, '/workspaces/<id>')).toBe(
      '/workspaces/{id}/notifications',
    )
    expect(matchSpecPrefix(PATHS, '/crm/forms/abc')).toBe(
      '/crm/forms/{publicToken}/submit',
    )
  })

  it('returns null when nothing continues it', () => {
    expect(matchSpecPrefix(PATHS, '/status')).toBeNull()
    expect(matchSpecPrefix(PATHS, '/billing')).toBeNull()
  })
})
