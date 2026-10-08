import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WikiSettingsRepository } from '@/src/repositories/wiki-settings.repository'
import { assertWikiMember } from '../_wiki-access'
import { WikiSettingsService } from '../wiki-settings.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/wiki-settings.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

const mockedMembership = vi.mocked(MembershipRepository)
const mockedSettings = vi.mocked(WikiSettingsRepository)

function asRole(role: 'OWNER' | 'MEMBER') {
  mockedMembership.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'actor', workspaceId: 'ws1', role })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('OWNER')
})

describe('WikiSettingsService', () => {
  it('should read the toggle for any member', async () => {
    asRole('MEMBER')
    mockedSettings.isEnabled.mockResolvedValue(ok(false))

    const settings = expectOk(await WikiSettingsService.get('actor', 'ws1'))

    expect(settings).toEqual({ enabled: false })
  })

  it('should not reveal the toggle to a non-member', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(err(forbidden()))

    expectErr(await WikiSettingsService.get('actor', 'ws1'), 'FORBIDDEN')
  })

  it('should propagate a read failure', async () => {
    mockedSettings.isEnabled.mockResolvedValue(err(databaseError('x')))

    expectErr(await WikiSettingsService.get('actor', 'ws1'), 'DATABASE_ERROR')
  })

  it('should let an owner turn the wiki on', async () => {
    mockedSettings.setEnabled.mockResolvedValue(ok(true))

    const settings = expectOk(
      await WikiSettingsService.update('actor', 'ws1', { enabled: true }),
    )

    expect(settings).toEqual({ enabled: true })
    expect(mockedSettings.setEnabled).toHaveBeenCalledWith('ws1', true)
  })

  it('should not let a plain member flip it', async () => {
    asRole('MEMBER')

    expectErr(
      await WikiSettingsService.update('actor', 'ws1', { enabled: true }),
      'FORBIDDEN',
    )
    expect(mockedSettings.setEnabled).not.toHaveBeenCalled()
  })

  it('should propagate a write failure', async () => {
    mockedSettings.setEnabled.mockResolvedValue(err(databaseError('x')))

    expectErr(
      await WikiSettingsService.update('actor', 'ws1', { enabled: false }),
      'DATABASE_ERROR',
    )
  })
})

describe('assertWikiMember()', () => {
  it('should pass a member when the wiki is on', async () => {
    asRole('MEMBER')
    mockedSettings.isEnabled.mockResolvedValue(ok(true))

    expectOk(await assertWikiMember('actor', 'ws1'))
  })

  it('should return WIKI_DISABLED when the wiki is off', async () => {
    mockedSettings.isEnabled.mockResolvedValue(ok(false))

    expectErr(await assertWikiMember('actor', 'ws1'), 'WIKI_DISABLED')
  })

  it('should check membership before the toggle', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(err(forbidden()))

    expectErr(await assertWikiMember('actor', 'ws1'), 'FORBIDDEN')
    expect(mockedSettings.isEnabled).not.toHaveBeenCalled()
  })

  it('should propagate a toggle read failure', async () => {
    mockedSettings.isEnabled.mockResolvedValue(err(databaseError('x')))

    expectErr(await assertWikiMember('actor', 'ws1'), 'DATABASE_ERROR')
  })
})
