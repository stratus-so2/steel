import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedInvitation } from '@/src/__tests__/factories/invitation.factory'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import {
  seedProject,
  seedProjectMember,
} from '@/src/__tests__/factories/project.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { InvitationRepository } from '@/src/repositories/invitation.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

async function seedDirectory() {
  const ws = await seedWorkspace()
  const other = await seedWorkspace()
  const [ana, bruno, carla] = await Promise.all([
    seedUser({ name: 'Ana Castro', email: 'ana@acme.com' }),
    seedUser({ name: 'Bruno Lima', email: 'bruno@acme.com' }),
    seedUser({ name: 'Carla Souza', email: 'carla@acme.com' }),
  ])
  await Promise.all([
    seedMembership({ userId: ana.id, workspaceId: ws.id, role: 'OWNER' }),
    seedMembership({ userId: bruno.id, workspaceId: ws.id, role: 'ADMIN' }),
    seedMembership({ userId: carla.id, workspaceId: ws.id, role: 'VIEWER' }),
    seedMembership({ userId: carla.id, workspaceId: other.id, role: 'OWNER' }),
  ])
  await prisma.account.create({
    data: { accountId: ana.id, providerId: 'google', userId: ana.id },
  })
  return { ws, other, ana, bruno, carla }
}

describe('MembershipRepository — member directory', () => {
  describe('listByWorkspaceWithUser()', () => {
    it('returns only the workspace members with the directory fields', async () => {
      const { ws, ana } = await seedDirectory()

      const rows = expectOk(
        await MembershipRepository.listByWorkspaceWithUser(ws.id, {}),
      )

      expect(rows).toHaveLength(3)
      const anaRow = rows.find((r) => r.userId === ana.id)
      expect(anaRow?.user).toMatchObject({
        name: 'Ana Castro',
        email: 'ana@acme.com',
        emailVerified: false,
        twoFactorEnabled: false,
        deletionScheduledAt: null,
        accounts: [{ providerId: 'google' }],
      })
      // No credentials or tokens leave the repository.
      expect(Object.keys(anaRow?.user.accounts[0] ?? {})).toEqual([
        'providerId',
      ])
    })

    it('searches name, username and e-mail case-insensitively', async () => {
      const { ws, bruno, carla } = await seedDirectory()

      const byName = expectOk(
        await MembershipRepository.listByWorkspaceWithUser(ws.id, {
          search: 'BRUNO',
        }),
      )
      expect(byName.map((r) => r.userId)).toEqual([bruno.id])

      const byEmail = expectOk(
        await MembershipRepository.listByWorkspaceWithUser(ws.id, {
          search: 'carla@',
        }),
      )
      expect(byEmail.map((r) => r.userId)).toEqual([carla.id])

      const byUsername = expectOk(
        await MembershipRepository.listByWorkspaceWithUser(ws.id, {
          search: carla.username.toUpperCase(),
        }),
      )
      expect(byUsername.map((r) => r.userId)).toEqual([carla.id])
    })

    it('filters by role', async () => {
      const { ws, ana, bruno } = await seedDirectory()

      const rows = expectOk(
        await MembershipRepository.listByWorkspaceWithUser(ws.id, {
          roles: ['OWNER', 'ADMIN'],
        }),
      )

      expect(rows.map((r) => r.userId).sort()).toEqual(
        [ana.id, bruno.id].sort(),
      )
    })

    it('wraps database failures', async () => {
      vi.spyOn(prisma.membership, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )

      expectErr(
        await MembershipRepository.listByWorkspaceWithUser('ws', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('updateRole()', () => {
    it('changes the role in this workspace only', async () => {
      const { ws, other, carla } = await seedDirectory()

      const updated = expectOk(
        await MembershipRepository.updateRole(carla.id, ws.id, 'MEMBER'),
      )

      expect(updated.role).toBe('MEMBER')
      const elsewhere = await prisma.membership.findUniqueOrThrow({
        where: {
          userId_workspaceId: { userId: carla.id, workspaceId: other.id },
        },
      })
      expect(elsewhere.role).toBe('OWNER')
    })

    it('fails for a missing membership', async () => {
      expectErr(
        await MembershipRepository.updateRole('nobody', 'ws', 'MEMBER'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('drops the membership and the project memberships of this workspace', async () => {
      const { ws, other, ana, carla } = await seedDirectory()
      const [inside, outside] = await Promise.all([
        seedProject(ws.id, ana.id),
        seedProject(other.id, carla.id),
      ])
      await Promise.all([
        seedProjectMember({ userId: carla.id, projectId: inside.id }),
        seedProjectMember({ userId: carla.id, projectId: outside.id }),
      ])

      expectOk(await MembershipRepository.remove(carla.id, ws.id))

      const memberships = await prisma.membership.findMany({
        where: { userId: carla.id },
      })
      expect(memberships.map((m) => m.workspaceId)).toEqual([other.id])
      const projects = await prisma.projectMember.findMany({
        where: { userId: carla.id },
      })
      expect(projects.map((p) => p.projectId)).toEqual([outside.id])
    })

    it('rolls back when the membership does not exist', async () => {
      expectErr(
        await MembershipRepository.remove('nobody', 'ws'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('InvitationRepository.updateRole()', () => {
  it('changes the invitation role', async () => {
    const [ws, owner] = await Promise.all([seedWorkspace(), seedUser()])
    const invitation = await seedInvitation({
      workspaceId: ws.id,
      invitedById: owner.id,
    })

    const updated = expectOk(
      await InvitationRepository.updateRole(invitation.id, 'ADMIN'),
    )

    expect(updated.role).toBe('ADMIN')
  })

  it('fails for a missing invitation', async () => {
    expectErr(
      await InvitationRepository.updateRole('missing', 'ADMIN'),
      'DATABASE_ERROR',
    )
  })
})
