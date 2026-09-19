import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeInvitation } from '@/src/__tests__/factories/invitation.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeProject } from '@/src/__tests__/factories/project.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { sendInviteUserToWorkspaceEmail } from '@/src/lib/mail/workspace/send-invite-user-to-workspace'
import { err, ok } from '@/src/lib/result'
import { InvitationRepository } from '@/src/repositories/invitation.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { ProjectRepository } from '@/src/repositories/project.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { InvitationService } from '../invitation.service'

vi.mock('@/src/cache/user.cache')
vi.mock('@/src/repositories/invitation.repository')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/project.repository')
vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/lib/mail/workspace/send-invite-user-to-workspace')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'

const mockedInvite = vi.mocked(InvitationRepository)
const mockedMembership = vi.mocked(MembershipRepository)
const mockedProject = vi.mocked(ProjectRepository)
const mockedUser = vi.mocked(UserRepository)
const mockedWorkspace = vi.mocked(WorkspaceRepository)
const mockedEmail = vi.mocked(sendInviteUserToWorkspaceEmail)

const dbError = err(databaseError('boom'))
const owner = createFakeMembership({ userId: 'actor', role: 'OWNER' })
const plain = createFakeMembership({ userId: 'actor', role: 'MEMBER' })
const dto = { email: ' New@Example.com ', role: 'MEMBER' as const }

function project(leadId = 'lead') {
  return {
    ...createFakeProject({ id: 'proj', workspaceId: 'ws1', leadId }),
    members: [] as { userId: string }[],
    favourites: [] as { id: string }[],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedMembership.findByUserAndWorkspace.mockResolvedValue(ok(owner))
  mockedUser.findById.mockResolvedValue(ok(createFakeUser({ id: 'actor' })))
  mockedUser.findByEmail.mockResolvedValue(ok(null))
  mockedWorkspace.findById.mockResolvedValue(
    ok(createFakeWorkspace({ id: 'ws1', activePlan: 'FREE' })),
  )
  mockedMembership.countByWorkspace.mockResolvedValue(ok(0))
  mockedInvite.countPendingByWorkspace.mockResolvedValue(ok(0))
  mockedInvite.findPendingByWorkspaceAndEmail.mockResolvedValue(ok(null))
  mockedInvite.create.mockResolvedValue(
    ok(createFakeInvitation({ workspaceId: 'ws1', email: 'new@example.com' })),
  )
  mockedEmail.mockResolvedValue({ id: 'email-1' } as never)
  mockedProject.findByWorkspaceAndSlug.mockResolvedValue(ok(project('actor')))
})

describe('InvitationService.create() — failure paths', () => {
  it('normalizes the e-mail before looking it up', async () => {
    expectOk(await InvitationService.create('actor', 'ws1', dto))

    expect(mockedUser.findByEmail).toHaveBeenCalledWith('new@example.com')
    expect(mockedInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new@example.com', projectId: null }),
    )
  })

  it('propagates user, membership and pending lookups errors', async () => {
    mockedUser.findByEmail.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )

    mockedUser.findByEmail.mockResolvedValueOnce(
      ok(createFakeUser({ id: 'target' })),
    )
    mockedMembership.findByUserAndWorkspace
      .mockResolvedValueOnce(ok(owner))
      .mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )

    mockedInvite.findPendingByWorkspaceAndEmail.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )
    expect(mockedInvite.create).not.toHaveBeenCalled()
  })

  it('invites a registered user who is not a member yet', async () => {
    mockedUser.findByEmail.mockResolvedValue(
      ok(createFakeUser({ id: 'target' })),
    )
    mockedMembership.findByUserAndWorkspace
      .mockResolvedValueOnce(ok(owner))
      .mockResolvedValueOnce(ok(null))

    expectOk(await InvitationService.create('actor', 'ws1', dto))
    expect(mockedInvite.create).toHaveBeenCalled()
  })

  it('expires a stale pending invite and issues a new one', async () => {
    const stale = createFakeInvitation({
      id: 'old',
      expiresAt: new Date(Date.now() - 1000),
    })
    mockedInvite.findPendingByWorkspaceAndEmail.mockResolvedValue(ok(stale))

    expectOk(await InvitationService.create('actor', 'ws1', dto))

    expect(mockedInvite.updateStatus).toHaveBeenCalledWith('old', 'EXPIRED')
    expect(mockedInvite.create).toHaveBeenCalled()
  })

  it('propagates seat-check errors (workspace, members, pending)', async () => {
    mockedWorkspace.findById.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )

    mockedMembership.countByWorkspace.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )

    mockedInvite.countPendingByWorkspace.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )
    expect(mockedInvite.create).not.toHaveBeenCalled()
  })

  it('propagates the insert error without e-mailing', async () => {
    mockedInvite.create.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.create('actor', 'ws1', dto),
      'DATABASE_ERROR',
    )
    expect(mockedEmail).not.toHaveBeenCalled()
  })
})

