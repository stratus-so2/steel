import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdContract,
  createFakeSdContractPeriod,
  createFakeSdContractRate,
  createFakeSdTimeEntry,
} from '@/src/__tests__/factories/sd-contract.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { sdTabScope } from '@/src/__tests__/helpers/sd-ticket-tab.helpers'
import { databaseError, sdNotAgent, sdTicketClosed } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import {
  CreateSdTimeEntrySchema,
  SdTimerActionSchema,
  UpdateSdTimeEntrySchema,
} from '@/src/schemas/sd-time-entry.schema'
import type { SdTicketTabScope } from '../sd-ticket-tab-support'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/sd-contract.repository')
vi.mock('@/src/repositories/sd-contract-period.repository')
vi.mock('@/src/repositories/sd-time-entry.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('../sd-contract-billing.service', () => ({
  SdContractBillingService: { ensureOpenPeriod: vi.fn() },
}))
vi.mock('../sd-ticket-tab-support', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-tab-support')>()),
  loadSdTicketTab: vi.fn(),
  publishSdTicketTab: vi.fn(),
}))
vi.mock('../sd-ticket-event-recorder', () => ({ recordSdTicketEvent: vi.fn() }))

import { auditMutation } from '@/lib/axiom/audit'
import { SdContractRepository } from '@/src/repositories/sd-contract.repository'
import { SdContractPeriodRepository } from '@/src/repositories/sd-contract-period.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTimeEntryRepository } from '@/src/repositories/sd-time-entry.repository'
import { SdContractBillingService } from '../sd-contract-billing.service'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'
import { loadSdTicketTab, publishSdTicketTab } from '../sd-ticket-tab-support'
import { SdTimeEntryService } from '../sd-time-entry.service'

const load = vi.mocked(loadSdTicketTab)
const repo = vi.mocked(SdTimeEntryRepository)
const contracts = vi.mocked(SdContractRepository)
const periods = vi.mocked(SdContractPeriodRepository)
const billing = vi.mocked(SdContractBillingService)
const ticketCtx = vi.mocked(SdTicketContextRepository)
const record = vi.mocked(recordSdTicketEvent)
const publish = vi.mocked(publishSdTicketTab)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const AGENT = 'u1'

const WEEK_8x5 = {
  mon: [['08:00', '18:00']],
  tue: [['08:00', '18:00']],
  wed: [['08:00', '18:00']],
  thu: [['08:00', '18:00']],
  fri: [['08:00', '18:00']],
  sat: [],
  sun: [],
}

/** Quarta 2026-10-07, 10:00–11:00 em São Paulo (dentro do expediente). */
const START = new Date('2026-10-07T13:00:00.000Z')
const END = new Date('2026-10-07T14:00:00.000Z')

function scopeWith(overrides: Partial<SdTicketTabScope> = {}) {
  const base = sdTabScope({ ticket: { contractId: 'ct1', priorityId: 'p1' } })
  return { ...base, ...overrides }
}

/** O repositório recebe `amount` como string; a linha volta como Decimal. */
function decimal(amount: string | null | undefined) {
  return amount == null ? null : new Prisma.Decimal(amount)
}

