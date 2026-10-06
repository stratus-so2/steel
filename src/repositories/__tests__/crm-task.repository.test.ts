import { describe, expect, it, vi } from 'vitest'
import { seedCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { seedCrmOpportunity } from '@/src/__tests__/factories/crm-opportunity.factory'
import { seedCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import {
  seedCrmPipeline,
  seedCrmPipelineStage,
} from '@/src/__tests__/factories/crm-pipeline.factory'
import { seedCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmTaskRepository } from '../crm-task.repository'

describe('CrmTaskRepository', () => {
  describe('listByWorkspace()', () => {
    it('should filter by status and exclude soft-deleted', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const done = await seedCrmTask(workspace.id, user.id, {
        status: 'DONE',
      })
      await seedCrmTask(workspace.id, user.id, { status: 'TODO' })
      await seedCrmTask(workspace.id, user.id, {
        status: 'DONE',
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmTaskRepository.listByWorkspace(workspace.id, {
          status: 'DONE',
        }),
      )
      expect(list.map((t) => t.id)).toEqual([done.id])
    })
  })

  describe('findById()', () => {
    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmTask(workspaceA.id, user.id)

      expectErr(
        await CrmTaskRepository.findById(seeded.id, workspaceB.id),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('reorder()', () => {
    it('should update positions across the whole workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmTask(workspace.id, user.id)
      const b = await seedCrmTask(workspace.id, user.id)

      expectOk(await CrmTaskRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmTaskRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((t) => t.id)).toEqual([b.id, a.id])
    })
  })

  describe('listByWorkspace() relation filters', () => {
    it('should filter by company, person and opportunity, scoped to the workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const company = await seedCrmCompany(workspace.id, user.id)
      const person = await seedCrmPerson(workspace.id, user.id)
      const pipeline = await seedCrmPipeline(workspace.id, user.id)
      const stage = await seedCrmPipelineStage(pipeline.id)
      const opportunity = await seedCrmOpportunity(
        workspace.id,
        user.id,
        pipeline.id,
        stage.id,
      )
      const byCompany = await seedCrmTask(workspace.id, user.id, {
        companyId: company.id,
      })
      const byPerson = await seedCrmTask(workspace.id, user.id, {
        personId: person.id,
      })
      const byOpportunity = await seedCrmTask(workspace.id, user.id, {
        opportunityId: opportunity.id,
      })
      await seedCrmTask(other.id, user.id)

      const ids = async (
        filters: Parameters<typeof CrmTaskRepository.listByWorkspace>[1],
      ) =>
        expectOk(
          await CrmTaskRepository.listByWorkspace(workspace.id, filters),
        ).map((t) => t.id)

      expect(await ids({ companyId: company.id })).toEqual([byCompany.id])
      expect(await ids({ personId: person.id })).toEqual([byPerson.id])
      expect(await ids({ opportunityId: opportunity.id })).toEqual([
        byOpportunity.id,
      ])
      expect(await ids(undefined)).toHaveLength(3)
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('should append, update and soft delete a task', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmTask(workspace.id, user.id)
      const dueDate = new Date('2026-10-01T12:00:00Z')

      const task = expectOk(
        await CrmTaskRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          title: 'Ligar',
          dueDate,
          assigneeId: user.id,
        }),
      )
      expect(task.position).toBe(1)
      expect(task.status).toBe('TODO')
      expect(task.dueDate?.toISOString()).toBe(dueDate.toISOString())
      expect(
        expectOk(await CrmTaskRepository.findById(task.id, workspace.id)).title,
      ).toBe('Ligar')

      const updated = expectOk(
        await CrmTaskRepository.update(task.id, {
          status: 'DONE',
          dueDate: null,
          assigneeId: null,
          updatedById: user.id,
        }),
      )
      expect(updated.status).toBe('DONE')
      expect(updated.dueDate).toBeNull()
      expect(updated.assigneeId).toBeNull()

      expectOk(await CrmTaskRepository.softDelete(task.id))
      expectErr(
        await CrmTaskRepository.findById(task.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when writes hit missing rows or FKs', async () => {
      const user = await seedUser()
      expectErr(
        await CrmTaskRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          title: 'X',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmTaskRepository.update('missing', { title: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(await CrmTaskRepository.softDelete('missing'), 'DATABASE_ERROR')
    })

    it('should not reorder tasks of another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmTask(other.id, user.id, { position: 3 })

      expectErr(
        await CrmTaskRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
      const stored = await prisma.crmTask.findUniqueOrThrow({
        where: { id: foreign.id },
      })
      expect(stored.position).toBe(3)
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      const list = vi
        .spyOn(prisma.crmTask, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
      const find = vi
        .spyOn(prisma.crmTask, 'findFirst')
        .mockRejectedValueOnce(new Error('boom'))
      expectErr(await CrmTaskRepository.listByWorkspace('w'), 'DATABASE_ERROR')
      expectErr(await CrmTaskRepository.findById('t', 'w'), 'DATABASE_ERROR')
      list.mockRestore()
      find.mockRestore()
    })
  })
})

describe('CrmTaskRepository.listDueForReminder()', () => {
  const NOW = new Date('2026-10-06T12:00:00.000Z')
  const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

  async function enableCrm(workspaceId: string, grantedById: string) {
    await prisma.workspaceModuleAccess.create({
      data: { workspaceId, module: 'CRM', enabled: true, grantedById },
    })
  }

  it('should list open, assigned tasks in the window of CRM-enabled workspaces', async () => {
    const [workspace, disabled, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    await enableCrm(workspace.id, user.id)

    const task = (
      workspaceId: string,
      dueDate: Date | null,
      extra: Record<string, unknown> = {},
    ) =>
      prisma.crmTask.create({
        data: {
          title: 'Seed Task',
          workspaceId,
          createdById: user.id,
          assigneeId: user.id,
          dueDate,
          ...extra,
        },
      })

    const soon = await task(workspace.id, at(30))
    const late = await task(workspace.id, at(-30))
    await Promise.all([
      task(workspace.id, at(120)), // beyond the window
      task(workspace.id, at(-60 * 48)), // older than the lookback
      task(workspace.id, at(10), { status: 'DONE' }),
      task(workspace.id, at(10), { assigneeId: null }),
      task(workspace.id, at(10), { deletedAt: new Date() }),
      task(workspace.id, null),
      task(disabled.id, at(10)), // CRM not enabled there
    ])

    const list = expectOk(
      await CrmTaskRepository.listDueForReminder(at(-60 * 24), at(60), 50),
    )

    expect(list.map((t) => t.id)).toEqual([late.id, soon.id])
  })

  it('should map a database failure to DATABASE_ERROR', async () => {
    vi.spyOn(prisma.crmTask, 'findMany').mockRejectedValueOnce(new Error('x'))

    expectErr(
      await CrmTaskRepository.listDueForReminder(NOW, NOW, 10),
      'DATABASE_ERROR',
    )
  })
})
