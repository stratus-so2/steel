import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { UserRepository } from '@/src/repositories/user.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('UserRepository', () => {
  describe('findById()', () => {
    it('should return user when found', async () => {
      const seeded = await seedUser({ name: 'Found User' })

      const result = await UserRepository.findById(seeded.id)

      const user = expectOk(result)
      expect(user.id).toBe(seeded.id)
      expect(user.name).toBe('Found User')
    })

    it('should return RESOURCE_NOT_FOUND when user does not exist', async () => {
      const result = await UserRepository.findById('nonexistent-id')

      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('findByIdWithMemberships()', () => {
    it('should return memberships ordered by createdAt asc with workspace', async () => {
      const user = await seedUser()
      const wsA = await seedWorkspace({ name: 'WS A' })
      const wsB = await seedWorkspace({ name: 'WS B' })

      // Insert the newer membership first to prove ordering is by createdAt,
      // not by insertion order.
      await prisma.membership.create({
        data: {
          userId: user.id,
          workspaceId: wsB.id,
          role: 'MEMBER',
          createdAt: new Date('2025-02-01T00:00:00.000Z'),
        },
      })
      await prisma.membership.create({
        data: {
          userId: user.id,
          workspaceId: wsA.id,
          role: 'OWNER',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      })

      const result = await UserRepository.findByIdWithMemberships(user.id)

      const found = expectOk(result)
      expect(found.id).toBe(user.id)
      expect(found.memberships).toHaveLength(2)
      expect(found.memberships[0]?.workspaceId).toBe(wsA.id)
      expect(found.memberships[0]?.workspace.name).toBe('WS A')
      expect(found.memberships[1]?.workspaceId).toBe(wsB.id)
    })

    it('should return an empty memberships array when user has none', async () => {
      const user = await seedUser()

      const result = await UserRepository.findByIdWithMemberships(user.id)

      const found = expectOk(result)
      expect(found.memberships).toEqual([])
    })

    it('should return RESOURCE_NOT_FOUND when user does not exist', async () => {
      const result =
        await UserRepository.findByIdWithMemberships('nonexistent-id')

      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('findByEmail()', () => {
    it('should return user when email exists', async () => {
      const seeded = await seedUser({ email: 'exists@example.com' })

      const result = await UserRepository.findByEmail('exists@example.com')

      const user = expectOk(result)
      expect(user).not.toBeNull()
      expect(user?.id).toBe(seeded.id)
    })

    it('should return null when email does not exist', async () => {
      const result = await UserRepository.findByEmail('ghost@example.com')

      const user = expectOk(result)
      expect(user).toBeNull()
    })
  })

  describe('findByUsername()', () => {
    it('should return user when username exists', async () => {
      const seeded = await seedUser()

      const result = await UserRepository.findByUsername(seeded.username)

      const user = expectOk(result)
      expect(user?.id).toBe(seeded.id)
    })

    it('should return null when username does not exist', async () => {
      const result = await UserRepository.findByUsername('ghost-username')

      const user = expectOk(result)
      expect(user).toBeNull()
    })
  })

  describe('create()', () => {
    it('should create a user successfully', async () => {
      const result = await UserRepository.create({
        name: 'New User',
        email: 'new@example.com',
        username: 'new-user',
      })

      const user = expectOk(result)
      expect(user.name).toBe('New User')
      expect(user.email).toBe('new@example.com')
      expect(user.id).toBeDefined()
    })

    it('should return CONFLICT on duplicate email', async () => {
      await seedUser({ email: 'dup@example.com' })

      const result = await UserRepository.create({
        name: 'Duplicate',
        email: 'dup@example.com',
        username: 'duplicate-user',
      })

      expectErr(result, 'CONFLICT')
    })
  })

  describe('update()', () => {
    it('should update user name', async () => {
      const seeded = await seedUser({ name: 'Old Name' })

      const result = await UserRepository.update(seeded.id, {
        name: 'New Name',
      })

      const user = expectOk(result)
      expect(user.name).toBe('New Name')
    })

    it('should update user email', async () => {
      const seeded = await seedUser({ email: 'old@example.com' })

      const result = await UserRepository.update(seeded.id, {
        email: 'new@example.com',
      })

      const user = expectOk(result)
      expect(user.email).toBe('new@example.com')
    })

    it('should return CONFLICT when the username is already taken', async () => {
      const taken = await seedUser()
      const seeded = await seedUser()

      const result = await UserRepository.update(seeded.id, {
        username: taken.username,
      })

      expectErr(result, 'CONFLICT')
    })
  })

  describe('scheduleDeletion()', () => {
    it('should set deletionScheduledAt', async () => {
      const seeded = await seedUser()
      const when = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

      const result = await UserRepository.scheduleDeletion(seeded.id, when)

      const user = expectOk(result)
      expect(user.deletionScheduledAt?.toISOString()).toBe(when.toISOString())
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.scheduleDeletion(
        'nonexistent',
        new Date(),
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('clearDeletionSchedule()', () => {
    it('should null out deletionScheduledAt', async () => {
      const seeded = await seedUser()
      await UserRepository.scheduleDeletion(seeded.id, new Date())

      const result = await UserRepository.clearDeletionSchedule(seeded.id)

      const user = expectOk(result)
      expect(user.deletionScheduledAt).toBeNull()
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.clearDeletionSchedule('nonexistent')
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('deleteHard()', () => {
    it('should remove the user and cascade short-links', async () => {
      const seeded = await seedUser()
      await prisma.shortLink.create({
        data: { title: 't', url: 'https://x.test', userId: seeded.id },
      })

      const result = await UserRepository.deleteHard(seeded.id)

      expectOk(result)
      expect(
        await prisma.user.findUnique({ where: { id: seeded.id } }),
      ).toBeNull()
      expect(
        await prisma.shortLink.count({ where: { userId: seeded.id } }),
      ).toBe(0)
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.deleteHard('nonexistent')
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('countBlockingSoleOwnerWorkspaces()', () => {
    it('returns 0 when user has no workspaces', async () => {
      const seeded = await seedUser()

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces(
        seeded.id,
      )

      expect(expectOk(result)).toBe(0)
    })

    it('returns 0 when user is sole OWNER but has no other members', async () => {
      const user = await seedUser()
      const ws = await seedWorkspace()
      await seedMembership({
        userId: user.id,
        workspaceId: ws.id,
        role: 'OWNER',
      })

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces(
        user.id,
      )

      expect(expectOk(result)).toBe(0)
    })

    it('returns 0 when another OWNER exists in the same workspace', async () => {
      const user = await seedUser()
      const other = await seedUser()
      const ws = await seedWorkspace()
      await seedMembership({
        userId: user.id,
        workspaceId: ws.id,
        role: 'OWNER',
      })
      await seedMembership({
        userId: other.id,
        workspaceId: ws.id,
        role: 'OWNER',
      })

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces(
        user.id,
      )

      expect(expectOk(result)).toBe(0)
    })

    it('returns count when user is sole OWNER and other non-OWNER members exist', async () => {
      const user = await seedUser()
      const member = await seedUser()
      const ws = await seedWorkspace()
      await seedMembership({
        userId: user.id,
        workspaceId: ws.id,
        role: 'OWNER',
      })
      await seedMembership({
        userId: member.id,
        workspaceId: ws.id,
        role: 'MEMBER',
      })

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces(
        user.id,
      )

      expect(expectOk(result)).toBe(1)
    })

    it('ignores workspaces where user is not OWNER', async () => {
      const user = await seedUser()
      const owner = await seedUser()
      const ws = await seedWorkspace()
      await seedMembership({
        userId: owner.id,
        workspaceId: ws.id,
        role: 'OWNER',
      })
      await seedMembership({
        userId: user.id,
        workspaceId: ws.id,
        role: 'MEMBER',
      })

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces(
        user.id,
      )

      expect(expectOk(result)).toBe(0)
    })

    it('returns DATABASE_ERROR when the count query throws', async () => {
      vi.spyOn(prisma.workspace, 'count').mockRejectedValueOnce(
        new Error('boom'),
      )

      const result = await UserRepository.countBlockingSoleOwnerWorkspaces('u')

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('updateOnboardingStep()', () => {
    it('should advance the onboarding step', async () => {
      const seeded = await seedUser()

      const result = await UserRepository.updateOnboardingStep(
        seeded.id,
        'WORKSPACE',
      )

      const user = expectOk(result)
      expect(user.onboardingStep).toBe('WORKSPACE')
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.updateOnboardingStep('nope', 'ROLE')
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })

    it('should return DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))

      const result = await UserRepository.updateOnboardingStep('u', 'ROLE')

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('saveRole()', () => {
    it('should persist the role and next step', async () => {
      const seeded = await seedUser()

      const result = await UserRepository.saveRole(
        seeded.id,
        'DEVELOPER',
        'BRINGS',
      )

      const user = expectOk(result)
      expect(user.role).toBe('DEVELOPER')
      expect(user.onboardingStep).toBe('BRINGS')
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.saveRole(
        'nope',
        'DEVELOPER',
        'BRINGS',
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })

    it('should return DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))

      const result = await UserRepository.saveRole('u', 'DEVELOPER', 'BRINGS')

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('saveGoals()', () => {
    it('should persist the goals and next step', async () => {
      const seeded = await seedUser()

      const result = await UserRepository.saveGoals(
        seeded.id,
        ['ROADMAP', 'SPRINTS'],
        'WORKSPACE',
      )

      const user = expectOk(result)
      expect(user.goals).toEqual(['ROADMAP', 'SPRINTS'])
      expect(user.onboardingStep).toBe('WORKSPACE')
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      const result = await UserRepository.saveGoals(
        'nope',
        ['ROADMAP'],
        'WORKSPACE',
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })

    it('should return DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))

      const result = await UserRepository.saveGoals(
        'u',
        ['ROADMAP'],
        'WORKSPACE',
      )

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('read and write query failures', () => {
    it('findById() returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await UserRepository.findById('x'), 'DATABASE_ERROR')
    })

    it('findByIdWithMemberships() returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await UserRepository.findByIdWithMemberships('x'),
        'DATABASE_ERROR',
      )
    })

    it('findByEmail() returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await UserRepository.findByEmail('a@b.test'), 'DATABASE_ERROR')
    })

    it('findByUsername() returns DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await UserRepository.findByUsername('user'), 'DATABASE_ERROR')
    })

    it('create() returns DATABASE_ERROR on non-unique-constraint failures', async () => {
      vi.spyOn(prisma.user, 'create').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await UserRepository.create({
          name: 'X',
          email: 'x@y.test',
          username: 'x',
        }),
        'DATABASE_ERROR',
      )
    })

    it('update() returns DATABASE_ERROR on non-unique-constraint failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await UserRepository.update('u', { name: 'X' }),
        'DATABASE_ERROR',
      )
    })

    it('scheduleDeletion() returns DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await UserRepository.scheduleDeletion('u', new Date()),
        'DATABASE_ERROR',
      )
    })

    it('clearDeletionSchedule() returns DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await UserRepository.clearDeletionSchedule('u'),
        'DATABASE_ERROR',
      )
    })

    it('deleteHard() returns DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'delete').mockRejectedValueOnce(new Error('boom'))
      expectErr(await UserRepository.deleteHard('u'), 'DATABASE_ERROR')
    })
  })

  describe('findManyByIds()', () => {
    it('should return only the requested users', async () => {
      const [a, b] = await Promise.all([
        seedUser({ email: 'many-a@example.com' }),
        seedUser({ email: 'many-b@example.com' }),
        seedUser({ email: 'many-c@example.com' }),
      ])
      const users = expectOk(await UserRepository.findManyByIds([a.id, b.id]))
      expect(users.map((u) => u.id).sort()).toEqual([a.id, b.id].sort())
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findMany').mockRejectedValueOnce(new Error('boom'))
      expectErr(await UserRepository.findManyByIds(['x']), 'DATABASE_ERROR')
    })
  })

  describe('search()', () => {
    it('should match name or e-mail case-insensitively, ordered by name and limited', async () => {
      await seedUser({ name: 'Bruna Lima', email: 'bruna@example.com' })
      await seedUser({ name: 'Ana Souza', email: 'ana@example.com' })
      await seedUser({ name: 'Carlos', email: 'LIMA.carlos@example.com' })
      await seedUser({ name: 'Outro', email: 'outro@example.com' })

      const found = expectOk(await UserRepository.search('lima'))
      expect(found.map((u) => u.name)).toEqual(['Bruna Lima', 'Carlos'])

      const limited = expectOk(await UserRepository.search('example.com', 2))
      expect(limited.map((u) => u.name)).toEqual(['Ana Souza', 'Bruna Lima'])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.user, 'findMany').mockRejectedValueOnce(new Error('boom'))
      expectErr(await UserRepository.search('x'), 'DATABASE_ERROR')
    })
  })

  describe('saveProfile()', () => {
    it('should persist the name and next step', async () => {
      const user = await seedUser()
      const saved = expectOk(
        await UserRepository.saveProfile(user.id, 'Novo Nome', 'WORKSPACE'),
      )
      expect(saved.name).toBe('Novo Nome')
      expect(saved.onboardingStep).toBe('WORKSPACE')
    })

    it('should return RESOURCE_NOT_FOUND for unknown user', async () => {
      expectErr(
        await UserRepository.saveProfile('missing', 'X', 'WORKSPACE'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR on non-P2025 failures', async () => {
      vi.spyOn(prisma.user, 'update').mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await UserRepository.saveProfile('u', 'X', 'WORKSPACE'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('deleteAllSessions()', () => {
    it('should delete only the user sessions', async () => {
      const [user, other] = await Promise.all([
        seedUser({ email: 'sess-a@example.com' }),
        seedUser({ email: 'sess-b@example.com' }),
      ])
      const expiresAt = new Date(Date.now() + 60_000)
      await prisma.session.createMany({
        data: [
          { id: 's1', token: 't1', userId: user.id, expiresAt },
          { id: 's2', token: 't2', userId: user.id, expiresAt },
          { id: 's3', token: 't3', userId: other.id, expiresAt },
        ],
      })

      expectOk(await UserRepository.deleteAllSessions(user.id))

      expect(await prisma.session.count({ where: { userId: user.id } })).toBe(0)
      expect(await prisma.session.count({ where: { userId: other.id } })).toBe(
        1,
      )
    })

    it('should return DATABASE_ERROR when the delete throws', async () => {
      vi.spyOn(prisma.session, 'deleteMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await UserRepository.deleteAllSessions('u'), 'DATABASE_ERROR')
    })
  })

  describe('hasCredentialAccount()', () => {
    it('should be true only for a credential account with a password', async () => {
      const [withPassword, oauthOnly] = await Promise.all([
        seedUser({ email: 'cred@example.com' }),
        seedUser({ email: 'oauth@example.com' }),
      ])
      await prisma.account.createMany({
        data: [
          {
            id: 'acc-1',
            accountId: withPassword.id,
            providerId: 'credential',
            userId: withPassword.id,
            password: 'hash',
          },
          {
            id: 'acc-2',
            accountId: 'gh-1',
            providerId: 'github',
            userId: oauthOnly.id,
          },
        ],
      })

      expect(
        expectOk(await UserRepository.hasCredentialAccount(withPassword.id)),
      ).toBe(true)
      expect(
        expectOk(await UserRepository.hasCredentialAccount(oauthOnly.id)),
      ).toBe(false)
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.account, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await UserRepository.hasCredentialAccount('u'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('acceptConsents()', () => {
    it('should stamp the user and record TERMS and PRIVACY events', async () => {
      const user = await seedUser()
      const at = new Date('2026-09-01T12:00:00Z')

      expectOk(
        await UserRepository.acceptConsents(user.id, {
          termsVersion: 't-1',
          privacyVersion: 'p-1',
          ipAddress: '1.2.3.4',
          userAgent: 'vitest',
          at,
        }),
      )

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
      })
      expect(stored.acceptedTermsAt?.toISOString()).toBe(at.toISOString())
      expect(stored.acceptedPrivacyAt?.toISOString()).toBe(at.toISOString())
      const events = await prisma.consentEvent.findMany({
        where: { userId: user.id },
      })
      expect(events.map((e) => [e.document, e.version]).sort()).toEqual([
        ['PRIVACY', 'p-1'],
        ['TERMS', 't-1'],
      ])
    })

    it('should return DATABASE_ERROR and write nothing for an unknown user', async () => {
      expectErr(
        await UserRepository.acceptConsents('missing', {
          termsVersion: 't',
          privacyVersion: 'p',
          ipAddress: null,
          userAgent: null,
          at: new Date(),
        }),
        'DATABASE_ERROR',
      )
      expect(
        await prisma.consentEvent.count({ where: { userId: 'missing' } }),
      ).toBe(0)
    })
  })
})
