import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdChangeWindow } from '@/src/__tests__/factories/sd-change.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdChangeWindowSchema,
  SdChangeCalendarQuerySchema,
} from '@/src/schemas/sd-change-window.schema'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-change-window.repository')
vi.mock('@/src/repositories/sd-change-schedule.repository')
vi.mock('@/src/repositories/sd-config.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { SdChangeScheduleRepository } from '@/src/repositories/sd-change-schedule.repository'
import { SdChangeWindowRepository } from '@/src/repositories/sd-change-window.repository'
import { SdConfigRepository } from '@/src/repositories/sd-config.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdChangeWindowService } from '../sd-change-window.service'

const repo = vi.mocked(SdChangeWindowRepository)
const schedule = vi.mocked(SdChangeScheduleRepository)
const configRepo = vi.mocked(SdConfigRepository)
const ctxRepo = vi.mocked(SdTicketContextRepository)

const at = (iso: string) => new Date(iso)

const input = CreateSdChangeWindowSchema.parse({
  name: 'Janela de manutenção',
  startsAt: '2026-10-03T02:00:00.000Z',
  endsAt: '2026-10-03T06:00:00.000Z',
})

const query = SdChangeCalendarQuerySchema.parse({
  from: '2026-10-01T00:00:00.000Z',
  to: '2026-11-01T00:00:00.000Z',
})

function change(overrides: Record<string, unknown> = {}) {
  return {
    id: 't1',
    number: 42,
    type: 'CHANGE' as const,
    title: 'Troca de disco',
    plannedStartAt: at('2026-10-10T02:00:00.000Z'),
    plannedEndAt: at('2026-10-10T06:00:00.000Z'),
    changeType: null,
    changeRisk: null,
    configItemId: 'ci1',
    departmentId: 'dep-1',
    phase: { id: 'p1', name: 'Planejada', category: 'IN_PROGRESS' as const },
    configItem: { id: 'ci1', name: 'Servidor' },
    assignee: null,
    ...overrides,
  }
}

beforeEach(() => {
  actAs('admin')
  repo.list.mockResolvedValue(ok([createFakeSdChangeWindow()]))
  repo.listForRange.mockResolvedValue(ok([]))
  repo.findById.mockResolvedValue(ok(createFakeSdChangeWindow()))
  repo.create.mockResolvedValue(ok(createFakeSdChangeWindow()))
  repo.update.mockResolvedValue(
    ok(createFakeSdChangeWindow({ name: 'Renomeada' })),
  )
  repo.softDelete.mockResolvedValue(ok(undefined))
  schedule.listInRange.mockResolvedValue(ok([]))
  configRepo.findExistingRefs.mockResolvedValue(
    ok({ departmentIds: ['dep-1'] }),
  )
  ctxRepo.ensureSettings.mockResolvedValue(ok(createFakeSdSettings()))
})

describe('SdChangeWindowService.list', () => {
  it('lets any agent read the windows', async () => {
    actAs('agent')
    const list = expectOk(await SdChangeWindowService.list('u1', 'ws1'))
    expect(list[0].name).toBe('Janela de manutenção · sábado')
  })

  it('refuses a requester and a stranger', async () => {
    actAs('requester')
    expectErr(await SdChangeWindowService.list('u1', 'ws1'), 'SD_NOT_AGENT')
    actAs('stranger')
    expectErr(await SdChangeWindowService.list('u1', 'ws1'), 'FORBIDDEN')
  })

  it('refuses when the module is disabled', async () => {
    actAs('disabled')
    expectErr(await SdChangeWindowService.list('u1', 'ws1'), 'MODULE_DISABLED')
  })

  it('forwards the kind filter and propagates db errors', async () => {
    expectOk(await SdChangeWindowService.list('u1', 'ws1', { kind: 'FREEZE' }))
    expect(repo.list).toHaveBeenCalledWith('ws1', { kind: 'FREEZE' })
    repo.list.mockResolvedValue(err(databaseError()))
    expectErr(await SdChangeWindowService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })
})

describe('SdChangeWindowService.create', () => {
  it('creates and audits', async () => {
    const created = expectOk(
      await SdChangeWindowService.create('u1', 'ws1', input),
    )
    expect(created.kind).toBe('MAINTENANCE')
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      'u1',
      expect.objectContaining({ name: 'Janela de manutenção' }),
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_change_window', action: 'create' }),
    )
  })

  it('only admins create', async () => {
    actAs('agent')
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', input),
      'FORBIDDEN',
    )
    actAs('viewer')
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', input),
      'FORBIDDEN',
    )
  })

  it('refuses an end before the start', async () => {
    const e = expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        endsAt: at('2026-10-03T01:00:00.000Z'),
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
    expect(e.message).toContain('depois do início')
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('refuses a zero-length window', async () => {
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        endsAt: input.startsAt,
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
  })

  it('refuses a window longer than a year', async () => {
    const e = expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        endsAt: at('2028-10-03T06:00:00.000Z'),
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
    expect(e.message).toContain('um ano')
  })

  it('refuses an invalid date', async () => {
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        startsAt: new Date('nope'),
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
  })

  it('refuses a recurrence that ends before the first occurrence', async () => {
    const e = expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        recurrence: {
          freq: 'WEEKLY',
          interval: 1,
          byDay: [],
          until: '2026-09-01',
          count: null,
        },
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
    expect(e.message).toContain('antes da primeira ocorrência')
  })

  it('accepts a recurrence that ends after the first occurrence', async () => {
    expectOk(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        recurrence: {
          freq: 'WEEKLY',
          interval: 1,
          byDay: [],
          until: '2026-12-01',
          count: null,
        },
      }),
    )
    expect(repo.create).toHaveBeenCalledWith(
      'ws1',
      'u1',
      expect.objectContaining({
        recurrence: expect.objectContaining({ freq: 'WEEKLY' }),
      }),
    )
  })

  it('refuses a department from another workspace', async () => {
    configRepo.findExistingRefs.mockResolvedValue(ok({ departmentIds: [] }))
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', {
        ...input,
        departmentIds: ['dep-x'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates a db error from the repository', async () => {
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdChangeWindowService.create('u1', 'ws1', input),
      'DATABASE_ERROR',
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })
})

