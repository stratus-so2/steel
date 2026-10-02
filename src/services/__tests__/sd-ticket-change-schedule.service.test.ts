import { beforeEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdNotAgent } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/sd-change-window.repository')
vi.mock('@/src/repositories/sd-change-schedule.repository')
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
}))

import { SdChangeScheduleRepository } from '@/src/repositories/sd-change-schedule.repository'
import { SdChangeWindowRepository } from '@/src/repositories/sd-change-window.repository'
import { SdTicketChangeScheduleService } from '../sd-ticket-change-schedule.service'
import { loadSdTicketTab } from '../sd-ticket-tab-support'

const load = vi.mocked(loadSdTicketTab)
const windowRepo = vi.mocked(SdChangeWindowRepository)
const scheduleRepo = vi.mocked(SdChangeScheduleRepository)

const PLANNED = {
  type: 'CHANGE' as const,
  configItemId: 'ci1',
  plannedStartAt: new Date('2026-10-10T02:00:00.000Z'),
  plannedEndAt: new Date('2026-10-10T06:00:00.000Z'),
}

beforeEach(() => {
  load.mockResolvedValue(ok(sdTabScope({ ticket: PLANNED })))
  windowRepo.listForRange.mockResolvedValue(ok([]))
  scheduleRepo.findConflicts.mockResolvedValue(ok([]))
  scheduleRepo.findConfigItemName.mockResolvedValue(ok('Servidor'))
})

describe('SdTicketChangeScheduleService.get', () => {
  it('builds the panel from the ticket it loaded', async () => {
    const panel = expectOk(
      await SdTicketChangeScheduleService.get('u1', 'ws1', '7'),
    )
    expect(panel).toMatchObject({
      ticketId: 't1',
      plannedStartAt: '2026-10-10T02:00:00.000Z',
      plannedEndAt: '2026-10-10T06:00:00.000Z',
      configItemId: 'ci1',
      configItemName: 'Servidor',
      warnings: [],
      windows: [],
    })
    expect(load).toHaveBeenCalledWith('u1', 'ws1', '7', 'VIEW', {
      agentOnly: true,
    })
  })

  it('refuses a requester', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await SdTicketChangeScheduleService.get('u1', 'ws1', '7'),
      'SD_NOT_AGENT',
    )
    expect(windowRepo.listForRange).not.toHaveBeenCalled()
  })

  it('propagates a db error from the check', async () => {
    windowRepo.listForRange.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTicketChangeScheduleService.get('u1', 'ws1', '7'),
      'DATABASE_ERROR',
    )
  })
})
