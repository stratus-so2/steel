import type { Role } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auditMutation } from '@/lib/axiom/audit'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhiteboardSettingsRepository } from '@/src/repositories/whiteboard.repository'
import { WhiteboardSettingsService } from '../whiteboard-settings.service'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whiteboard.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

const memberships = vi.mocked(MembershipRepository)
const settings = vi.mocked(WhiteboardSettingsRepository)

function as(role: Role) {
  memberships.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'a', workspaceId: 'ws', role })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('WhiteboardSettingsService', () => {
  it('lets any member read the switch', async () => {
    as('VIEWER')
    settings.isEnabled.mockResolvedValue(ok(true))
    expect(expectOk(await WhiteboardSettingsService.get('a', 'ws'))).toEqual({
      enabled: true,
    })
  })

  it('propagates read errors and denies non-members', async () => {
    as('MEMBER')
    settings.isEnabled.mockResolvedValue(err(databaseError()))
    expectErr(await WhiteboardSettingsService.get('a', 'ws'), 'DATABASE_ERROR')
    memberships.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await WhiteboardSettingsService.get('a', 'ws'), 'FORBIDDEN')
  })

  it('lets OWNER/ADMIN flip it, audited', async () => {
    as('ADMIN')
    settings.setEnabled.mockResolvedValue(ok(false))

    expect(
      expectOk(
        await WhiteboardSettingsService.update('a', 'ws', { enabled: false }),
      ),
    ).toEqual({ enabled: false })
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'whiteboard_settings',
        meta: { enabled: false },
      }),
    )
  })

  it('refuses a MEMBER and audits a failed write', async () => {
    as('MEMBER')
    expectErr(
      await WhiteboardSettingsService.update('a', 'ws', { enabled: false }),
      'FORBIDDEN',
    )
    expect(settings.setEnabled).not.toHaveBeenCalled()

    as('OWNER')
    settings.setEnabled.mockResolvedValue(err(databaseError()))
    expectErr(
      await WhiteboardSettingsService.update('a', 'ws', { enabled: true }),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })
})
