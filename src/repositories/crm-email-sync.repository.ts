import type {
  CrmCalendarEvent,
  CrmEmailAccount,
  CrmEmailMessage,
  CrmEmailProvider,
  CrmMailDirection,
} from '@prisma/client'
import { crmEmailAccountConflict, notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmEmailAccountRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmEmailAccount[]>> {
    try {
      const accounts = await prisma.crmEmailAccount.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(accounts)
    } catch (error) {
      return err(dbError('Failed to list CRM email accounts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailAccount>> {
    try {
      const account = await prisma.crmEmailAccount.findFirst({
        where: { id, workspaceId },
      })
      if (!account) return err(notFound('CrmEmailAccount'))
      return ok(account)
    } catch (error) {
      return err(dbError('Failed to find CRM email account by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    userId: string
    provider: CrmEmailProvider
    email: string
  }): Promise<Result<CrmEmailAccount>> {
    try {
      const account = await prisma.crmEmailAccount.create({ data })
      return ok(account)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmEmailAccountConflict())
      }
      return err(dbError('Failed to create CRM email account', error))
    }
  },

  async remove(id: string): Promise<Result<void>> {
    try {
      await prisma.crmEmailAccount.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to remove CRM email account', error))
    }
  },
}

export const CrmEmailMessageRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters: { personId?: string; opportunityId?: string } = {},
  ): Promise<Result<CrmEmailMessage[]>> {
    try {
      const messages = await prisma.crmEmailMessage.findMany({
        where: {
          workspaceId,
          personId: filters.personId,
          opportunityId: filters.opportunityId,
        },
        orderBy: { sentAt: 'desc' },
      })
      return ok(messages)
    } catch (error) {
      return err(dbError('Failed to list CRM email messages', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailMessage>> {
    try {
      const message = await prisma.crmEmailMessage.findFirst({
        where: { id, workspaceId },
      })
      if (!message) return err(notFound('CrmEmailMessage'))
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to find CRM email message by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    accountId?: string
    direction: CrmMailDirection
    subject?: string
    snippet?: string
    fromEmail: string
    toEmails: string[]
    personId?: string
    opportunityId?: string
    sentAt: Date
  }): Promise<Result<CrmEmailMessage>> {
    try {
      const message = await prisma.crmEmailMessage.create({ data })
      return ok(message)
    } catch (error) {
      return err(dbError('Failed to create CRM email message', error))
    }
  },

  async remove(id: string): Promise<Result<void>> {
    try {
      await prisma.crmEmailMessage.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to remove CRM email message', error))
    }
  },
}

export const CrmCalendarEventRepository = {
  async listByWorkspace(
    workspaceId: string,
    filters: { personId?: string; opportunityId?: string } = {},
  ): Promise<Result<CrmCalendarEvent[]>> {
    try {
      const events = await prisma.crmCalendarEvent.findMany({
        where: {
          workspaceId,
          personId: filters.personId,
          opportunityId: filters.opportunityId,
        },
        orderBy: { startsAt: 'desc' },
      })
      return ok(events)
    } catch (error) {
      return err(dbError('Failed to list CRM calendar events', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmCalendarEvent>> {
    try {
      const event = await prisma.crmCalendarEvent.findFirst({
        where: { id, workspaceId },
      })
      if (!event) return err(notFound('CrmCalendarEvent'))
      return ok(event)
    } catch (error) {
      return err(dbError('Failed to find CRM calendar event by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    accountId?: string
    title: string
    description?: string
    startsAt: Date
    endsAt: Date
    attendees: string[]
    personId?: string
    opportunityId?: string
  }): Promise<Result<CrmCalendarEvent>> {
    try {
      const event = await prisma.crmCalendarEvent.create({ data })
      return ok(event)
    } catch (error) {
      return err(dbError('Failed to create CRM calendar event', error))
    }
  },

  async update(
    id: string,
    data: {
      title?: string
      description?: string
      startsAt?: Date
      endsAt?: Date
      attendees?: string[]
    },
  ): Promise<Result<CrmCalendarEvent>> {
    try {
      const event = await prisma.crmCalendarEvent.update({
        where: { id },
        data,
      })
      return ok(event)
    } catch (error) {
      return err(dbError('Failed to update CRM calendar event', error))
    }
  },

  async remove(id: string): Promise<Result<void>> {
    try {
      await prisma.crmCalendarEvent.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to remove CRM calendar event', error))
    }
  },
}