describe('SdChangeWindowService.update', () => {
  it('updates and audits the touched fields', async () => {
    const updated = expectOk(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        name: 'Renomeada',
      }),
    )
    expect(updated.name).toBe('Renomeada')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_change_window',
        action: 'update',
        meta: expect.objectContaining({ fields: ['name'] }),
      }),
    )
  })

  it('clears the recurrence with DbNull', async () => {
    expectOk(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        recurrence: null,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith('w1', 'ws1', {
      recurrence: Prisma.DbNull,
    })
  })

  it('maps the whole dto, clearing the description', async () => {
    expectOk(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        kind: 'FREEZE',
        timezone: 'UTC',
        configItemIds: ['ci1'],
        departmentIds: ['dep-1'],
        description: null,
      }),
    )
    expect(repo.update).toHaveBeenCalledWith('w1', 'ws1', {
      kind: 'FREEZE',
      timezone: 'UTC',
      configItemIds: ['ci1'],
      departmentIds: ['dep-1'],
      description: null,
    })
  })

  it('validates the period against the stored dates', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdChangeWindow({
          startsAt: at('2026-10-03T02:00:00.000Z'),
          endsAt: at('2026-10-03T06:00:00.000Z'),
        }),
      ),
    )
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        endsAt: at('2026-10-03T01:00:00.000Z'),
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
    expectOk(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        startsAt: at('2026-10-02T02:00:00.000Z'),
      }),
    )
  })

  it('refuses an unknown window and non-admins', async () => {
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'nope', { name: 'X' }),
      'SD_CONFIG_NOT_FOUND',
    )
    actAs('agent')
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', { name: 'X' }),
      'FORBIDDEN',
    )
  })

  it('refuses a recurrence ending before the stored start', async () => {
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        recurrence: {
          freq: 'DAILY',
          interval: 1,
          byDay: [],
          until: '2026-09-01',
          count: null,
        },
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
  })

  it('checks the departments it is given', async () => {
    configRepo.findExistingRefs.mockResolvedValue(ok({ departmentIds: [] }))
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', {
        departmentIds: ['dep-x'],
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates a db error from the update', async () => {
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdChangeWindowService.update('u1', 'ws1', 'w1', { name: 'X' }),
      'DATABASE_ERROR',
    )
  })
})

describe('SdChangeWindowService.remove', () => {
  it('soft-deletes and audits', async () => {
    expectOk(await SdChangeWindowService.remove('u1', 'ws1', 'w1'))
    expect(repo.softDelete).toHaveBeenCalledWith('w1', 'ws1')
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_change_window', action: 'delete' }),
    )
  })

  it('refuses an unknown window and non-admins', async () => {
    repo.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdChangeWindowService.remove('u1', 'ws1', 'nope'),
      'SD_CONFIG_NOT_FOUND',
    )
    actAs('agent')
    expectErr(
      await SdChangeWindowService.remove('u1', 'ws1', 'w1'),
      'FORBIDDEN',
    )
  })
})

