import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdChangeWindow } from '@/src/__tests__/factories/sd-change.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/sd-change-window.repository')
vi.mock('@/src/repositories/sd-change-schedule.repository')

import { SdChangeScheduleRepository } from '@/src/repositories/sd-change-schedule.repository'
import { SdChangeWindowRepository } from '@/src/repositories/sd-change-window.repository'
import {
  checkSdChangeSchedule,
  loadSdTicketChangeSchedule,
  type SdChangeTarget,
  sdAssertChangeSchedule,
  sdHasPlannedWindow,
} from '../sd-change-schedule'

const windowRepo = vi.mocked(SdChangeWindowRepository)
const scheduleRepo = vi.mocked(SdChangeScheduleRepository)

const at = (iso: string) => new Date(iso)

function target(overrides: Partial<SdChangeTarget> = {}): SdChangeTarget {
  return {
    workspaceId: 'ws1',
    ticketId: 't1',
    type: 'CHANGE',
    configItemId: 'ci1',
    departmentId: 'dep-1',
    plannedStartAt: at('2026-10-10T02:00:00.000Z'),
    plannedEndAt: at('2026-10-10T06:00:00.000Z'),
    ...overrides,
  }
}

const freeze = (overrides = {}) =>
  createFakeSdChangeWindow({
    id: 'frz',
    name: 'Congelamento de outubro',
    kind: 'FREEZE',
    startsAt: at('2026-10-01T00:00:00.000Z'),
    endsAt: at('2026-11-01T00:00:00.000Z'),
    ...overrides,
  })

const rival = (overrides = {}) => ({
  id: 't2',
  number: 7,
  type: 'CHANGE' as const,
  title: 'Outra mudança',
  plannedStartAt: at('2026-10-10T05:00:00.000Z'),
  plannedEndAt: at('2026-10-10T09:00:00.000Z'),
  changeType: null,
  changeRisk: null,
  configItemId: 'ci1',
  departmentId: 'dep-1',
  phase: { id: 'p1', name: 'Planejada', category: 'IN_PROGRESS' as const },
  configItem: { id: 'ci1', name: 'Servidor' },
  assignee: null,
  ...overrides,
})

beforeEach(() => {
  windowRepo.listForRange.mockResolvedValue(ok([]))
  scheduleRepo.findConflicts.mockResolvedValue(ok([]))
  scheduleRepo.findConfigItemName.mockResolvedValue(ok('Servidor'))
})

describe('sdHasPlannedWindow', () => {
  it('accepts a change with both ends of the window', () => {
    expect(sdHasPlannedWindow(target())).toBe(true)
  })

  it('refuses another ticket type and a missing or inverted window', () => {
    expect(sdHasPlannedWindow(target({ type: 'INCIDENT' }))).toBe(false)
    expect(sdHasPlannedWindow(target({ plannedStartAt: null }))).toBe(false)
    expect(sdHasPlannedWindow(target({ plannedEndAt: null }))).toBe(false)
    expect(
      sdHasPlannedWindow(
        target({ plannedEndAt: at('2026-10-10T01:00:00.000Z') }),
      ),
    ).toBe(false)
  })
})

describe('checkSdChangeSchedule', () => {
  it('returns nothing without a planned window', async () => {
    const checked = expectOk(
      await checkSdChangeSchedule(target({ plannedStartAt: null })),
    )
    expect(checked).toEqual({ warnings: [], windows: [] })
    expect(windowRepo.listForRange).not.toHaveBeenCalled()
  })

  it('warns about a freeze window that covers the period', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    const checked = expectOk(await checkSdChangeSchedule(target()))
    expect(checked.warnings).toHaveLength(1)
    expect(checked.warnings[0]).toMatchObject({
      kind: 'FREEZE',
      windowId: 'frz',
      windowName: 'Congelamento de outubro',
      ticketId: null,
    })
    expect(checked.warnings[0].message).toContain('Congelamento de outubro')
    expect(checked.windows).toHaveLength(1)
  })

  it('lists a maintenance window without warning about it', async () => {
    windowRepo.listForRange.mockResolvedValue(
      ok([freeze({ id: 'mnt', kind: 'MAINTENANCE' })]),
    )
    const checked = expectOk(await checkSdChangeSchedule(target()))
    expect(checked.warnings).toEqual([])
    expect(checked.windows.map((w) => w.windowId)).toEqual(['mnt'])
  })

  it('ignores a window scoped to another config item or department', async () => {
    windowRepo.listForRange.mockResolvedValue(
      ok([freeze({ configItemIds: ['outro'] })]),
    )
    expect(expectOk(await checkSdChangeSchedule(target())).warnings).toEqual([])
    windowRepo.listForRange.mockResolvedValue(
      ok([freeze({ departmentIds: ['dep-9'] })]),
    )
    expect(expectOk(await checkSdChangeSchedule(target())).warnings).toEqual([])
  })

  it('expands a recurring freeze window', async () => {
    windowRepo.listForRange.mockResolvedValue(
      ok([
        freeze({
          startsAt: at('2026-01-10T02:00:00.000Z'),
          endsAt: at('2026-01-10T06:00:00.000Z'),
          recurrence: { freq: 'MONTHLY', interval: 1, byDay: [] },
        }),
      ]),
    )
    const checked = expectOk(
      await checkSdChangeSchedule(
        target({
          plannedStartAt: at('2026-10-10T03:00:00.000Z'),
          plannedEndAt: at('2026-10-10T05:00:00.000Z'),
        }),
      ),
    )
    expect(checked.warnings).toHaveLength(1)
    expect(checked.warnings[0].startsAt).toBe('2026-10-10T02:00:00.000Z')
  })

  it('warns about a rival change on the same config item', async () => {
    scheduleRepo.findConflicts.mockResolvedValue(ok([rival()]))
    const checked = expectOk(await checkSdChangeSchedule(target()))
    expect(checked.warnings[0]).toMatchObject({
      kind: 'CONFLICT',
      ticketId: 't2',
      ticketNumber: 7,
      ticketTitle: 'Outra mudança',
      windowId: null,
    })
    expect(checked.warnings[0].message).toContain('#7')
  })

  it('puts the freeze before the conflict', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    scheduleRepo.findConflicts.mockResolvedValue(ok([rival()]))
    const checked = expectOk(await checkSdChangeSchedule(target()))
    expect(checked.warnings.map((w) => w.kind)).toEqual(['FREEZE', 'CONFLICT'])
  })

  it('propagates db errors from both sources', async () => {
    windowRepo.listForRange.mockResolvedValue(err(databaseError()))
    expectErr(await checkSdChangeSchedule(target()), 'DATABASE_ERROR')
    windowRepo.listForRange.mockResolvedValue(ok([]))
    scheduleRepo.findConflicts.mockResolvedValue(err(databaseError()))
    expectErr(await checkSdChangeSchedule(target()), 'DATABASE_ERROR')
  })
})

