import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdRecurringRun,
  createFakeSdRecurringTicket,
} from '@/src/__tests__/factories/sd-recurring-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { actAs } from '@/src/__tests__/helpers/sd-config.helpers'
import { databaseError, sdConfigNotFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type {
  CreateSdRecurringTicketDTO,
  UpdateSdRecurringTicketDTO,
} from '@/src/schemas/sd-recurring-ticket.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/sd-access.repository')
vi.mock('@/src/repositories/sd-recurring-ticket.repository')
vi.mock('@/lib/axiom/audit')
vi.mock('../sd-config-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-config-support')>()),
  assertSdRefs: vi.fn(async () => ok(true)),
}))
vi.mock('../sd-recurring-ticket-runner', () => ({
  openSdRecurringOccurrence: vi.fn(),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import {
  SdRecurringTicketRepository,
  SdRecurringTicketRunRepository,
} from '@/src/repositories/sd-recurring-ticket.repository'
import { assertSdRefs } from '../sd-config-support'
import { SdRecurringTicketService } from '../sd-recurring-ticket.service'
import { openSdRecurringOccurrence } from '../sd-recurring-ticket-runner'
import { SdTicketEngine } from '../sd-ticket-engine'

const rules = vi.mocked(SdRecurringTicketRepository)
const runs = vi.mocked(SdRecurringTicketRunRepository)
const refs = vi.mocked(assertSdRefs)
const open = vi.mocked(openSdRecurringOccurrence)
const engine = vi.mocked(SdTicketEngine)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ADMIN = 'admin-1'
const NOW = new Date('2026-10-01T12:00:00.000Z')

const CONFIG = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}

const createDto: CreateSdRecurringTicketDTO = {
  name: 'Vistoria mensal do nobreak',
  description: 'Checar baterias e registrar',
  ticketType: 'SERVICE_REQUEST',
  templateId: null,
  defaults: { priorityId: 'p1' },
  customerId: 'cus1',
  configItemId: 'ci1',
  departmentId: 'dep1',
  assigneeId: 'u2',
  frequency: 'MONTHLY',
  interval: 1,
  byWeekday: [],
  byMonthday: 10,
  atTime: '08:00',
  timezone: 'America/Sao_Paulo',
  startsAt: new Date('2026-10-01T03:00:00.000Z'),
  endsAt: null,
  leadTimeMinutes: 0,
  skipIfOpen: true,
  active: true,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  actAs('admin')
  refs.mockResolvedValue(ok(true))
  rules.list.mockResolvedValue(ok([createFakeSdRecurringTicket()]))
  rules.findById.mockResolvedValue(ok(createFakeSdRecurringTicket()))
  rules.findMissingRefs.mockResolvedValue(ok([]))
  rules.create.mockResolvedValue(ok(createFakeSdRecurringTicket()))
  rules.update.mockResolvedValue(ok(createFakeSdRecurringTicket()))
  rules.softDelete.mockResolvedValue(ok(undefined))
  runs.listByRecurring.mockResolvedValue(ok([createFakeSdRecurringRun()]))
  engine.loadConfig.mockResolvedValue(ok(CONFIG))
  open.mockResolvedValue(ok(createFakeSdRecurringRun({ ticketId: 't1' })))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('list()', () => {
  it('lists the rules with the next occurrences for an agent', async () => {
    actAs('agent')
    const rows = expectOk(
      await SdRecurringTicketService.list('agent-1', WS, {
        includeInactive: true,
        configItemId: 'ci1',
      }),
    )
    expect(rules.list).toHaveBeenCalledWith(WS, {
      includeInactive: true,
      configItemId: 'ci1',
    })
    expect(rows[0].upcoming.length).toBeGreaterThan(0)
  })

  it('defaults the filters to the active rules', async () => {
    expectOk(await SdRecurringTicketService.list(ADMIN, WS))
    expect(rules.list).toHaveBeenCalledWith(WS, { includeInactive: false })
  })

  it.each([
    ['requester', 'requester' as const, 'SD_NOT_AGENT' as const],
    ['non-member', 'stranger' as const, 'FORBIDDEN' as const],
    ['module disabled', 'disabled' as const, 'MODULE_DISABLED' as const],
  ])('refuses %s', async (_label, actor, code) => {
    actAs(actor)
    expectErr(await SdRecurringTicketService.list('someone', WS), code)
    expect(rules.list).not.toHaveBeenCalled()
  })

  it('propagates a database error', async () => {
    rules.list.mockResolvedValue(err(databaseError('nope')))
    expectErr(await SdRecurringTicketService.list(ADMIN, WS), 'DATABASE_ERROR')
  })
})

describe('get()', () => {
  it('returns a rule to an agent', async () => {
    actAs('agent')
    const row = expectOk(
      await SdRecurringTicketService.get('agent-1', WS, 'rec1'),
    )
    expect(row.id).toBe('rec1')
  })

  it('turns a missing rule into SD_RECURRING_NOT_FOUND', async () => {
    rules.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.get(ADMIN, WS, 'nope'),
      'SD_RECURRING_NOT_FOUND',
    )
  })

  it('refuses a requester', async () => {
    actAs('requester')
    expectErr(
      await SdRecurringTicketService.get('req-1', WS, 'rec1'),
      'SD_NOT_AGENT',
    )
  })
})

describe('create()', () => {
  it('creates the rule with the first occurrence already scheduled', async () => {
    expectOk(await SdRecurringTicketService.create(ADMIN, WS, createDto))

    expect(rules.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        name: 'Vistoria mensal do nobreak',
        byMonthday: 10,
        createdById: ADMIN,
        // Dia 10 às 08:00 em São Paulo.
        nextRunAt: new Date('2026-10-10T11:00:00.000Z'),
      }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_recurring_ticket',
        action: 'create',
      }),
    )
  })

  it('does not schedule anything for a rule created paused', async () => {
    expectOk(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...createDto,
        active: false,
      }),
    )
    expect(rules.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ nextRunAt: null }),
    )
  })

  it('schedules the next occurrence for a rule whose start is in the past', async () => {
    expectOk(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...createDto,
        startsAt: new Date('2026-01-01T03:00:00.000Z'),
      }),
    )
    expect(rules.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        nextRunAt: new Date('2026-10-10T11:00:00.000Z'),
      }),
    )
  })

  it('accepts a rule without monthday or validity end', async () => {
    const { byMonthday, endsAt, ...rest } = createDto
    expectOk(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...rest,
        frequency: 'DAILY',
      }),
    )
    expect(rules.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({
        byMonthday: null,
        endsAt: null,
        nextRunAt: new Date('2026-10-02T11:00:00.000Z'),
      }),
    )
  })

  it('leaves the next run empty when the window is already over', async () => {
    expectOk(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...createDto,
        startsAt: new Date('2026-01-01T03:00:00.000Z'),
        endsAt: new Date('2026-02-01T03:00:00.000Z'),
      }),
    )
    expect(rules.create).toHaveBeenCalledWith(
      WS,
      expect.objectContaining({ nextRunAt: null }),
    )
  })

  it('refuses an impossible schedule with SD_RECURRING_SCHEDULE_INVALID', async () => {
    expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...createDto,
        timezone: 'Mars/Olympus',
      }),
      'SD_RECURRING_SCHEDULE_INVALID',
    )
    expect(rules.create).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        reason: 'SD_RECURRING_SCHEDULE_INVALID',
      }),
    )
  })

  it('refuses a schedule that ends before firing', async () => {
    expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, {
        ...createDto,
        endsAt: new Date('2026-10-05T03:00:00.000Z'),
      }),
      'SD_RECURRING_SCHEDULE_INVALID',
    )
  })

  it('refuses a config id of another workspace', async () => {
    refs.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(rules.create).not.toHaveBeenCalled()
  })

  it.each([
    ['customer', ['customer'] as const, 'Cliente não encontrado'],
    [
      'config item',
      ['configItem'] as const,
      'Item de configuração não encontrado',
    ],
  ])('refuses a %s of another workspace', async (_label, missing, message) => {
    rules.findMissingRefs.mockResolvedValue(ok([...missing]))
    const error = expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, createDto),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(error.message).toContain(message)
    expect(error.details).toEqual({ missing: [...missing] })
  })

  it('propagates a failure to check the references', async () => {
    rules.findMissingRefs.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )
  })

  it('propagates a database error from the insert', async () => {
    rules.create.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.create(ADMIN, WS, createDto),
      'DATABASE_ERROR',
    )
  })

  it.each([
    ['agent without the settings permission', 'agent' as const],
    ['viewer', 'viewer' as const],
    ['requester', 'requester' as const],
    ['non-member', 'stranger' as const],
  ])('refuses %s', async (_label, actor) => {
    actAs(actor)
    expectErr(
      await SdRecurringTicketService.create('someone', WS, createDto),
      'FORBIDDEN',
    )
    expect(rules.create).not.toHaveBeenCalled()
  })
})

