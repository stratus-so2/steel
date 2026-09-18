import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedInvitation } from '@/src/__tests__/factories/invitation.factory'
import { seedProject } from '@/src/__tests__/factories/project.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { InvitationRepository } from '../invitation.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

async function seedInviterAndWorkspace() {
  const [inviter, ws] = await Promise.all([
    seedUser({ email: `inviter-${Date.now()}@example.com` }),
    seedWorkspace(),
  ])
  return { inviter, ws }
}

describe('InvitationRepository', () => {
  describe('create() + findByToken()', () => {
    it('should create an invite and read it back with the workspace included', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()

      const created = expectOk(
        await InvitationRepository.create({
          email: 'invitee@example.com',
          role: 'MEMBER',
          expiresAt: new Date(Date.now() + 60_000),
          invitedById: inviter.id,
          workspaceId: ws.id,
        }),
      )

      const found = expectOk(
        await InvitationRepository.findByToken(created.token),
      )
      expect(found?.id).toBe(created.id)
      expect(found?.workspace.slug).toBe(ws.slug)
    })
  })

  describe('findPendingByWorkspaceAndEmail()', () => {
    it('should only return PENDING invites', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'revoked@example.com',
        status: 'REVOKED',
      })

      const found = expectOk(
        await InvitationRepository.findPendingByWorkspaceAndEmail(
          ws.id,
          'revoked@example.com',
        ),
      )
      expect(found).toBeNull()
    })
  })

  describe('refreshToken()', () => {
    it('should replace the token and reopen the invite', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const invite = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        status: 'EXPIRED',
      })

      const refreshed = expectOk(
        await InvitationRepository.refreshToken(
          invite.id,
          'brand-new-token',
          new Date(Date.now() + 60_000),
        ),
      )
      expect(refreshed.token).toBe('brand-new-token')
      expect(refreshed.token).not.toBe(invite.token)
      expect(refreshed.status).toBe('PENDING')
    })
  })

  describe('accept()', () => {
    it('should create the membership, mark ACCEPTED, and be idempotent', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const invitee = await seedUser({ email: 'accept@example.com' })
      const invite = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'accept@example.com',
        role: 'MEMBER',
      })

      const membership = expectOk(
        await InvitationRepository.accept({
          invitationId: invite.id,
          userId: invitee.id,
          workspaceId: ws.id,
          role: 'MEMBER',
        }),
      )
      expect(membership.userId).toBe(invitee.id)

      const stored = await prisma.workspaceInvitation.findUnique({
        where: { id: invite.id },
      })
      expect(stored?.status).toBe('ACCEPTED')

      expectOk(
        await InvitationRepository.accept({
          invitationId: invite.id,
          userId: invitee.id,
          workspaceId: ws.id,
          role: 'MEMBER',
        }),
      )
      const count = await prisma.membership.count({
        where: { userId: invitee.id, workspaceId: ws.id },
      })
      expect(count).toBe(1)
    })

    it('hould clear the invitee onboarding step on accept', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const invitee = await seedUser({
        email: `invitee-${Date.now()}@example.com`,
      })
      await prisma.user.update({
        where: { id: invitee.id },
        data: { onboardingStep: 'ROLE' },
      })
      const invite = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: invitee.email,
        status: 'PENDING',
      })

      expectOk(
        await InvitationRepository.accept({
          invitationId: invite.id,
          userId: invitee.id,
          workspaceId: ws.id,
          role: 'MEMBER',
        }),
      )
    })
  })

  describe('countPendingByWorkspace()', () => {
    it('should count only PENDING invitations of the workspace', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'p1@example.com',
        status: 'PENDING',
      })
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'p2@example.com',
        status: 'PENDING',
      })
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'r@example.com',
        status: 'REVOKED',
      })

      expect(
        expectOk(await InvitationRepository.countPendingByWorkspace(ws.id)),
      ).toBe(2)
    })

    it('should not count expired pending invitations toward the seat cap', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'live@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      })
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'stale@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      })

      expect(
        expectOk(await InvitationRepository.countPendingByWorkspace(ws.id)),
      ).toBe(1)
    })

    it('should not count invitations from toher workspaces', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const other = await seedWorkspace()
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'iso@example.com',
        status: 'PENDING',
      })

      expect(
        expectOk(await InvitationRepository.countPendingByWorkspace(other.id)),
      ).toBe(0)
    })

    it('should not count expired PENDING invites toward the seat cap', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'iso@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() + 60_000),
      })
      await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        email: 'stale@example.com',
        status: 'PENDING',
        expiresAt: new Date(Date.now() - 60_000),
      })

      expect(
        expectOk(await InvitationRepository.countPendingByWorkspace(ws.id)),
      ).toBe(1)
    })
  })

  describe('findById() / listByWorkspace() / updateStatus()', () => {
    it('should find by id, list the workspace invites newest first and update status', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const other = await seedWorkspace()
      const older = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
      })
      await prisma.workspaceInvitation.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
      })
      await seedInvitation({ invitedById: inviter.id, workspaceId: other.id })

      expect(expectOk(await InvitationRepository.findById(older.id))?.id).toBe(
        older.id,
      )
      expect(
        expectOk(await InvitationRepository.findById('missing')),
      ).toBeNull()

      const list = expectOk(await InvitationRepository.listByWorkspace(ws.id))
      expect(list.map((i) => i.id)).toEqual([newer.id, older.id])

      const revoked = expectOk(
        await InvitationRepository.updateStatus(newer.id, 'REVOKED'),
      )
      expect(revoked.status).toBe('REVOKED')
    })
  })

  describe('accept() with a project invite', () => {
    it('should also add the user to the project, idempotently', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()
      const invitee = await seedUser({ email: `invitee-${Date.now()}@x.com` })
      const project = await seedProject(ws.id, inviter.id)
      const invitation = await seedInvitation({
        invitedById: inviter.id,
        workspaceId: ws.id,
        projectId: project.id,
      })
      const params = {
        invitationId: invitation.id,
        userId: invitee.id,
        workspaceId: ws.id,
        role: 'MEMBER' as const,
        projectId: project.id,
      }

      expectOk(await InvitationRepository.accept(params))
      expectOk(await InvitationRepository.accept(params))

      expect(
        await prisma.projectMember.count({
          where: { projectId: project.id, userId: invitee.id },
        }),
      ).toBe(1)
    })
  })

  describe('database failures', () => {
    it('should return DATABASE_ERROR when writes hit missing rows or FKs', async () => {
      expectErr(
        await InvitationRepository.create({
          email: 'x@example.com',
          role: 'MEMBER',
          expiresAt: new Date(),
          invitedById: 'missing',
          workspaceId: 'missing',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await InvitationRepository.updateStatus('missing', 'REVOKED'),
        'DATABASE_ERROR',
      )
      expectErr(
        await InvitationRepository.refreshToken('missing', 't', new Date()),
        'DATABASE_ERROR',
      )
    })

    it('should roll back accept() when the invitation does not exist', async () => {
      const { inviter, ws } = await seedInviterAndWorkspace()

      expectErr(
        await InvitationRepository.accept({
          invitationId: 'missing',
          userId: inviter.id,
          workspaceId: ws.id,
          role: 'MEMBER',
        }),
        'DATABASE_ERROR',
      )
      expect(
        await prisma.membership.count({ where: { workspaceId: ws.id } }),
      ).toBe(0)
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      vi.spyOn(prisma.workspaceInvitation, 'findUnique')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
      vi.spyOn(prisma.workspaceInvitation, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      vi.spyOn(prisma.workspaceInvitation, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
      vi.spyOn(prisma.workspaceInvitation, 'count').mockRejectedValueOnce(
        new Error('boom'),
      )

      expectErr(await InvitationRepository.findByToken('t'), 'DATABASE_ERROR')
      expectErr(await InvitationRepository.findById('i'), 'DATABASE_ERROR')
      expectErr(
        await InvitationRepository.findPendingByWorkspaceAndEmail('w', 'e'),
        'DATABASE_ERROR',
      )
      expectErr(
        await InvitationRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(await InvitationRepository.listByProject('p'), 'DATABASE_ERROR')
      expectErr(
        await InvitationRepository.countPendingByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })
})