function adminScope() {
  const base = scopeWith()
  return { ...base, ctx: { ...base.ctx, isAdmin: true } }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(END)
  load.mockResolvedValue(ok(scopeWith()))
  repo.findRunning.mockResolvedValue(ok(null))
  repo.listByTicket.mockResolvedValue(ok([]))
  repo.existsOnTicketDay.mockResolvedValue(ok(false))
  repo.findById.mockResolvedValue(
    ok(createFakeSdTimeEntry({ userId: AGENT, periodId: null })),
  )
  repo.create.mockImplementation(async ({ amount, ...data }) =>
    ok(createFakeSdTimeEntry({ id: 'te1', ...data, amount: decimal(amount) })),
  )
  repo.update.mockImplementation(async (id, { amount, ...data }) =>
    ok(createFakeSdTimeEntry({ id, ...data, amount: decimal(amount) })),
  )
  repo.softDelete.mockResolvedValue(ok(undefined))
  contracts.findByIdUnscoped.mockResolvedValue(ok(createFakeSdContract()))
  contracts.findBillingCalendar.mockResolvedValue(
    ok({
      timezone: 'America/Sao_Paulo',
      schedule: WEEK_8x5,
      holidays: [],
      is24x7: false,
    }),
  )
  periods.findClosedIds.mockResolvedValue(ok(new Set()))
  periods.findById.mockResolvedValue(ok(createFakeSdContractPeriod()))
  billing.ensureOpenPeriod.mockResolvedValue(ok(createFakeSdContractPeriod()))
  ticketCtx.findNonMembers.mockResolvedValue(ok([]))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('list', () => {
  it('devolve itens, resumo, cronômetro e o contrato do chamado', async () => {
    repo.listByTicket.mockResolvedValue(
      ok([
        createFakeSdTimeEntry({ userId: AGENT, minutes: 60 }),
        createFakeSdTimeEntry({
          userId: 'u2',
          minutes: 30,
          billable: false,
          amount: new Prisma.Decimal('0'),
        }),
      ]),
    )
    repo.findRunning.mockResolvedValue(
      ok(createFakeSdTimeEntry({ endedAt: null, minutes: 0, amount: null })),
    )
    contracts.findByIdUnscoped.mockResolvedValue(
      ok(createFakeSdContract({ periods: [createFakeSdContractPeriod()] })),
    )

    const out = expectOk(await SdTimeEntryService.list(AGENT, WS, 't1'))
    expect(out.summary.totalMinutes).toBe(90)
    expect(out.summary.billableMinutes).toBe(60)
    expect(out.running?.endedAt).toBeNull()
    expect(out.contract?.id).toBe('ct1')
    expect(out.contract?.period?.id).toBe('per1')
    // O apontamento de outro agente não é editável por um agente comum.
    expect(out.items.map((item) => item.editable)).toEqual([true, false])
  })

  it('marca como não editável o apontamento de período fechado', async () => {
    repo.listByTicket.mockResolvedValue(
      ok([createFakeSdTimeEntry({ userId: AGENT, periodId: 'per1' })]),
    )
    periods.findClosedIds.mockResolvedValue(ok(new Set(['per1'])))
    const out = expectOk(await SdTimeEntryService.list(AGENT, WS, 't1'))
    expect(periods.findClosedIds).toHaveBeenCalledWith(['per1'])
    expect(out.items[0].editable).toBe(false)
  })

  it('chamado sem contrato não traz bloco de contrato', async () => {
    load.mockResolvedValue(ok(sdTabScope()))
    const out = expectOk(await SdTimeEntryService.list(AGENT, WS, 't1'))
    expect(out.contract).toBeNull()
    expect(contracts.findByIdUnscoped).not.toHaveBeenCalled()
  })

  it('ignora contrato de outro workspace', async () => {
    contracts.findByIdUnscoped.mockResolvedValue(
      ok(createFakeSdContract({ workspaceId: 'outro' })),
    )
    expect(
      expectOk(await SdTimeEntryService.list(AGENT, WS, 't1')).contract,
    ).toBeNull()
  })

  it('recusa solicitante e propaga erros de banco', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(await SdTimeEntryService.list(AGENT, WS, 't1'), 'SD_NOT_AGENT')

    load.mockResolvedValue(ok(scopeWith()))
    repo.listByTicket.mockResolvedValue(err(databaseError()))
    expectErr(await SdTimeEntryService.list(AGENT, WS, 't1'), 'DATABASE_ERROR')

    repo.listByTicket.mockResolvedValue(ok([]))
    repo.findRunning.mockResolvedValue(err(databaseError()))
    expectErr(await SdTimeEntryService.list(AGENT, WS, 't1'), 'DATABASE_ERROR')

    repo.findRunning.mockResolvedValue(ok(null))
    periods.findClosedIds.mockResolvedValue(err(databaseError()))
    expectErr(await SdTimeEntryService.list(AGENT, WS, 't1'), 'DATABASE_ERROR')

    periods.findClosedIds.mockResolvedValue(ok(new Set()))
    contracts.findByIdUnscoped.mockResolvedValue(err(databaseError()))
    expectErr(await SdTimeEntryService.list(AGENT, WS, 't1'), 'DATABASE_ERROR')
  })
})