describe('update()', () => {
  const patch: UpdateSdRecurringTicketDTO = { atTime: '07:00' }

  it('recalculates the next run from the merged schedule', async () => {
    rules.findById.mockResolvedValue(
      ok(
        createFakeSdRecurringTicket({
          frequency: 'MONTHLY',
          byWeekday: [],
          byMonthday: 10,
        }),
      ),
    )
    expectOk(await SdRecurringTicketService.update(ADMIN, WS, 'rec1', patch))
    expect(rules.update).toHaveBeenCalledWith(
      'rec1',
      WS,
      expect.objectContaining({
        atTime: '07:00',
        nextRunAt: new Date('2026-10-10T10:00:00.000Z'),
      }),
    )
  })

  it('clears the next run when the rule is paused', async () => {
    expectOk(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        active: false,
      }),
    )
    expect(rules.update).toHaveBeenCalledWith(
      'rec1',
      WS,
      expect.objectContaining({ active: false, nextRunAt: null }),
    )
  })

  it('schedules again when the rule is resumed', async () => {
    rules.findById.mockResolvedValue(
      ok(
        createFakeSdRecurringTicket({
          active: false,
          nextRunAt: null,
          frequency: 'MONTHLY',
          byWeekday: [],
          byMonthday: 10,
        }),
      ),
    )
    expectOk(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        active: true,
      }),
    )
    expect(rules.update).toHaveBeenCalledWith(
      'rec1',
      WS,
      expect.objectContaining({
        active: true,
        nextRunAt: new Date('2026-10-10T11:00:00.000Z'),
      }),
    )
  })

  it('keeps the untouched schedule fields', async () => {
    rules.findById.mockResolvedValue(
      ok(
        createFakeSdRecurringTicket({
          frequency: 'MONTHLY',
          byWeekday: [],
          byMonthday: 20,
          endsAt: new Date('2027-01-01T03:00:00.000Z'),
          leadTimeMinutes: 30,
        }),
      ),
    )
    expectOk(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        name: 'Outro nome',
      }),
    )
    expect(rules.update).toHaveBeenCalledWith(
      'rec1',
      WS,
      expect.objectContaining({
        name: 'Outro nome',
        nextRunAt: new Date('2026-10-20T10:30:00.000Z'),
      }),
    )
  })

  it('accepts clearing the monthday and the validity end', async () => {
    rules.findById.mockResolvedValue(
      ok(
        createFakeSdRecurringTicket({
          frequency: 'MONTHLY',
          byWeekday: [],
          byMonthday: 20,
          endsAt: new Date('2026-12-01T03:00:00.000Z'),
          startsAt: new Date('2026-10-03T03:00:00.000Z'),
        }),
      ),
    )
    expectOk(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        byMonthday: null,
        endsAt: null,
      }),
    )
    expect(rules.update).toHaveBeenCalledWith(
      'rec1',
      WS,
      expect.objectContaining({
        nextRunAt: new Date('2026-10-03T11:00:00.000Z'),
      }),
    )
  })

  it('turns a missing rule into SD_RECURRING_NOT_FOUND', async () => {
    rules.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.update(ADMIN, WS, 'nope', patch),
      'SD_RECURRING_NOT_FOUND',
    )
    expect(rules.update).not.toHaveBeenCalled()
  })

  it('refuses an invalid schedule', async () => {
    expectErr(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        interval: 0 as unknown as number,
      }),
      'SD_RECURRING_SCHEDULE_INVALID',
    )
  })

  it('refuses a reference of another workspace', async () => {
    refs.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', {
        departmentId: 'dep-other',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('propagates a database error from the update', async () => {
    rules.update.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.update(ADMIN, WS, 'rec1', patch),
      'DATABASE_ERROR',
    )
  })

  it('refuses an agent without the settings permission', async () => {
    actAs('agent')
    expectErr(
      await SdRecurringTicketService.update('agent-1', WS, 'rec1', patch),
      'FORBIDDEN',
    )
  })
})