describe('InvitationService.dispatchEmail()', () => {
  it('skips the e-mail when the inviter or workspace cannot be loaded', async () => {
    mockedUser.findById.mockResolvedValueOnce(dbError)
    await InvitationService.dispatchEmail('actor', 'ws1', 'tok', 'a@b.com')

    mockedWorkspace.findById.mockResolvedValueOnce(dbError)
    await InvitationService.dispatchEmail('actor', 'ws1', 'tok', 'a@b.com')

    expect(mockedEmail).not.toHaveBeenCalled()
  })

  it('sends the accept link with the inviter identity', async () => {
    mockedUser.findById.mockResolvedValue(
      ok(
        createFakeUser({ id: 'actor', name: 'Ana', image: 'https://x/a.png' }),
      ),
    )

    await InvitationService.dispatchEmail('actor', 'ws1', 'tok123', 'a@b.com')

    expect(mockedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'a@b.com',
        inviterName: 'Ana',
        inviterImage: 'https://x/a.png',
        redirectUrl: expect.stringContaining('/invite/accept?token=tok123'),
      }),
    )
  })

  it.each([
    [new Error('resend 500'), 'resend 500'],
    ['weird', 'unknown'],
  ])('never throws when the mailer fails (%s)', async (failure, message) => {
    mockedEmail.mockRejectedValueOnce(failure)

    await expect(
      InvitationService.dispatchEmail('actor', 'ws1', 'tok', 'a@b.com'),
    ).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith('invitation.email_failed', {
      workspaceId: 'ws1',
      error: message,
    })
  })
})

describe('InvitationService.list()', () => {
  it('lists the workspace invitations as DTOs', async () => {
    const invite = createFakeInvitation({ id: 'i1', workspaceId: 'ws1' })
    mockedInvite.listByWorkspace.mockResolvedValue(ok([invite]))

    const list = expectOk(await InvitationService.list('actor', 'ws1'))

    expect(list).toHaveLength(1)
    expect(list[0].id).toBe('i1')
  })

  it('forbids plain members and propagates repository errors', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValueOnce(ok(plain))
    expectErr(await InvitationService.list('actor', 'ws1'), 'FORBIDDEN')

    mockedInvite.listByWorkspace.mockResolvedValue(dbError)
    expectErr(await InvitationService.list('actor', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('InvitationService.revoke() / resend() — failure paths', () => {
  it.each([
    'revoke',
    'resend',
  ] as const)('%s: forbids plain members', async (method) => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(ok(plain))

    expectErr(
      await InvitationService[method]('actor', 'ws1', 'i1'),
      'FORBIDDEN',
    )
    expect(mockedInvite.findById).not.toHaveBeenCalled()
  })

  it.each([
    'revoke',
    'resend',
  ] as const)('%s: propagates lookup errors and hides missing invites', async (method) => {
    mockedInvite.findById.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService[method]('actor', 'ws1', 'i1'),
      'DATABASE_ERROR',
    )

    mockedInvite.findById.mockResolvedValueOnce(ok(null))
    expectErr(
      await InvitationService[method]('actor', 'ws1', 'i1'),
      'INVITATION_NOT_FOUND',
    )
  })

  it('revoke: rejects invites that are no longer pending', async () => {
    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ workspaceId: 'ws1', status: 'ACCEPTED' })),
    )

    expectErr(
      await InvitationService.revoke('actor', 'ws1', 'i1'),
      'INVITATION_NOT_PENDING',
    )
  })

  it('revoke: propagates the status update error', async () => {
    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ workspaceId: 'ws1' })),
    )
    mockedInvite.updateStatus.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.revoke('actor', 'ws1', 'i1'),
      'DATABASE_ERROR',
    )
  })

  it('resend: rejects revoked invites but re-sends expired ones', async () => {
    mockedInvite.findById.mockResolvedValueOnce(
      ok(createFakeInvitation({ workspaceId: 'ws1', status: 'REVOKED' })),
    )
    expectErr(
      await InvitationService.resend('actor', 'ws1', 'i1'),
      'INVITATION_NOT_PENDING',
    )

    const expired = createFakeInvitation({
      id: 'i1',
      workspaceId: 'ws1',
      status: 'EXPIRED',
    })
    mockedInvite.findById.mockResolvedValueOnce(ok(expired))
    mockedInvite.refreshToken.mockResolvedValueOnce(ok(expired))
    expectOk(await InvitationService.resend('actor', 'ws1', 'i1'))
    expect(mockedEmail).toHaveBeenCalled()
  })

  it('resend: propagates the token refresh error', async () => {
    mockedInvite.findById.mockResolvedValue(
      ok(createFakeInvitation({ workspaceId: 'ws1' })),
    )
    mockedInvite.refreshToken.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.resend('actor', 'ws1', 'i1'),
      'DATABASE_ERROR',
    )
    expect(mockedEmail).not.toHaveBeenCalled()
  })
})

