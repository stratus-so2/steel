import { describe, expect, it } from 'vitest'
import {
  isIdSegment,
  normalizeRoute,
  workspaceIdFromApiPath,
  workspaceSlugFromPath,
} from '../analytics/route'

const CUID = 'k3v9x0q2m1n8b7c6z5a4s3d2'

describe('normalizeRoute()', () => {
  it.each([
    ['/', '/'],
    ['', '/'],
    [`/api/workspaces/${CUID}/crm/leads`, '/api/workspaces/[id]/crm/leads'],
    [
      `/api/workspaces/${CUID}/crm/leads/${CUID}/notes`,
      '/api/workspaces/[id]/crm/leads/[id]/notes',
    ],
    ['/api/status/history?days=90', '/api/status/history'],
    ['/api/users/me/avatar', '/api/users/me/avatar'],
    ['/api/whatsapp/contacts/5511999998888', '/api/whatsapp/contacts/[id]'],
    ['/api/x/3f2c1b0a-9d8e-4f7a-b6c5-d4e3f2a1b0c9', '/api/x/[id]'],
    ['/api/x/deadbeefdeadbeef00', '/api/x/[id]'],
    ['/api/x/joao%40acme.com', '/api/x/[id]'],
    ['/api/x/proto-2026091900001', '/api/x/[id]'],
    ['/acme/crm/leads', '/[workspace]/crm/leads'],
    [`/${CUID}`, '/[id]'],
    ['/f/abcDEF123token', '/f/[token]'],
    ['/unsubscribe/xyz', '/unsubscribe/[token]'],
    ['/admin/workspaces', '/admin/workspaces'],
    ['/api/x/%E0%A4%A', '/api/x/%E0%A4%A'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeRoute(input)).toBe(expected)
  })

  it('keeps a long word without digits (not a cuid)', () => {
    expect(isIdSegment('opportunitiesandstagesx')).toBe(false)
    expect(isIdSegment('v1')).toBe(false)
  })

  it('treats long url-safe tokens as ids', () => {
    expect(isIdSegment('A'.repeat(40))).toBe(true)
  })
})

describe('workspaceSlugFromPath()', () => {
  it('returns the slug of a private page', () => {
    expect(workspaceSlugFromPath('/acme/crm?tab=1')).toBe('acme')
  })

  it('returns null for static roots, ids and invalid slugs', () => {
    expect(workspaceSlugFromPath('/api/workspaces')).toBeNull()
    expect(workspaceSlugFromPath('/')).toBeNull()
    expect(workspaceSlugFromPath(`/${CUID}`)).toBeNull()
    expect(workspaceSlugFromPath('/Acme_Corp')).toBeNull()
  })
})

describe('workspaceIdFromApiPath()', () => {
  it('extracts the workspace id of a workspace-scoped API', () => {
    expect(workspaceIdFromApiPath(`/api/workspaces/${CUID}/crm`)).toBe(CUID)
    expect(workspaceIdFromApiPath(`/api/workspaces/${CUID}`)).toBe(CUID)
  })

  it('ignores other paths and non-id segments', () => {
    expect(workspaceIdFromApiPath('/api/workspaces/slug')).toBeNull()
    expect(workspaceIdFromApiPath('/api/users/me')).toBeNull()
  })
})