describe('timer — abrir', () => {
  it('inicia o cronômetro com o contrato do chamado', async () => {
    const dto = expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'start', description: 'Análise' }),
      ),
    )
    expect(dto.endedAt).toBeNull()
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      source: 'TIMER',
      minutes: 0,
      endedAt: null,
      contractId: 'ct1',
      description: 'Análise',
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'time.started' }),
    )
    expect(publish).toHaveBeenCalledWith(
      expect.anything(),
      'ticket.time',
      AGENT,
      true,
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_time_entry', action: 'create' }),
    )
  })

  it('`resume` também abre um trecho novo', async () => {
    expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'resume' }),
      ),
    )
    expect(repo.create).toHaveBeenCalled()
  })

  it('recusa um segundo cronômetro do mesmo usuário', async () => {
    repo.findRunning.mockResolvedValue(
      ok(createFakeSdTimeEntry({ endedAt: null })),
    )
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'start' }),
      ),
      'SD_TIME_ENTRY_RUNNING',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('recusa abrir em chamado fechado', async () => {
    load.mockResolvedValue(err(sdTicketClosed()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'start' }),
      ),
      'SD_TICKET_CLOSED',
    )
    expect(load.mock.calls[0][3]).toBe('CREATE')
    expect(load.mock.calls[0][4]).toEqual({
      agentOnly: true,
      requireOpen: true,
    })
  })

  it('propaga erro de banco da busca e da criação', async () => {
    repo.findRunning.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'start' }),
      ),
      'DATABASE_ERROR',
    )

    repo.findRunning.mockResolvedValue(ok(null))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'start' }),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('timer — fechar', () => {
  beforeEach(() => {
    repo.findRunning.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'run1',
          ticketId: 't1',
          userId: AGENT,
          startedAt: START,
          endedAt: null,
          minutes: 0,
          amount: null,
        }),
      ),
    )
  })

  it('arredonda, aplica o mínimo do dia e calcula o valor', async () => {
    vi.setSystemTime(new Date('2026-10-07T13:05:00.000Z'))
    const dto = expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
    )
    // 5 min → 15 (arredondamento) → 30 (mínimo do primeiro do dia).
    expect(dto.minutes).toBe(30)
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      minutes: 30,
      window: 'BUSINESS_HOURS',
      amount: '75.00',
      contractId: 'ct1',
      periodId: 'per1',
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'time.logged' }),
    )
  })

  it('não aplica o mínimo quando já houve apontamento no dia', async () => {
    vi.setSystemTime(new Date('2026-10-07T13:05:00.000Z'))
    repo.existsOnTicketDay.mockResolvedValue(ok(true))
    const dto = expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'pause' }),
      ),
    )
    expect(dto.minutes).toBe(15)
    expect(repo.existsOnTicketDay.mock.calls[0][0]).toMatchObject({
      ticketId: 't1',
      userId: AGENT,
      excludeId: 'run1',
    })
  })

  it('usa a regra de valor da janela de plantão', async () => {
    // Domingo 10:00 local → WEEKEND.
    repo.findRunning.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'run1',
          ticketId: 't1',
          userId: AGENT,
          startedAt: new Date('2026-10-11T13:00:00.000Z'),
          endedAt: null,
        }),
      ),
    )
    vi.setSystemTime(new Date('2026-10-11T14:00:00.000Z'))
    contracts.findByIdUnscoped.mockResolvedValue(
      ok(
        createFakeSdContract({
          rates: [
            createFakeSdContractRate({
              window: 'WEEKEND',
              hourlyRate: new Prisma.Decimal('200.00'),
              multiplier: new Prisma.Decimal('2.00'),
            }),
          ],
        }),
      ),
    )
    expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
    )
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      window: 'WEEKEND',
      amount: '400.00',
    })
  })

  it('chamado sem contrato registra o tempo cru, sem valor', async () => {
    load.mockResolvedValue(ok(sdTabScope()))
    vi.setSystemTime(new Date('2026-10-07T13:07:00.000Z'))
    repo.findRunning.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'run1',
          ticketId: 't1',
          userId: AGENT,
          startedAt: START,
          endedAt: null,
          contractId: null,
        }),
      ),
    )
    expectOk(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
    )
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      minutes: 7,
      amount: null,
      contractId: null,
      periodId: null,
    })
    expect(billing.ensureOpenPeriod).not.toHaveBeenCalled()
    expect(repo.existsOnTicketDay).not.toHaveBeenCalled()
  })

  it('recusa quando não há cronômetro ou ele é de outro chamado', async () => {
    repo.findRunning.mockResolvedValue(ok(null))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'SD_TIME_ENTRY_INVALID',
    )

    repo.findRunning.mockResolvedValue(
      ok(createFakeSdTimeEntry({ ticketId: 'outro', endedAt: null })),
    )
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'SD_TIME_ENTRY_INVALID',
    )
  })

  it('recusa quando o período do contrato está fechado', async () => {
    billing.ensureOpenPeriod.mockResolvedValue(
      err({ code: 'SD_CONTRACT_PERIOD_CLOSED', message: 'fechado' }),
    )
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'SD_CONTRACT_PERIOD_CLOSED',
    )
  })

  it('recusa trecho sem duração', async () => {
    vi.setSystemTime(START)
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'SD_TIME_ENTRY_INVALID',
    )
  })

  it('propaga erro de banco do calendário, do dia e da gravação', async () => {
    contracts.findBillingCalendar.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'DATABASE_ERROR',
    )

    contracts.findBillingCalendar.mockResolvedValue(ok(null))
    repo.existsOnTicketDay.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'DATABASE_ERROR',
    )

    repo.existsOnTicketDay.mockResolvedValue(ok(false))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.timer(
        AGENT,
        WS,
        't1',
        SdTimerActionSchema.parse({ action: 'stop' }),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('create (manual)', () => {
  const dto = CreateSdTimeEntrySchema.parse({
    startedAt: START.toISOString(),
    endedAt: END.toISOString(),
    billable: true,
    description: 'Atendimento no cliente',
  })

  it('lança a hora, precificando pelo contrato', async () => {
    const out = expectOk(await SdTimeEntryService.create(AGENT, WS, 't1', dto))
    expect(out.minutes).toBe(60)
    expect(repo.create.mock.calls[0][0]).toMatchObject({
      source: 'MANUAL',
      userId: AGENT,
      minutes: 60,
      amount: '150.00',
      window: 'BUSINESS_HOURS',
      contractId: 'ct1',
      periodId: 'per1',
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_time_entry', action: 'create' }),
    )
  })

  it('admin pode apontar por outro agente do workspace', async () => {
    load.mockResolvedValue(ok(adminScope()))
    expectOk(
      await SdTimeEntryService.create(AGENT, WS, 't1', {
        ...dto,
        userId: 'u2',
      }),
    )
    expect(repo.create.mock.calls[0][0].userId).toBe('u2')
  })

  it('agente comum não aponta por outro', async () => {
    expectErr(
      await SdTimeEntryService.create(AGENT, WS, 't1', {
        ...dto,
        userId: 'u2',
      }),
      'FORBIDDEN',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('apontar o próprio id não exige admin', async () => {
    expectOk(
      await SdTimeEntryService.create(AGENT, WS, 't1', {
        ...dto,
        userId: AGENT,
      }),
    )
    expect(ticketCtx.findNonMembers).not.toHaveBeenCalled()
  })

  it('recusa agente de fora do workspace e propaga erro de banco', async () => {
    load.mockResolvedValue(ok(adminScope()))
    ticketCtx.findNonMembers.mockResolvedValue(ok(['u2']))
    expectErr(
      await SdTimeEntryService.create(AGENT, WS, 't1', {
        ...dto,
        userId: 'u2',
      }),
      'VALIDATION_ERROR',
    )

    ticketCtx.findNonMembers.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.create(AGENT, WS, 't1', {
        ...dto,
        userId: 'u2',
      }),
      'DATABASE_ERROR',
    )
  })

  it('recusa chamado fechado e propaga erro da criação', async () => {
    load.mockResolvedValue(err(sdTicketClosed()))
    expectErr(
      await SdTimeEntryService.create(AGENT, WS, 't1', dto),
      'SD_TICKET_CLOSED',
    )

    load.mockResolvedValue(ok(scopeWith()))
    repo.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.create(AGENT, WS, 't1', dto),
      'DATABASE_ERROR',
    )
  })
})

describe('update', () => {
  it('recalcula minutos, janela e valor ao mudar os horários', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'te1',
          userId: AGENT,
          periodId: null,
          startedAt: START,
          endedAt: END,
        }),
      ),
    )
    const out = expectOk(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({
          endedAt: '2026-10-07T14:30:00.000Z',
          billable: false,
          description: 'Ajuste',
        }),
      ),
    )
    expect(out.minutes).toBe(90)
    expect(repo.update.mock.calls[0][1]).toMatchObject({
      minutes: 90,
      amount: '225.00',
      billable: false,
      description: 'Ajuste',
    })
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'time.updated' }),
    )
  })

  it('cronômetro em andamento só aceita descrição e faturável', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'te1',
          userId: AGENT,
          periodId: null,
          endedAt: null,
        }),
      ),
    )
    expectOk(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ description: 'Em curso' }),
      ),
    )
    expect(repo.update.mock.calls[0][1]).toEqual({ description: 'Em curso' })

    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ startedAt: START.toISOString() }),
      ),
      'SD_TIME_ENTRY_INVALID',
    )
  })

  it('recusa fim anterior ao início depois do merge', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'te1',
          userId: AGENT,
          periodId: null,
          startedAt: END,
          endedAt: new Date('2026-10-07T15:00:00.000Z'),
        }),
      ),
    )
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ endedAt: START.toISOString() }),
      ),
      'SD_TIME_ENTRY_INVALID',
    )
  })

  it('agente não mexe no apontamento de outro; admin mexe', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ id: 'te1', userId: 'u2', periodId: null })),
    )
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'FORBIDDEN',
    )

    load.mockResolvedValue(ok(adminScope()))
    expectOk(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
    )
  })

  it('período fechado congela o apontamento', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ id: 'te1', userId: AGENT, periodId: 'per1' })),
    )
    periods.findById.mockResolvedValue(
      ok(createFakeSdContractPeriod({ status: 'CLOSED' })),
    )
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'SD_CONTRACT_PERIOD_CLOSED',
    )
  })

  it('propaga erros de banco', async () => {
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'DATABASE_ERROR',
    )

    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ id: 'te1', userId: AGENT, periodId: 'per1' })),
    )
    periods.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'DATABASE_ERROR',
    )

    periods.findById.mockResolvedValue(ok(createFakeSdContractPeriod()))
    repo.update.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'DATABASE_ERROR',
    )

    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          id: 'te1',
          userId: AGENT,
          periodId: null,
          endedAt: null,
        }),
      ),
    )
    expectErr(
      await SdTimeEntryService.update(
        AGENT,
        WS,
        't1',
        'te1',
        UpdateSdTimeEntrySchema.parse({ billable: false }),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('remove', () => {
  it('exclui logicamente o próprio apontamento, registra e audita', async () => {
    expectOk(await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'))
    expect(repo.softDelete).toHaveBeenCalledWith('te1')
    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'time.removed' }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'sd_time_entry', action: 'delete' }),
    )
  })

  it('recusa apontamento de outro agente e período fechado', async () => {
    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ userId: 'u2', periodId: null })),
    )
    expectErr(
      await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'),
      'FORBIDDEN',
    )

    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ userId: AGENT, periodId: 'per1' })),
    )
    periods.findById.mockResolvedValue(
      ok(createFakeSdContractPeriod({ status: 'CLOSED' })),
    )
    expectErr(
      await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'),
      'SD_CONTRACT_PERIOD_CLOSED',
    )
  })

  it('apontamento sem contrato não consulta período', async () => {
    repo.findById.mockResolvedValue(
      ok(
        createFakeSdTimeEntry({
          userId: AGENT,
          periodId: 'per1',
          contractId: null,
        }),
      ),
    )
    expectOk(await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'))
    expect(periods.findById).not.toHaveBeenCalled()
  })

  it('recusa solicitante e propaga erros de banco', async () => {
    load.mockResolvedValue(err(sdNotAgent()))
    expectErr(
      await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'),
      'SD_NOT_AGENT',
    )

    load.mockResolvedValue(ok(scopeWith()))
    repo.findById.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'),
      'DATABASE_ERROR',
    )

    repo.findById.mockResolvedValue(
      ok(createFakeSdTimeEntry({ userId: AGENT, periodId: null })),
    )
    repo.softDelete.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdTimeEntryService.remove(AGENT, WS, 't1', 'te1'),
      'DATABASE_ERROR',
    )
  })
})