describe('SdChangeWindowService.calendar', () => {
  it('expands the windows and places the changes', async () => {
    repo.listForRange.mockResolvedValue(
      ok([
        createFakeSdChangeWindow({
          id: 'w1',
          startsAt: at('2026-10-03T02:00:00.000Z'),
          endsAt: at('2026-10-03T06:00:00.000Z'),
          recurrence: { freq: 'WEEKLY', interval: 1, byDay: [] },
        }),
      ]),
    )
    schedule.listInRange.mockResolvedValue(ok([change()]))

    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.from).toBe('2026-10-01T00:00:00.000Z')
    // Os sábados de outubro/2026: 03, 10, 17, 24, 31.
    expect(calendar.windows).toHaveLength(5)
    expect(calendar.windows[0].recurring).toBe(false)
    expect(calendar.windows[1].recurring).toBe(true)
    expect(calendar.changes).toHaveLength(1)
    expect(calendar.changes[0].code).toBe('CHG-000042')
    expect(calendar.changes[0].frozenWindowIds).toEqual([])
  })

  it('flags a change covered by a freeze window', async () => {
    repo.listForRange.mockResolvedValue(
      ok([
        createFakeSdChangeWindow({
          id: 'frz',
          kind: 'FREEZE',
          startsAt: at('2026-10-01T00:00:00.000Z'),
          endsAt: at('2026-10-15T00:00:00.000Z'),
        }),
      ]),
    )
    schedule.listInRange.mockResolvedValue(ok([change()]))
    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.changes[0].frozenWindowIds).toEqual(['frz'])
  })

  it('ignores a freeze window scoped to another config item', async () => {
    repo.listForRange.mockResolvedValue(
      ok([
        createFakeSdChangeWindow({
          id: 'frz',
          kind: 'FREEZE',
          startsAt: at('2026-10-01T00:00:00.000Z'),
          endsAt: at('2026-10-15T00:00:00.000Z'),
          configItemIds: ['outro'],
        }),
      ]),
    )
    schedule.listInRange.mockResolvedValue(ok([change()]))
    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.changes[0].frozenWindowIds).toEqual([])
  })

  it('pairs up the changes that share a config item', async () => {
    schedule.listInRange.mockResolvedValue(
      ok([
        change(),
        change({
          id: 't2',
          number: 43,
          plannedStartAt: at('2026-10-10T05:00:00.000Z'),
          plannedEndAt: at('2026-10-10T09:00:00.000Z'),
        }),
      ]),
    )
    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.changes[0].conflictTicketIds).toEqual(['t2'])
    expect(calendar.changes[1].conflictTicketIds).toEqual(['t1'])
  })

  it('does not pair a closed change nor one on another item', async () => {
    schedule.listInRange.mockResolvedValue(
      ok([
        change(),
        change({
          id: 't2',
          phase: { id: 'p2', name: 'Encerrada', category: 'CLOSED' },
        }),
        change({ id: 't3', configItemId: 'outro' }),
        change({
          id: 't4',
          plannedStartAt: at('2026-10-20T02:00:00.000Z'),
          plannedEndAt: at('2026-10-20T06:00:00.000Z'),
        }),
      ]),
    )
    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.changes[0].conflictTicketIds).toEqual([])
  })

  it('does not look for rivals for a closed change or one with no item', async () => {
    schedule.listInRange.mockResolvedValue(
      ok([
        change({
          id: 't1',
          phase: { id: 'p2', name: 'Encerrada', category: 'CANCELED' },
        }),
        change({ id: 't2' }),
        change({ id: 't3', configItemId: null, configItem: null }),
      ]),
    )
    const calendar = expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
    )
    expect(calendar.changes[0].conflictTicketIds).toEqual([])
    expect(calendar.changes[2].conflictTicketIds).toEqual([])
  })

  it('refuses a requester and a range over 400 days', async () => {
    actAs('requester')
    expectErr(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
      'SD_NOT_AGENT',
    )
    actAs('agent')
    const e = expectErr(
      await SdChangeWindowService.calendar('u1', 'ws1', {
        from: at('2026-01-01T00:00:00.000Z'),
        to: at('2028-01-01T00:00:00.000Z'),
      }),
      'SD_CHANGE_WINDOW_INVALID',
    )
    expect(e.message).toContain('400 dias')
  })

  it('forwards the kind filter', async () => {
    expectOk(
      await SdChangeWindowService.calendar('u1', 'ws1', {
        ...query,
        kind: 'FREEZE',
      }),
    )
    expect(repo.listForRange).toHaveBeenCalledWith(
      'ws1',
      { from: query.from, to: query.to },
      { kind: 'FREEZE' },
    )
  })

  it('propagates db errors from each source', async () => {
    repo.listForRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
      'DATABASE_ERROR',
    )
    repo.listForRange.mockResolvedValue(ok([]))
    schedule.listInRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
      'DATABASE_ERROR',
    )
    schedule.listInRange.mockResolvedValue(ok([]))
    ctxRepo.ensureSettings.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdChangeWindowService.calendar('u1', 'ws1', query),
      'DATABASE_ERROR',
    )
  })
})