describe('sdAssertChangeSchedule', () => {
  it('passes through when there is nothing to warn about', async () => {
    expect(expectOk(await sdAssertChangeSchedule(target()))).toEqual({
      forced: [],
    })
  })

  it('refuses a freeze with SD_CHANGE_FROZEN and the warnings in details', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    const e = expectErr(
      await sdAssertChangeSchedule(target()),
      'SD_CHANGE_FROZEN',
    )
    expect(e.message).toContain('administrador do ServiceDesk')
    expect(
      (e.details as { warnings: { kind: string }[] }).warnings[0].kind,
    ).toBe('FREEZE')
  })

  it('tells an admin to confirm instead', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    const e = expectErr(
      await sdAssertChangeSchedule(target(), { isAdmin: true }),
      'SD_CHANGE_FROZEN',
    )
    expect(e.message).toContain('Confirme para agendar')
  })

  it('refuses a conflict with SD_CHANGE_CONFLICT', async () => {
    scheduleRepo.findConflicts.mockResolvedValue(ok([rival()]))
    expectErr(await sdAssertChangeSchedule(target()), 'SD_CHANGE_CONFLICT')
  })

  it('lets an admin confirm and returns what was forced', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    scheduleRepo.findConflicts.mockResolvedValue(ok([rival()]))
    const guard = expectOk(
      await sdAssertChangeSchedule(target(), { confirm: true, isAdmin: true }),
    )
    expect(guard.forced.map((w) => w.kind)).toEqual(['FREEZE', 'CONFLICT'])
  })

  it('ignores a confirmation from a non-admin', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    expectErr(
      await sdAssertChangeSchedule(target(), { confirm: true }),
      'SD_CHANGE_FROZEN',
    )
  })

  it('propagates a db error', async () => {
    windowRepo.listForRange.mockResolvedValue(err(databaseError()))
    expectErr(await sdAssertChangeSchedule(target()), 'DATABASE_ERROR')
  })
})

describe('loadSdTicketChangeSchedule', () => {
  it('builds the ticket panel with the config item name', async () => {
    windowRepo.listForRange.mockResolvedValue(ok([freeze()]))
    const block = expectOk(await loadSdTicketChangeSchedule(target()))
    expect(block).toMatchObject({
      ticketId: 't1',
      plannedStartAt: '2026-10-10T02:00:00.000Z',
      plannedEndAt: '2026-10-10T06:00:00.000Z',
      configItemId: 'ci1',
      configItemName: 'Servidor',
    })
    expect(block.warnings).toHaveLength(1)
    expect(block.windows).toHaveLength(1)
  })

  it('works without a config item or a planned window', async () => {
    const block = expectOk(
      await loadSdTicketChangeSchedule(
        target({
          configItemId: null,
          plannedStartAt: null,
          plannedEndAt: null,
        }),
      ),
    )
    expect(block).toEqual({
      ticketId: 't1',
      plannedStartAt: null,
      plannedEndAt: null,
      configItemId: null,
      configItemName: null,
      windows: [],
      warnings: [],
    })
    expect(scheduleRepo.findConfigItemName).not.toHaveBeenCalled()
  })

  it('propagates a db error from the config item lookup', async () => {
    scheduleRepo.findConfigItemName.mockResolvedValue(err(databaseError()))
    expectErr(await loadSdTicketChangeSchedule(target()), 'DATABASE_ERROR')
  })

  it('propagates a db error from the check', async () => {
    windowRepo.listForRange.mockResolvedValue(err(databaseError()))
    expectErr(await loadSdTicketChangeSchedule(target()), 'DATABASE_ERROR')
  })
})