describe('remove()', () => {
  it('soft-deletes the rule and audits it', async () => {
    expectOk(await SdRecurringTicketService.remove(ADMIN, WS, 'rec1'))
    expect(rules.softDelete).toHaveBeenCalledWith('rec1', WS)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'sd_recurring_ticket',
        action: 'delete',
        targetId: 'rec1',
      }),
    )
  })

  it('turns a missing rule into SD_RECURRING_NOT_FOUND', async () => {
    rules.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.remove(ADMIN, WS, 'nope'),
      'SD_RECURRING_NOT_FOUND',
    )
    expect(rules.softDelete).not.toHaveBeenCalled()
  })

  it('refuses a requester', async () => {
    actAs('requester')
    expectErr(
      await SdRecurringTicketService.remove('req-1', WS, 'rec1'),
      'FORBIDDEN',
    )
  })
})

describe('runs()', () => {
  it('lists the history for an agent', async () => {
    actAs('agent')
    const history = expectOk(
      await SdRecurringTicketService.runs('agent-1', WS, 'rec1', 10),
    )
    expect(runs.listByRecurring).toHaveBeenCalledWith('rec1', WS, 10)
    expect(history[0]).toMatchObject({ status: 'CREATED' })
  })

  it('defaults the limit to 50', async () => {
    expectOk(await SdRecurringTicketService.runs(ADMIN, WS, 'rec1'))
    expect(runs.listByRecurring).toHaveBeenCalledWith('rec1', WS, 50)
  })

  it('turns a missing rule into SD_RECURRING_NOT_FOUND', async () => {
    rules.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.runs(ADMIN, WS, 'nope'),
      'SD_RECURRING_NOT_FOUND',
    )
  })

  it('propagates a database error', async () => {
    runs.listByRecurring.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.runs(ADMIN, WS, 'rec1'),
      'DATABASE_ERROR',
    )
  })

  it('refuses a requester', async () => {
    actAs('requester')
    expectErr(
      await SdRecurringTicketService.runs('req-1', WS, 'rec1'),
      'SD_NOT_AGENT',
    )
  })
})

