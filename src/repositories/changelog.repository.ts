import type {
  Changelog,
  ChangelogRecipient,
  ChangelogRecipientStatus,
  ChangelogStatus,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

const listInclude = {
  recipients: { select: { status: true } },
} satisfies Prisma.ChangelogInclude

export type ChangelogWithCounts = Prisma.ChangelogGetPayload<{
  include: typeof listInclude
}>

const detailInclude = {
  items: { orderBy: { position: 'asc' } },
  recipients: true,
} satisfies Prisma.ChangelogInclude

export type ChangelogWithDetails = Prisma.ChangelogGetPayload<{
  include: typeof detailInclude
}>

export const ChangelogRepository = {
  async list(): Promise<Result<ChangelogWithCounts[]>> {
    try {
      const changelogs = await prisma.changelog.findMany({
        include: listInclude,
        orderBy: { createdAt: 'desc' },
      })
      return ok(changelogs)
    } catch (error) {
      return err(dbError('Failed to list changelogs', error))
    }
  },

  async findById(id: string): Promise<Result<ChangelogWithDetails | null>> {
    try {
      const changelog = await prisma.changelog.findUnique({
        where: { id },
        include: detailInclude,
      })
      return ok(changelog)
    } catch (error) {
      return err(dbError('Failed to find changelog', error))
    }
  },

  async create(
    data: {
      subject: string
      createdById: string
    },
    items: { title: string; body: string; imageUrl?: string }[],
    recipients: { email: string; userId?: string }[],
  ): Promise<Result<ChangelogWithDetails>> {
    try {
      const changelog = await prisma.changelog.create({
        data: {
          ...data,
          items: {
            create: items.map((item, position) => ({ ...item, position })),
          },
          recipients: { create: recipients },
        },
        include: detailInclude,
      })
      return ok(changelog)
    } catch (error) {
      return err(dbError('Failed to create changelog', error))
    }
  },

  async updateStatus(
    id: string,
    status: ChangelogStatus,
  ): Promise<Result<Changelog>> {
    try {
      const changelog = await prisma.changelog.update({
        where: { id },
        data: { status },
      })
      return ok(changelog)
    } catch (error) {
      return err(dbError('Failed to update changelog status', error))
    }
  },

  async findRecipientById(id: string): Promise<
    Result<
      | (ChangelogRecipient & {
          changelog: ChangelogWithDetails
        })
      | null
    >
  > {
    try {
      const recipient = await prisma.changelogRecipient.findUnique({
        where: { id },
        include: { changelog: { include: detailInclude } },
      })
      return ok(recipient)
    } catch (error) {
      return err(dbError('Failed to find changelog recipient', error))
    }
  },

  async updateRecipientStatus(
    id: string,
    data: {
      status: ChangelogRecipientStatus
      errorMessage?: string
      sentAt?: Date
    },
  ): Promise<Result<void>> {
    try {
      await prisma.changelogRecipient.update({ where: { id }, data })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to update changelog recipient', error))
    }
  },

  async countPendingRecipients(changelogId: string): Promise<Result<number>> {
    try {
      const count = await prisma.changelogRecipient.count({
        where: { changelogId, status: 'PENDING' },
      })
      return ok(count)
    } catch (error) {
      return err(dbError('Failed to count pending changelog recipients', error))
    }
  },
}
