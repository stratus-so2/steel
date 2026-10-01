import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdTicketTask } from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdNotAgent } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/sd-ticket-task.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { touchActivity: vi.fn() },
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))
vi.mock('../sd-ticket-notifier', () => ({
  SdTicketNotifier: { notify: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketTaskRepository } from '@/src/repositories/sd-ticket-task.repository'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { SdTicketNotifier } from '../sd-ticket-notifier'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'
import { SdTicketTaskService } from '../sd-ticket-task.service'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTicketTaskRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)
const notify = vi.mocked(SdTicketNotifier.notify)
const record = vi.mocked(recordSdTicketEvent)

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope()))
  ctxRepo.findNonMembers.mockResolvedValue(ok([]))
  repo.create.mockImplementation(async (data) =>
    ok(createFakeSdTicketTask({ ...data, id: 'k1' })),
  )
  repo.findById.mockResolvedValue(
    ok(createFakeSdTicketTask({ id: 'k1', assigneeId: 'a1' })),
  )
  repo.update.mockImplementation(async (id, data) =>
    ok(createFakeSdTicketTask({ id, assigneeId: 'a1', ...data })),
  )
  repo.delete.mockResolvedValue(ok(undefined))
  repo.reorder.mockResolvedValue(ok(undefined))
})

describe('list', () => {
  it('returns tasks with progress (agents only)', async () => {
    repo.list.mockResolvedValue(
      ok([
        createFakeSdTicketTask({ status: 'DONE' }),
        createFakeSdTicketTask({ status: 'TODO' }),
        createFakeSdTicketTask({ status: 'CANCELED' }),
      ]),
    )
    const out = expectOk(await SdTicketTaskService.list('u1', 'ws1', 't1'))
    expect(out.progress).toEqual({ done: 1, total: 2, percent: 50 })
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'VIEW', {
      agentOnly: true,
    })
  })

  it('propagates access and db errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketTaskService.list('r', 'ws1', 't1'), 'SD_NOT_AGENT')
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketTaskService.list('u1', 'ws1', 't1'),
      'DATABASE_ERROR',
    )
  })
})

describe('create', () => {
  it('creates, notifies the assignee and publishes internally', async () => {
    const due = new Date('2026-10-01T12:00:00Z')
    const dto = expectOk(
      await SdTicketTaskService.create('u1', 'ws1', 't1', {
        title: 'Trocar cabo',
        assigneeId: 'a1',
        dueDate: due,
        status: 'TODO',
      }),
    )
    expect(dto.id).toBe('k1')
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        ticketId: 't1',
        createdById: 'u1',
        assigneeId: 'a1',
        description: null,
        dueDate: due,
      }),
    )
    expect(repo.create.mock.calls[0]?.[0]).not.toHaveProperty('completedAt')
    expect(ctxRepo.findNonMembers).toHaveBeenCalledWith('ws1', ['a1'])
    expect(notify.mock.calls[0]?.[0]).toMatchObject({
      userIds: ['a1'],
      excludeUserIds: ['u1'],
      title: 'Tarefa atribuída a você em INC-000007',
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'task.created' }),
    )
    expect(publishSdTicketTab).toHaveBeenCalledWith(
      expect.anything(),
      'ticket.task',
      'u1',
      true,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_ticket_task', action: 'create' }),
    )
  })

  it('stamps completedAt when born DONE; no assignee → no notification', async () => {
    expectOk(
      await SdTicketTaskService.create('u1', 'ws1', 't1', {
        title: 'Feito',
        status: 'DONE',
      }),
    )
    expect(repo.create.mock.calls[0]?.[0].completedAt).toBeInstanceOf(Date)
    expect(repo.create.mock.calls[0]?.[0].assigneeId).toBeNull()
    expect(notify).not.toHaveBeenCalled()
    expect(ctxRepo.findNonMembers).not.toHaveBeenCalled()
  })

  it('rejects non-member assignees and propagates errors', async () => {
    ctxRepo.findNonMembers.mockResolvedValueOnce(ok(['x']))
    expectErr(
      await SdTicketTaskService.create('u1', 'ws1', 't1', {
        title: 'x',
        assigneeId: 'x',
        status: 'TODO',
      }),
      'VALIDATION_ERROR',
    )
    ctxRepo.findNonMembers.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.create('u1', 'ws1', 't1', {
        title: 'x',
        assigneeId: 'x',
        status: 'TODO',
      }),
      'DATABASE_ERROR',
    )
    repo.create.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.create('u1', 'ws1', 't1', {
        title: 'x',
        status: 'TODO',
      }),
      'DATABASE_ERROR',
    )
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketTaskService.create('r', 'ws1', 't1', {
        title: 'x',
        status: 'TODO',
      }),
      'SD_NOT_AGENT',
    )
    expect(load).toHaveBeenLastCalledWith('r', 'ws1', 't1', 'CREATE', {
      agentOnly: true,
      requireOpen: true,
    })
  })
})