describe('runNow()', () => {
  it('opens the occurrence right away, ignoring skipIfOpen', async () => {
    const run = expectOk(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'),
    )
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledFor: NOW,
        honourSkipIfOpen: false,
        source: 'recurring-ticket.manual',
      }),
    )
    expect(run.ticketId).toBe('t1')
  })

  it('stamps lastRunAt without consuming the schedule', async () => {
    expectOk(await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'))
    expect(rules.update).toHaveBeenCalledWith('rec1', WS, { lastRunAt: NOW })
  })

  it('turns a missing rule into SD_RECURRING_NOT_FOUND', async () => {
    rules.findById.mockResolvedValue(err(sdConfigNotFound()))
    expectErr(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'nope'),
      'SD_RECURRING_NOT_FOUND',
    )
    expect(open).not.toHaveBeenCalled()
  })

  it('propagates a failure to load the module config', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'),
      'DATABASE_ERROR',
    )
  })

  it('propagates the error of a refused ticket', async () => {
    open.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'),
      'DATABASE_ERROR',
    )
  })

  it('reports a duplicated instant as a conflict', async () => {
    open.mockResolvedValue(ok(null))
    expectErr(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'),
      'SD_CONFIG_CONFLICT',
    )
  })

  it('propagates a failure to stamp lastRunAt', async () => {
    rules.update.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await SdRecurringTicketService.runNow(ADMIN, WS, 'rec1'),
      'DATABASE_ERROR',
    )
  })

  it('refuses an agent without the settings permission', async () => {
    actAs('agent')
    expectErr(
      await SdRecurringTicketService.runNow('agent-1', WS, 'rec1'),
      'FORBIDDEN',
    )
    expect(open).not.toHaveBeenCalled()
  })
})