describe('InvitationService.accept() — failure paths', () => {
  const invite = {
    ...createFakeInvitation({
      workspaceId: 'ws1',
      email: 'invitee@example.com',
    }),
    workspace: createFakeWorkspace({ id: 'ws1', slug: 'acme' }),
  }

  it('propagates token lookup errors', async () => {
    mockedInvite.findByToken.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.accept('u', 'invitee@example.com', 't'),
      'DATABASE_ERROR',
    )
  })

  it('distinguishes EXPIRED from other non-pending statuses', async () => {
    mockedInvite.findByToken.mockResolvedValueOnce(
      ok({ ...invite, status: 'EXPIRED' }),
    )
    expectErr(
      await InvitationService.accept('u', 'invitee@example.com', 't'),
      'INVITATION_EXPIRED',
    )

    mockedInvite.findByToken.mockResolvedValueOnce(
      ok({ ...invite, status: 'REVOKED' }),
    )
    expectErr(
      await InvitationService.accept('u', 'invitee@example.com', 't'),
      'INVITATION_NOT_PENDING',
    )
  })

  it('propagates seat-check and accept errors', async () => {
    mockedInvite.findByToken.mockResolvedValue(ok(invite))
    mockedWorkspace.findById.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.accept('u', 'invitee@example.com', 't'),
      'DATABASE_ERROR',
    )

    mockedInvite.accept.mockResolvedValue(dbError)
    expectErr(
      await InvitationService.accept('u', 'invitee@example.com', 't'),
      'DATABASE_ERROR',
    )
  })
})

