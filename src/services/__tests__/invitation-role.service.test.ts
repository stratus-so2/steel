import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auditMutation } from '@/lib/axiom/audit'
import { createFakeInvitation } from '@/src/__tests__/factories/invitation.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { InvitationRepository } from '@/src/repositories/invitation.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { InvitationService } from '@/src/services/invitation.service'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/invitation.repository')
vi.mock('@/src/repositories/membership.repository')

const mockedInvite = vi.mocked(InvitationRepository)
const mockedMembership = vi.mocked(MembershipRepository)

function actor(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembership.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'actor', workspaceId: 'ws1', role })),
  )
}

beforeEach(() => {
  vi.resetAllMocks()
})

describe('InvitationService.updateRole()', () => {
  it('changes the role of a pending invitation and audits it', async () => {
    actor('ADMIN')
    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ id: 'inv1', workspaceId: 'ws1' })),
    )
    mockedInvite.updateRole.mockResolvedValue(
      ok(
        createFakeInvitation({
          id: 'inv1',
          workspaceId: 'ws1',
          role: 'VIEWER',
        }),
      ),
    )

    const result = await InvitationService.updateRole(
      'actor',
      'ws1',
      'inv1',
      'VIEWER',
    )

    expect(expectOk(result).role).toBe('VIEWER')
    expect(mockedInvite.updateRole).toHaveBeenCalledWith('inv1', 'VIEWER')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'invitation',
        action: 'update',
        reason: 'role_change',
        meta: { workspaceId: 'ws1', role: 'VIEWER' },
      }),
    )
  })

  it('forbids a VIEWER', async () => {
    actor('VIEWER')

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'FORBIDDEN',
    )
    expect(mockedInvite.findById).not.toHaveBeenCalled()
  })

  it('hides an invitation of another workspace', async () => {
    actor('OWNER')
    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ id: 'inv1', workspaceId: 'other' })),
    )

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'INVITATION_NOT_FOUND',
    )
  })

  it('returns INVITATION_NOT_FOUND for a missing invitation', async () => {
    actor('OWNER')
    mockedInvite.findById.mockResolvedValue(ok(null))

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'INVITATION_NOT_FOUND',
    )
  })

  it('refuses an invitation that is no longer pending', async () => {
    actor('OWNER')
    mockedInvite.findById.mockResolvedValue(
      ok(
        createFakeInvitation({
          id: 'inv1',
          workspaceId: 'ws1',
          status: 'ACCEPTED',
        }),
      ),
    )

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'INVITATION_NOT_PENDING',
    )
  })

  it('propagates repository errors', async () => {
    actor('OWNER')
    mockedInvite.findById.mockResolvedValueOnce(err(databaseError('boom')))

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'DATABASE_ERROR',
    )

    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ id: 'inv1', workspaceId: 'ws1' })),
    )
    mockedInvite.updateRole.mockResolvedValue(err(databaseError('boom')))

    expectErr(
      await InvitationService.updateRole('actor', 'ws1', 'inv1', 'ADMIN'),
      'DATABASE_ERROR',
    )
    expect(auditMutation).not.toHaveBeenCalled()
  })
})