describe('update', () => {
  it('completing stamps completedAt and records task.completed', async () => {
    const dto = expectOk(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        status: 'DONE',
      }),
    )
    expect(repo.update.mock.calls[0]?.[1].completedAt).toBeInstanceOf(Date)
    expect(dto.status).toBe('DONE')
    expect(record.mock.calls[0]?.[0].action).toBe('task.completed')
    expect(notify).not.toHaveBeenCalled()
    expect(repo.findById).toHaveBeenCalledWith('k1', 't1')
  })

  it('reopening clears completedAt; other statuses map to their events', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTicketTask({ id: 'k1', status: 'DONE', assigneeId: 'a1' }),
      ),
    )
    expectOk(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        status: 'TODO',
      }),
    )
    expect(repo.update.mock.calls[0]?.[1].completedAt).toBeNull()
    expect(record.mock.calls[0]?.[0].action).toBe('task.reopened')

    for (const [status, action] of [
      ['IN_PROGRESS', 'task.started'],
      ['CANCELED', 'task.canceled'],
    ] as const) {
      record.mockClear()
      expectOk(
        await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', { status }),
      )
      expect(record.mock.calls[0]?.[0].action).toBe(action)
    }
  })

  it('plain edits record task.updated; reassignment notifies', async () => {
    expectOk(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        title: 'Novo título',
        status: 'TODO',
      }),
    )
    expect(repo.update.mock.calls[0]?.[1]).not.toHaveProperty('completedAt')
    expect(record.mock.calls[0]?.[0].action).toBe('task.updated')

    expectOk(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        assigneeId: 'a2',
      }),
    )
    expect(notify.mock.calls[0]?.[0].userIds).toEqual(['a2'])

    notify.mockClear()
    expectOk(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        assigneeId: null,
      }),
    )
    expect(notify).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketTaskService.update('r', 'ws1', 't1', 'k1', { title: 'x' }),
      'SD_NOT_AGENT',
    )
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', { title: 'x' }),
      'DATABASE_ERROR',
    )
    ctxRepo.findNonMembers.mockResolvedValueOnce(ok(['z']))
    expectErr(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', {
        assigneeId: 'z',
      }),
      'VALIDATION_ERROR',
    )
    repo.update.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.update('u1', 'ws1', 't1', 'k1', { title: 'x' }),
      'DATABASE_ERROR',
    )
  })
})

describe('remove', () => {
  it('deletes with DELETE permission and records the event', async () => {
    expectOk(await SdTicketTaskService.remove('u1', 'ws1', 't1', 'k1'))
    expect(load).toHaveBeenCalledWith('u1', 'ws1', 't1', 'DELETE', {
      agentOnly: true,
      requireOpen: true,
    })
    expect(repo.delete).toHaveBeenCalledWith('k1')
    expect(record.mock.calls[0]?.[0].action).toBe('task.deleted')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'delete' }),
    )
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(await SdTicketTaskService.remove('r', 'ws1', 't1', 'k1'))
    repo.findById.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTicketTaskService.remove('u1', 'ws1', 't1', 'k1'))
    repo.delete.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.remove('u1', 'ws1', 't1', 'k1'),
      'DATABASE_ERROR',
    )
  })
})

describe('reorder', () => {
  const tasks = [
    createFakeSdTicketTask({ id: 'a' }),
    createFakeSdTicketTask({ id: 'b' }),
  ]

  it('reorders the full list and returns it', async () => {
    repo.list.mockResolvedValue(ok(tasks))
    const out = expectOk(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['b', 'a'],
      }),
    )
    expect(repo.reorder).toHaveBeenCalledWith('t1', ['b', 'a'])
    expect(out.items).toHaveLength(2)
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reorder' }),
    )
  })

  it('rejects unknown or duplicated ids', async () => {
    repo.list.mockResolvedValue(ok(tasks))
    expectErr(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['a', 'zzz'],
      }),
      'VALIDATION_ERROR',
    )
    expectErr(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['a', 'a'],
      }),
      'VALIDATION_ERROR',
    )
    expect(repo.reorder).not.toHaveBeenCalled()
  })

  it('propagates errors', async () => {
    load.mockResolvedValueOnce(err(sdNotAgent()))
    expectErr(
      await SdTicketTaskService.reorder('r', 'ws1', 't1', {
        orderedIds: ['a'],
      }),
    )
    repo.list.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['a'],
      }),
    )
    repo.list.mockResolvedValue(ok(tasks))
    repo.reorder.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['a'],
      }),
    )
    repo.list
      .mockResolvedValueOnce(ok(tasks))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await SdTicketTaskService.reorder('u1', 'ws1', 't1', {
        orderedIds: ['a'],
      }),
      'DATABASE_ERROR',
    )
  })
})
