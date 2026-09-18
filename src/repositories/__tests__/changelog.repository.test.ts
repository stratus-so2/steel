import { describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { ChangelogRepository } from '../changelog.repository'

async function seedChangelog(subject = 'Novidades') {
  const user = await seedUser()
  const changelog = expectOk(
    await ChangelogRepository.create(
      { subject, createdById: user.id },
      [
        { title: 'Primeiro', body: 'a' },
        { title: 'Segundo', body: 'b', imageUrl: 'https://x.test/i.png' },
      ],
      [{ email: 'a@example.com', userId: user.id }, { email: 'b@example.com' }],
    ),
  )
  return { user, changelog }
}

describe('ChangelogRepository', () => {
  describe('create()', () => {
    it('should persist items in order with positions and pending recipients', async () => {
      const { changelog } = await seedChangelog()

      expect(changelog.status).toBe('DRAFT')
      expect(changelog.items.map((i) => [i.title, i.position])).toEqual([
        ['Primeiro', 0],
        ['Segundo', 1],
      ])
      expect(changelog.recipients).toHaveLength(2)
      expect(changelog.recipients.every((r) => r.status === 'PENDING')).toBe(
        true,
      )
    })

    it('should return DATABASE_ERROR when the author does not exist', async () => {
      expectErr(
        await ChangelogRepository.create(
          { subject: 'x', createdById: 'missing-user' },
          [],
          [],
        ),
        'DATABASE_ERROR',
      )
    })
  })

  describe('list()', () => {
    it('should list newest first with recipient statuses', async () => {
      const { changelog: older } = await seedChangelog('Antigo')
      await prisma.changelog.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const { changelog: newer } = await seedChangelog('Novo')

      const list = expectOk(await ChangelogRepository.list())
      expect(list.map((c) => c.id)).toEqual([newer.id, older.id])
      expect(list[0].recipients).toEqual([
        { status: 'PENDING' },
        { status: 'PENDING' },
      ])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.changelog, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await ChangelogRepository.list(), 'DATABASE_ERROR')
    })
  })

  describe('findById()', () => {
    it('should return the changelog with items and recipients', async () => {
      const { changelog } = await seedChangelog()
      const found = expectOk(await ChangelogRepository.findById(changelog.id))
      expect(found?.items).toHaveLength(2)
      expect(found?.recipients).toHaveLength(2)
    })

    it('should return null when missing', async () => {
      expect(expectOk(await ChangelogRepository.findById('missing'))).toBeNull()
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.changelog, 'findUnique').mockRejectedValueOnce('boom')
      expectErr(await ChangelogRepository.findById('x'), 'DATABASE_ERROR')
    })
  })

  describe('updateStatus()', () => {
    it('should update the status', async () => {
      const { changelog } = await seedChangelog()
      const updated = expectOk(
        await ChangelogRepository.updateStatus(changelog.id, 'RUNNING'),
      )
      expect(updated.status).toBe('RUNNING')
    })

    it('should return DATABASE_ERROR when the changelog does not exist', async () => {
      expectErr(
        await ChangelogRepository.updateStatus('missing', 'DONE'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('recipients', () => {
    it('should find a recipient with its changelog details', async () => {
      const { changelog } = await seedChangelog()
      const recipientId = changelog.recipients[0].id

      const recipient = expectOk(
        await ChangelogRepository.findRecipientById(recipientId),
      )
      expect(recipient?.changelog.id).toBe(changelog.id)
      expect(recipient?.changelog.items).toHaveLength(2)
    })

    it('should return null for an unknown recipient', async () => {
      expect(
        expectOk(await ChangelogRepository.findRecipientById('missing')),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the recipient lookup throws', async () => {
      vi.spyOn(prisma.changelogRecipient, 'findUnique').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await ChangelogRepository.findRecipientById('x'),
        'DATABASE_ERROR',
      )
    })

    it('should update the recipient status and count only pending ones', async () => {
      const { changelog } = await seedChangelog()
      const [first] = changelog.recipients
      const sentAt = new Date()

      expectOk(
        await ChangelogRepository.updateRecipientStatus(first.id, {
          status: 'SENT',
          sentAt,
        }),
      )

      const stored = await prisma.changelogRecipient.findUniqueOrThrow({
        where: { id: first.id },
      })
      expect(stored.status).toBe('SENT')
      expect(stored.sentAt?.getTime()).toBe(sentAt.getTime())
      expect(
        expectOk(
          await ChangelogRepository.countPendingRecipients(changelog.id),
        ),
      ).toBe(1)
    })

    it('should return DATABASE_ERROR when updating an unknown recipient', async () => {
      expectErr(
        await ChangelogRepository.updateRecipientStatus('missing', {
          status: 'FAILED',
          errorMessage: 'x',
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when counting throws', async () => {
      vi.spyOn(prisma.changelogRecipient, 'count').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await ChangelogRepository.countPendingRecipients('x'),
        'DATABASE_ERROR',
      )
    })
  })
})
