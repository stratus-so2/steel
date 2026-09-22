import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-access.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')

import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import {
  canReadSdKbArticle,
  isSdKbPortalReadable,
  resolveSdKbEditor,
  resolveSdKbReader,
} from '../sd-kb-access'

beforeEach(() => {
  vi.mocked(WorkspaceModuleAccessRepository).isEnabled.mockResolvedValue(
    ok(true),
  )
})

const live = { status: 'PUBLISHED', visibility: 'PORTAL', archivedAt: null }

describe('sd-kb-access', () => {
  it('lets requesters and viewers read', async () => {
    actAs('requester')
    expect(expectOk(await resolveSdKbReader('u1', 'ws1')).isAgent).toBe(false)
    actAs('viewer-agent')
    expect(expectOk(await resolveSdKbReader('u1', 'ws1')).isAgent).toBe(true)
  })

  it('requires an agent with the matrix action to edit', async () => {
    actAs('requester')
    expectErr(await resolveSdKbEditor('u1', 'ws1', 'EDIT'), 'SD_NOT_AGENT')
    actAs('viewer-agent')
    expectErr(await resolveSdKbEditor('u1', 'ws1', 'EDIT'), 'FORBIDDEN')
    actAs('agent')
    expectOk(await resolveSdKbEditor('u1', 'ws1', 'CREATE'))
    expectErr(await resolveSdKbEditor('u1', 'ws1', 'DELETE'), 'FORBIDDEN')
    actAs('admin')
    expectOk(await resolveSdKbEditor('u1', 'ws1', 'DELETE'))
  })

  it('portal readability needs published + portal + not archived', () => {
    expect(isSdKbPortalReadable(live)).toBe(true)
    expect(isSdKbPortalReadable({ ...live, status: 'DRAFT' })).toBe(false)
    expect(isSdKbPortalReadable({ ...live, visibility: 'INTERNAL' })).toBe(
      false,
    )
    expect(isSdKbPortalReadable({ ...live, archivedAt: new Date() })).toBe(
      false,
    )
    expect(
      canReadSdKbArticle({ isAgent: true }, { ...live, status: 'DRAFT' }),
    ).toBe(true)
    expect(
      canReadSdKbArticle({ isAgent: false }, { ...live, status: 'DRAFT' }),
    ).toBe(false)
  })
})
