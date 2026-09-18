import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmCalendarEvent,
  seedCrmEmailAccount,
  seedCrmEmailMessage,
} from '@/src/__tests__/factories/crm-email-sync.factory'
import { seedCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmCalendarEventRepository,
  CrmEmailAccountRepository,
  CrmEmailMessageRepository,
} from '../crm-email-sync.repository'

async function seedBase() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('CrmEmailAccountRepository', () => {
  describe('create()', () => {
    it('should create an account for the user', async () => {
      const { workspace, user } = await seedBase()

      const account = expectOk(
        await CrmEmailAccountRepository.create({
          workspaceId: workspace.id,
          userId: user.id,
          provider: 'OUTLOOK',
          email: 'jane@acme.com',
        }),
      )
      expect(account).toMatchObject({
        workspaceId: workspace.id,
        userId: user.id,
        provider: 'OUTLOOK',
        email: 'jane@acme.com',
      })
    })

    it('should return CRM_EMAIL_ACCOUNT_CONFLICT on duplicate provider for the same user', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmEmailAccount(workspace.id, user.id, { provider: 'GMAIL' })

      const result = await CrmEmailAccountRepository.create({
        workspaceId: workspace.id,
        userId: user.id,
        provider: 'GMAIL',
        email: 'other@acme.com',
      })

      expectErr(result, 'CRM_EMAIL_ACCOUNT_CONFLICT')
    })

    it('should return DATABASE_ERROR on other failures (missing workspace)', async () => {
      const user = await seedUser()
      expectErr(
        await CrmEmailAccountRepository.create({
          workspaceId: 'missing',
          userId: user.id,
          provider: 'GMAIL',
          email: 'x@acme.com',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list only the workspace accounts, newest first', async () => {
      const { workspace, other, user } = await seedBase()
      const older = await seedCrmEmailAccount(workspace.id, user.id, {
        provider: 'GMAIL',
      })
      await prisma.crmEmailAccount.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedCrmEmailAccount(workspace.id, user.id, {
        provider: 'OUTLOOK',
      })
      await seedCrmEmailAccount(other.id, user.id)

      const list = expectOk(
        await CrmEmailAccountRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((a) => a.id)).toEqual([newer.id, older.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmEmailAccount, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailAccountRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find within the workspace and not leak across workspaces', async () => {
      const { workspace, other, user } = await seedBase()
      const account = await seedCrmEmailAccount(workspace.id, user.id)

      expect(
        expectOk(
          await CrmEmailAccountRepository.findById(account.id, workspace.id),
        ).id,
      ).toBe(account.id)
      expectErr(
        await CrmEmailAccountRepository.findById(account.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmEmailAccount, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailAccountRepository.findById('a', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('should delete the account', async () => {
      const { workspace, user } = await seedBase()
      const account = await seedCrmEmailAccount(workspace.id, user.id)

      expectOk(await CrmEmailAccountRepository.remove(account.id))
      expect(
        await prisma.crmEmailAccount.findUnique({ where: { id: account.id } }),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR for a missing account', async () => {
      expectErr(
        await CrmEmailAccountRepository.remove('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmEmailMessageRepository', () => {
  describe('create() / findById()', () => {
    it('should create a message and find it scoped to the workspace', async () => {
      const { workspace, other, user } = await seedBase()
      const account = await seedCrmEmailAccount(workspace.id, user.id)
      const sentAt = new Date('2026-09-01T10:00:00Z')

      const message = expectOk(
        await CrmEmailMessageRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          accountId: account.id,
          direction: 'OUTBOUND',
          subject: 'Proposta',
          snippet: 'Segue...',
          fromEmail: 'jane@acme.com',
          toEmails: ['a@x.com', 'b@x.com'],
          sentAt,
        }),
      )
      expect(message.toEmails).toEqual(['a@x.com', 'b@x.com'])

      expect(
        expectOk(
          await CrmEmailMessageRepository.findById(message.id, workspace.id),
        ).subject,
      ).toBe('Proposta')
      expectErr(
        await CrmEmailMessageRepository.findById(message.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmEmailMessageRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          direction: 'INBOUND',
          fromEmail: 'x@x.com',
          toEmails: [],
          sentAt: new Date(),
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when the lookup throws', async () => {
      vi.spyOn(prisma.crmEmailMessage, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailMessageRepository.findById('m', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list newest sent first and filter by person', async () => {
      const { workspace, other, user } = await seedBase()
      const person = await seedCrmPerson(workspace.id, user.id)
      const old = await seedCrmEmailMessage(workspace.id, user.id, {
        personId: person.id,
      })
      await prisma.crmEmailMessage.update({
        where: { id: old.id },
        data: { sentAt: new Date('2020-01-01') },
      })
      const recent = await seedCrmEmailMessage(workspace.id, user.id)
      await seedCrmEmailMessage(other.id, user.id)

      expect(
        expectOk(
          await CrmEmailMessageRepository.listByWorkspace(workspace.id),
        ).map((m) => m.id),
      ).toEqual([recent.id, old.id])
      expect(
        expectOk(
          await CrmEmailMessageRepository.listByWorkspace(workspace.id, {
            personId: person.id,
          }),
        ).map((m) => m.id),
      ).toEqual([old.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmEmailMessage, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmEmailMessageRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('should delete the message', async () => {
      const { workspace, user } = await seedBase()
      const message = await seedCrmEmailMessage(workspace.id, user.id)

      expectOk(await CrmEmailMessageRepository.remove(message.id))
      expect(
        await prisma.crmEmailMessage.findUnique({ where: { id: message.id } }),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR for a missing message', async () => {
      expectErr(
        await CrmEmailMessageRepository.remove('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmCalendarEventRepository', () => {
  describe('create() / findById()', () => {
    it('should create an event and find it scoped to the workspace', async () => {
      const { workspace, other, user } = await seedBase()
      const startsAt = new Date('2026-09-20T13:00:00Z')
      const endsAt = new Date('2026-09-20T14:00:00Z')

      const event = expectOk(
        await CrmCalendarEventRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          title: 'Demo',
          description: 'Apresentação',
          startsAt,
          endsAt,
          attendees: ['cliente@x.com'],
        }),
      )
      expect(event.attendees).toEqual(['cliente@x.com'])

      expect(
        expectOk(
          await CrmCalendarEventRepository.findById(event.id, workspace.id),
        ).title,
      ).toBe('Demo')
      expectErr(
        await CrmCalendarEventRepository.findById(event.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmCalendarEventRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          title: 'x',
          startsAt: new Date(),
          endsAt: new Date(),
          attendees: [],
        }),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when the lookup throws', async () => {
      vi.spyOn(prisma.crmCalendarEvent, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmCalendarEventRepository.findById('e', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace()', () => {
    it('should list latest start first and filter by person', async () => {
      const { workspace, other, user } = await seedBase()
      const person = await seedCrmPerson(workspace.id, user.id)
      const early = await seedCrmCalendarEvent(workspace.id, user.id, {
        personId: person.id,
      })
      await prisma.crmCalendarEvent.update({
        where: { id: early.id },
        data: { startsAt: new Date('2020-01-01') },
      })
      const late = await seedCrmCalendarEvent(workspace.id, user.id)
      await seedCrmCalendarEvent(other.id, user.id)

      expect(
        expectOk(
          await CrmCalendarEventRepository.listByWorkspace(workspace.id),
        ).map((e) => e.id),
      ).toEqual([late.id, early.id])
      expect(
        expectOk(
          await CrmCalendarEventRepository.listByWorkspace(workspace.id, {
            personId: person.id,
          }),
        ).map((e) => e.id),
      ).toEqual([early.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmCalendarEvent, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmCalendarEventRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update() / remove()', () => {
    it('should update and then delete the event', async () => {
      const { workspace, user } = await seedBase()
      const event = await seedCrmCalendarEvent(workspace.id, user.id)

      const updated = expectOk(
        await CrmCalendarEventRepository.update(event.id, {
          title: 'Reagendado',
          attendees: ['a@x.com', 'b@x.com'],
        }),
      )
      expect(updated.title).toBe('Reagendado')
      expect(updated.attendees).toEqual(['a@x.com', 'b@x.com'])

      expectOk(await CrmCalendarEventRepository.remove(event.id))
      expect(
        await prisma.crmCalendarEvent.findUnique({ where: { id: event.id } }),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR for a missing event', async () => {
      expectErr(
        await CrmCalendarEventRepository.update('missing', { title: 'x' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCalendarEventRepository.remove('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
