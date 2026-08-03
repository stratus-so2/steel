import { describe, expect, it, vi } from 'vitest'
import {
  createFakeChangelogRecipient,
  createFakeChangelogWithCounts,
  createFakeChangelogWithDetails,
} from '@/src/__tests__/factories/changelog.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/changelog.repository')
vi.mock('@/src/repositories/user.repository')

const { addBulk } = vi.hoisted(() => ({
  addBulk: vi.fn(async (_jobs: unknown[]) => []),
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getChangelogQueue: vi.fn(() => ({ addBulk })),
}))

import { ChangelogRepository } from '@/src/repositories/changelog.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { AdminChangelogService } from '../admin-changelog.service'

const mockedChangelogRepo = vi.mocked(ChangelogRepository)
const mockedUserRepo = vi.mocked(UserRepository)

const platformAdmin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const regularUser = createFakeUser({
  isPlatformAdmin: false,
  email: 'user@example.com',
})

describe('AdminChangelogService', () => {
  describe('create()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await AdminChangelogService.create(regularUser.id, {
          subject: 'Novidades',
          items: [{ title: 'Item', body: 'Corpo' }],
          userIds: [],
          emails: [],
        }),
        'FORBIDDEN',
      )
      expect(mockedChangelogRepo.create).not.toHaveBeenCalled()
    })

    it('should reject when no recipients resolve at all', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))

      expectErr(
        await AdminChangelogService.create(platformAdmin.id, {
          subject: 'Novidades',
          items: [{ title: 'Item', body: 'Corpo' }],
          userIds: [],
          emails: [],
        }),
        'VALIDATION_ERROR',
      )
      expect(mockedChangelogRepo.create).not.toHaveBeenCalled()
    })

    it('should dedupe a selected user whose email was also pasted manually', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedUserRepo.findManyByIds.mockResolvedValue(
        ok([createFakeUser({ id: 'u1', email: 'dup@example.com' })]),
      )
      mockedChangelogRepo.create.mockResolvedValue(
        ok(createFakeChangelogWithDetails()),
      )

      const result = await AdminChangelogService.create(platformAdmin.id, {
        subject: 'Novidades',
        items: [{ title: 'Item', body: 'Corpo' }],
        userIds: ['u1'],
        emails: ['dup@example.com', 'novo@example.com'],
      })

      expectOk(result)
      expect(mockedChangelogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ createdById: platformAdmin.id }),
        [{ title: 'Item', body: 'Corpo' }],
        expect.arrayContaining([
          { email: 'dup@example.com', userId: 'u1' },
          { email: 'novo@example.com', userId: undefined },
        ]),
      )
      const recipientsArg = mockedChangelogRepo.create.mock.calls[0]?.[2]
      expect(recipientsArg).toHaveLength(2)
    })
  })

  describe('start()', () => {
    it('should refuse to start a changelog that is not a draft', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedChangelogRepo.findById.mockResolvedValue(
        ok(createFakeChangelogWithDetails({ status: 'RUNNING' })),
      )

      expectErr(
        await AdminChangelogService.start(platformAdmin.id, 'c1'),
        'CHANGELOG_LOCKED',
      )
      expect(addBulk).not.toHaveBeenCalled()
    })

    it('should enqueue one staggered job per recipient and mark RUNNING', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      const recipients = [
        createFakeChangelogRecipient({
          id: 'r1',
          changelogId: 'c1',
          email: 'a@example.com',
        }),
        createFakeChangelogRecipient({
          id: 'r2',
          changelogId: 'c1',
          email: 'b@example.com',
        }),
      ]
      const draft = createFakeChangelogWithDetails(
        { id: 'c1', status: 'DRAFT' },
        [],
        recipients,
      )
      const running = createFakeChangelogWithDetails(
        { id: 'c1', status: 'RUNNING' },
        [],
        recipients,
      )
      mockedChangelogRepo.findById
        .mockResolvedValueOnce(ok(draft))
        .mockResolvedValueOnce(ok(running))
      mockedChangelogRepo.updateStatus.mockResolvedValue(ok(running))

      const result = await AdminChangelogService.start(platformAdmin.id, 'c1')

      expectOk(result)
      expect(addBulk).toHaveBeenCalledWith([
        expect.objectContaining({
          data: { changelogId: 'c1', recipientId: 'r1' },
          opts: { delay: 0 },
        }),
        expect.objectContaining({
          data: { changelogId: 'c1', recipientId: 'r2' },
          opts: { delay: 1000 },
        }),
      ])
      expect(mockedChangelogRepo.updateStatus).toHaveBeenCalledWith(
        'c1',
        'RUNNING',
      )
    })
  })

  describe('list()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(await AdminChangelogService.list(regularUser.id), 'FORBIDDEN')
      expect(mockedChangelogRepo.list).not.toHaveBeenCalled()
    })

    it('should return summaries for a platform admin', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedChangelogRepo.list.mockResolvedValue(
        ok([
          createFakeChangelogWithCounts({ subject: 'V1' }, [
            { status: 'SENT' },
            { status: 'FAILED' },
          ]),
        ]),
      )

      const dtos = expectOk(await AdminChangelogService.list(platformAdmin.id))
      expect(dtos).toHaveLength(1)
      expect(dtos[0]).toMatchObject({
        subject: 'V1',
        recipientCount: 2,
        sentCount: 1,
        failedCount: 1,
      })
    })
  })
})
