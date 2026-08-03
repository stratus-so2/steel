import { auditMutation } from '@/lib/axiom/audit'
import {
  changelogLocked,
  changelogNotFound,
  validationError,
} from '@/src/errors'
import { ChangelogJob } from '@/src/lib/queue/jobs'
import { getChangelogQueue } from '@/src/lib/queue/queues'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toChangelogDetailDTO,
  toChangelogSummaryDTO,
  toChangelogUserSearchResultDTO,
} from '@/src/mappers/changelog.mapper'
import { ChangelogRepository } from '@/src/repositories/changelog.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import type { CreateChangelogDTO } from '@/src/schemas/changelog.schema'
import type {
  ChangelogDetailDTO,
  ChangelogSummaryDTO,
  ChangelogUserSearchResultDTO,
} from '@/types/changelog'
import { assertPlatformAdmin } from './authz'

const STAGGER_DELAY_MS = 1000

export const AdminChangelogService = {
  async searchUsers(
    actorId: string,
    query: string,
  ): Promise<Result<ChangelogUserSearchResultDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    if (query.trim().length < 2) return ok([])

    const result = await UserRepository.search(query.trim())
    if (!result.ok) return result

    return ok(result.value.map(toChangelogUserSearchResultDTO))
  },

  async list(actorId: string): Promise<Result<ChangelogSummaryDTO[]>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const result = await ChangelogRepository.list()
    if (!result.ok) return result

    return ok(result.value.map(toChangelogSummaryDTO))
  },

  async getById(
    actorId: string,
    id: string,
  ): Promise<Result<ChangelogDetailDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const found = await ChangelogRepository.findById(id)
    if (!found.ok) return found
    if (!found.value) return err(changelogNotFound())

    return ok(toChangelogDetailDTO(found.value))
  },

  async create(
    actorId: string,
    dto: CreateChangelogDTO,
  ): Promise<Result<ChangelogDetailDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const recipients = new Map<string, string | undefined>()

    if (dto.userIds.length > 0) {
      const users = await UserRepository.findManyByIds(dto.userIds)
      if (!users.ok) return users
      for (const user of users.value) {
        recipients.set(user.email.toLowerCase(), user.id)
      }
    }

    for (const email of dto.emails) {
      const normalized = email.toLowerCase()
      if (!recipients.has(normalized)) recipients.set(normalized, undefined)
    }

    if (recipients.size === 0) {
      return err(validationError('Selecione ao menos um destinatário'))
    }

    const created = await ChangelogRepository.create(
      { subject: dto.subject, createdById: actorId },
      dto.items,
      Array.from(recipients, ([email, userId]) => ({ email, userId })),
    )
    if (!created.ok) {
      auditMutation({
        entity: 'changelog',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: created.error.code,
      })
      return created
    }

    auditMutation({
      entity: 'changelog',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: { recipientCount: recipients.size, itemCount: dto.items.length },
    })

    return ok(toChangelogDetailDTO(created.value))
  },

  async start(
    actorId: string,
    id: string,
  ): Promise<Result<ChangelogDetailDTO>> {
    const admin = await assertPlatformAdmin(actorId)
    if (!admin.ok) return admin

    const existing = await ChangelogRepository.findById(id)
    if (!existing.ok) return existing
    if (!existing.value) return err(changelogNotFound())
    if (existing.value.status !== 'DRAFT') return err(changelogLocked())

    const queue = getChangelogQueue()
    await queue.addBulk(
      existing.value.recipients.map((recipient, index) => ({
        name: ChangelogJob.SendChangelogEmail,
        data: { changelogId: id, recipientId: recipient.id },
        opts: { delay: index * STAGGER_DELAY_MS },
      })),
    )

    const updated = await ChangelogRepository.updateStatus(id, 'RUNNING')
    if (!updated.ok) return updated

    auditMutation({
      entity: 'changelog',
      action: 'start',
      actorId,
      targetId: id,
      meta: { recipientCount: existing.value.recipients.length },
    })

    const refreshed = await ChangelogRepository.findById(id)
    if (!refreshed.ok) return refreshed
    if (!refreshed.value) return err(changelogNotFound())

    return ok(toChangelogDetailDTO(refreshed.value))
  },
}