describe('InvitationService — project invitations failure paths', () => {
  const projectDto = { email: 'x@example.com', role: 'MEMBER' as const }

  it('propagates project lookup errors from the manager gate', async () => {
    mockedProject.findByWorkspaceAndSlug.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.listForProject('actor', 'ws1', 'proj'),
      'DATABASE_ERROR',
    )
  })

  it('lets a plain member who leads the project manage invitations', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValue(ok(plain))
    mockedInvite.listByProject.mockResolvedValue(ok([]))

    expect(
      expectOk(await InvitationService.listForProject('actor', 'ws1', 'proj')),
    ).toEqual([])
  })

  it('listForProject: propagates repository errors', async () => {
    mockedInvite.listByProject.mockResolvedValue(dbError)

    expectErr(
      await InvitationService.listForProject('actor', 'ws1', 'proj'),
      'DATABASE_ERROR',
    )
  })

  it('createForProject: propagates user, membership, add and pending errors', async () => {
    mockedUser.findByEmail.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'DATABASE_ERROR',
    )

    mockedUser.findByEmail.mockResolvedValue(ok(createFakeUser({ id: 't' })))
    mockedMembership.findByUserAndWorkspace
      .mockResolvedValueOnce(ok(owner))
      .mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'DATABASE_ERROR',
    )

    mockedMembership.findByUserAndWorkspace
      .mockResolvedValueOnce(ok(owner))
      .mockResolvedValueOnce(ok(createFakeMembership({ userId: 't' })))
    mockedProject.addMember.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'DATABASE_ERROR',
    )

    mockedUser.findByEmail.mockResolvedValue(ok(null))
    mockedInvite.findPendingByWorkspaceAndEmail.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'DATABASE_ERROR',
    )
  })

  it('createForProject: invites a registered non-member and replaces an expired invite', async () => {
    mockedUser.findByEmail.mockResolvedValue(ok(createFakeUser({ id: 't' })))
    mockedMembership.findByUserAndWorkspace
      .mockResolvedValueOnce(ok(owner))
      .mockResolvedValueOnce(ok(null))
    mockedInvite.findPendingByWorkspaceAndEmail.mockResolvedValue(
      ok(createFakeInvitation({ id: 'old', expiresAt: new Date(0) })),
    )

    const result = expectOk(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
    )

    expect(result.kind).toBe('invited')
    expect(mockedInvite.updateStatus).toHaveBeenCalledWith('old', 'EXPIRED')
    expect(mockedInvite.create).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj' }),
    )
  })

  it('createForProject: propagates seat and insert errors', async () => {
    mockedMembership.countByWorkspace.mockResolvedValueOnce(ok(12))
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'SEAT_LIMIT_REACHED',
    )

    mockedInvite.create.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.createForProject(
        'actor',
        'ws1',
        'proj',
        projectDto,
      ),
      'DATABASE_ERROR',
    )
  })

  it('revokeForProject: covers forbidden, lookup, status and update failures', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValueOnce(ok(null))
    expectErr(
      await InvitationService.revokeForProject('actor', 'ws1', 'proj', 'i1'),
      'FORBIDDEN',
    )

    mockedInvite.findById.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.revokeForProject('actor', 'ws1', 'proj', 'i1'),
      'DATABASE_ERROR',
    )

    mockedInvite.findById.mockResolvedValueOnce(
      ok(createFakeInvitation({ projectId: 'proj', status: 'REVOKED' })),
    )
    expectErr(
      await InvitationService.revokeForProject('actor', 'ws1', 'proj', 'i1'),
      'INVITATION_NOT_PENDING',
    )

    mockedInvite.findById.mockResolvedValueOnce(
      ok(createFakeInvitation({ projectId: 'proj' })),
    )
    mockedInvite.updateStatus.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.revokeForProject('actor', 'ws1', 'proj', 'i1'),
      'DATABASE_ERROR',
    )
  })

  it('resendForProject: covers forbidden, lookup and refresh failures', async () => {
    mockedMembership.findByUserAndWorkspace.mockResolvedValueOnce(ok(null))
    expectErr(
      await InvitationService.resendForProject('actor', 'ws1', 'proj', 'i1'),
      'FORBIDDEN',
    )

    mockedInvite.findById.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.resendForProject('actor', 'ws1', 'proj', 'i1'),
      'DATABASE_ERROR',
    )

    mockedInvite.findById.mockResolvedValueOnce(
      ok(createFakeInvitation({ projectId: 'proj', status: 'REVOKED' })),
    )
    expectErr(
      await InvitationService.resendForProject('actor', 'ws1', 'proj', 'i1'),
      'INVITATION_NOT_PENDING',
    )

    mockedInvite.findById.mockResolvedValueOnce(
      ok(createFakeInvitation({ projectId: 'proj' })),
    )
    mockedInvite.refreshToken.mockResolvedValueOnce(dbError)
    expectErr(
      await InvitationService.resendForProject('actor', 'ws1', 'proj', 'i1'),
      'DATABASE_ERROR',
    )
  })
})
