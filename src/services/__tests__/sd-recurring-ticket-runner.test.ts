import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeSdRecurringRun,
  createFakeSdRecurringTicket,
} from '@/src/__tests__/factories/sd-recurring-ticket.factory'
import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, sdPhaseRequirementsUnmet } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'

vi.mock('@/src/repositories/sd-recurring-ticket.repository')
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('../sd-automation-engine', () => ({
  fireSdAutomations: vi.fn(async () => undefined),
}))
vi.mock('../sd-ticket-event-recorder', () => ({
  recordSdTicketEvent: vi.fn(async () => ok(1)),
}))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn(), create: vi.fn() },
}))

import {
  SdRecurringTicketRepository,
  SdRecurringTicketRunRepository,
} from '@/src/repositories/sd-recurring-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { fireSdAutomations } from '../sd-automation-engine'
import {
  buildSdRecurringTicketInput,
  openSdRecurringOccurrence,
  SdRecurringTicketRunner,
} from '../sd-recurring-ticket-runner'
import { SdTicketEngine } from '../sd-ticket-engine'
import { recordSdTicketEvent } from '../sd-ticket-event-recorder'

/**
 * Tick dos chamados recorrentes. O tempo fica congelado em
 * 2026-10-05T12:00:00Z (= 09:00 em São Paulo), depois do horário da
 * ocorrência de 08:00 do mesmo dia.
 */

const rules = vi.mocked(SdRecurringTicketRepository)
const runs = vi.mocked(SdRecurringTicketRunRepository)
const context = vi.mocked(SdTicketContextRepository)
const engine = vi.mocked(SdTicketEngine)
const automations = vi.mocked(fireSdAutomations)
const events = vi.mocked(recordSdTicketEvent)

const CONFIG = {
  settings: createFakeSdSettings(),
  prefixes: DEFAULT_SD_TICKET_PREFIXES,
}

const NOW = new Date('2026-10-05T12:00:00.000Z')

/** Segunda 05/10/2026 às 08:00 em São Paulo. */
const DUE = new Date('2026-10-05T11:00:00.000Z')

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  context.listEnabledWorkspaceIds.mockResolvedValue(ok(['ws1']))
  engine.loadConfig.mockResolvedValue(ok(CONFIG))
  engine.create.mockResolvedValue(ok(createFakeSdTicket({ number: 7 })))
  rules.listDue.mockResolvedValue(ok([]))
  rules.update.mockImplementation(async (_id, _ws, data) =>
    ok(createFakeSdRecurringTicket(data as Record<string, never>)),
  )
  runs.claim.mockResolvedValue(ok(createFakeSdRecurringRun()))
  runs.finish.mockImplementation(async (id, data) =>
    ok(createFakeSdRecurringRun({ id, ...data })),
  )
  runs.findLatestWithTicket.mockResolvedValue(ok(null))
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('buildSdRecurringTicketInput', () => {
  it('uses the rule name when the defaults have no title', () => {
    const input = buildSdRecurringTicketInput(
      createFakeSdRecurringTicket({
        name: 'Vistoria do nobreak',
        description: 'Checar as baterias',
      }),
    )
    expect(input).toMatchObject({
      type: 'SERVICE_REQUEST',
      title: 'Vistoria do nobreak',
      description: 'Checar as baterias',
      channel: 'API',
    })
  })

  it('carries the defaults and lets the rule override the references', () => {
    const input = buildSdRecurringTicketInput(
      createFakeSdRecurringTicket({
        templateId: 'tpl1',
        customerId: 'cus1',
        configItemId: 'ci1',
        departmentId: 'dep-rule',
        assigneeId: 'u9',
        defaults: {
          title: '  Backup mensal  ',
          description: '<p>Rodar o backup</p>',
          categoryId: 'cat1',
          subcategoryId: 'sub1',
          serviceId: 'svc1',
          priorityId: 'p1',
          impactId: 'i1',
          urgencyId: 'u1',
          severityId: 's1',
          classificationId: 'cl1',
          departmentId: 'dep-default',
          changeType: 'STANDARD',
          changeRisk: 'LOW',
          implementationPlan: 'plano',
          rollbackPlan: 'volta',
          testPlan: 'testes',
          tags: ['preventiva'],
          customFields: { janela: 'madrugada' },
        },
      }),
    )
    expect(input).toMatchObject({
      title: 'Backup mensal',
      templateId: 'tpl1',
      categoryId: 'cat1',
      subcategoryId: 'sub1',
      serviceId: 'svc1',
      priorityId: 'p1',
      impactId: 'i1',
      urgencyId: 'u1',
      severityId: 's1',
      classificationId: 'cl1',
      changeType: 'STANDARD',
      changeRisk: 'LOW',
      implementationPlan: 'plano',
      rollbackPlan: 'volta',
      testPlan: 'testes',
      tags: ['preventiva'],
      customFields: { janela: 'madrugada' },
      customerId: 'cus1',
      configItemId: 'ci1',
      departmentId: 'dep-rule',
      assigneeId: 'u9',
    })
  })

  it('falls back to the department of the defaults', () => {
    const input = buildSdRecurringTicketInput(
      createFakeSdRecurringTicket({
        departmentId: null,
        description: null,
        defaults: { departmentId: 'dep-default' },
      }),
    )
    expect(input.departmentId).toBe('dep-default')
    expect(input.description).toBeUndefined()
  })
})

describe('openSdRecurringOccurrence', () => {
  it('claims the slot, opens the ticket, traces it and fires the automations', async () => {
    const ticket = createFakeSdTicket({ id: 't1', number: 7 })
    engine.create.mockResolvedValue(ok(ticket))
    const rule = createFakeSdRecurringTicket()

    const run = expectOk(
      await openSdRecurringOccurrence({
        rule,
        scheduledFor: DUE,
        config: CONFIG,
      }),
    )

    expect(runs.claim).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      recurringId: 'rec1',
      scheduledFor: DUE,
    })
    expect(engine.create).toHaveBeenCalledWith(
      'ws1',
      expect.objectContaining({ channel: 'API' }),
      { kind: 'system', source: 'recurring-ticket' },
      CONFIG,
    )
    expect(events).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: 't1',
        actorKind: 'SYSTEM',
        action: 'recurring.opened',
        meta: expect.objectContaining({
          recurringId: 'rec1',
          scheduledFor: DUE.toISOString(),
        }),
      }),
    )
    expect(automations).toHaveBeenCalledWith('TICKET_CREATED', 't1')
    expect(run).toMatchObject({ status: 'CREATED', ticketId: 't1' })
  })

  it('does nothing when the occurrence was already recorded', async () => {
    runs.claim.mockResolvedValue(ok(null))
    const run = expectOk(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
    )
    expect(run).toBeNull()
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('propagates a failure to claim the slot', async () => {
    runs.claim.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
      'DATABASE_ERROR',
    )
    expect(engine.create).not.toHaveBeenCalled()
  })

  it('skips when the previous occurrence is still open', async () => {
    runs.findLatestWithTicket.mockResolvedValue(
      ok({
        ...createFakeSdRecurringRun({ ticketId: 'prev' }),
        ticket: {
          id: 'prev',
          number: 5,
          type: 'SERVICE_REQUEST',
          deletedAt: null,
          phase: { category: 'IN_PROGRESS' },
        },
      }),
    )

    const run = expectOk(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
    )
    expect(engine.create).not.toHaveBeenCalled()
    expect(run).toMatchObject({
      status: 'SKIPPED',
      reason: 'O chamado REQ-000005 da ocorrência anterior ainda está aberto',
    })
  })

  it.each([
    ['resolved', { category: 'RESOLVED' as const, deletedAt: null }],
    ['closed', { category: 'CLOSED' as const, deletedAt: null }],
    ['canceled', { category: 'CANCELED' as const, deletedAt: null }],
    ['deleted', { category: 'NEW' as const, deletedAt: new Date() }],
  ])(
    'opens a new ticket when the previous one is %s',
    async (_label, state) => {
      runs.findLatestWithTicket.mockResolvedValue(
        ok({
          ...createFakeSdRecurringRun({ ticketId: 'prev' }),
          ticket: {
            id: 'prev',
            number: 5,
            type: 'SERVICE_REQUEST',
            deletedAt: state.deletedAt,
            phase: { category: state.category },
          },
        }),
      )
      const run = expectOk(
        await openSdRecurringOccurrence({
          rule: createFakeSdRecurringTicket(),
          scheduledFor: DUE,
          config: CONFIG,
        }),
      )
      expect(engine.create).toHaveBeenCalled()
      expect(run).toMatchObject({ status: 'CREATED' })
    },
  )

  it('ignores an unreadable history instead of skipping', async () => {
    runs.findLatestWithTicket.mockResolvedValue(err(databaseError('nope')))
    expectOk(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
    )
    expect(engine.create).toHaveBeenCalled()
  })

  it('ignores the previous ticket when skipIfOpen is off', async () => {
    runs.findLatestWithTicket.mockResolvedValue(
      ok({
        ...createFakeSdRecurringRun({ ticketId: 'prev' }),
        ticket: {
          id: 'prev',
          number: 5,
          type: 'SERVICE_REQUEST',
          deletedAt: null,
          phase: { category: 'IN_PROGRESS' },
        },
      }),
    )
    expectOk(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket({ skipIfOpen: false }),
        scheduledFor: DUE,
        config: CONFIG,
      }),
    )
    expect(runs.findLatestWithTicket).not.toHaveBeenCalled()
    expect(engine.create).toHaveBeenCalled()
  })

  it('records FAILED with the error code when the engine refuses', async () => {
    engine.create.mockResolvedValue(err(sdPhaseRequirementsUnmet()))
    expectErr(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
      'SD_PHASE_REQUIREMENTS_UNMET',
    )
    expect(runs.finish).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        status: 'FAILED',
        reason: expect.stringContaining('SD_PHASE_REQUIREMENTS_UNMET'),
      }),
    )
  })

  it('propagates a failure to record the FAILED occurrence', async () => {
    engine.create.mockResolvedValue(err(sdPhaseRequirementsUnmet()))
    runs.finish.mockResolvedValue(err(databaseError('nope')))
    expectErr(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
      }),
      'DATABASE_ERROR',
    )
  })

  it('takes the source of a manual run', async () => {
    expectOk(
      await openSdRecurringOccurrence({
        rule: createFakeSdRecurringTicket(),
        scheduledFor: DUE,
        config: CONFIG,
        source: 'recurring-ticket.manual',
      }),
    )
    expect(engine.create).toHaveBeenCalledWith(
      'ws1',
      expect.anything(),
      { kind: 'system', source: 'recurring-ticket.manual' },
      CONFIG,
    )
  })
})

describe('SdRecurringTicketRunner.runTick', () => {
  it('does nothing when no rule is due', async () => {
    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toEqual({
      workspaces: 0,
      rules: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: 0,
    })
    expect(context.listEnabledWorkspaceIds).not.toHaveBeenCalled()
  })

  it('opens the due occurrence and moves the schedule forward', async () => {
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )

    const result = await SdRecurringTicketRunner.runTick()

    expect(result).toMatchObject({
      workspaces: 1,
      rules: 1,
      created: 1,
      skipped: 0,
      failed: 0,
      errors: 0,
    })
    expect(runs.claim).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: DUE }),
    )
    // Semanal na segunda: a próxima é 12/10 às 08:00 (11:00Z).
    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      lastRunAt: NOW,
      nextRunAt: new Date('2026-10-12T11:00:00.000Z'),
    })
  })

  it('discounts the lead time to recover the occurrence instant', async () => {
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({
          leadTimeMinutes: 120,
          nextRunAt: new Date('2026-10-05T09:00:00.000Z'),
        }),
      ]),
    )

    await SdRecurringTicketRunner.runTick()

    expect(runs.claim).toHaveBeenCalledWith(
      expect.objectContaining({ scheduledFor: DUE }),
    )
    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      lastRunAt: NOW,
      // 12/10 08:00 menos 2 h de antecedência.
      nextRunAt: new Date('2026-10-12T09:00:00.000Z'),
    })
  })

  it('skips the accumulated backlog instead of opening one ticket per missed occurrence', async () => {
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({
          frequency: 'DAILY',
          byWeekday: [],
          // Vencida há dez dias.
          nextRunAt: new Date('2026-09-25T11:00:00.000Z'),
        }),
      ]),
    )

    await SdRecurringTicketRunner.runTick()

    expect(runs.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduledFor: new Date('2026-09-25T11:00:00.000Z'),
      }),
    )
    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      lastRunAt: NOW,
      nextRunAt: new Date('2026-10-06T11:00:00.000Z'),
    })
  })

  it('clears the next run when the validity window is over', async () => {
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({
          nextRunAt: DUE,
          endsAt: new Date('2026-10-06T03:00:00.000Z'),
        }),
      ]),
    )

    await SdRecurringTicketRunner.runTick()

    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      lastRunAt: NOW,
      nextRunAt: null,
    })
  })

  it('counts a skipped occurrence', async () => {
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )
    runs.finish.mockResolvedValue(
      ok(createFakeSdRecurringRun({ status: 'SKIPPED', reason: 'aberta' })),
    )

    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ created: 0, skipped: 1, failed: 0 })
  })

  it('counts a failed occurrence and keeps going with the other rules', async () => {
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({ id: 'rec1', nextRunAt: DUE }),
        createFakeSdRecurringTicket({ id: 'rec2', nextRunAt: DUE }),
      ]),
    )
    engine.create
      .mockResolvedValueOnce(err(sdPhaseRequirementsUnmet()))
      .mockResolvedValueOnce(ok(createFakeSdTicket({ id: 't2' })))

    const result = await SdRecurringTicketRunner.runTick()

    expect(result).toMatchObject({ rules: 2, created: 1, failed: 1 })
    expect(rules.update).toHaveBeenCalledWith(
      'rec2',
      'ws1',
      expect.objectContaining({ lastRunAt: NOW }),
    )
  })

  it('stops a rule whose schedule became invalid', async () => {
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({
          nextRunAt: DUE,
          timezone: 'Mars/Olympus',
        }),
      ]),
    )

    const result = await SdRecurringTicketRunner.runTick()

    expect(result).toMatchObject({ errors: 1, created: 0 })
    expect(runs.claim).not.toHaveBeenCalled()
    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      nextRunAt: null,
    })
  })

  it('leaves the rules of a workspace without the module alone', async () => {
    context.listEnabledWorkspaceIds.mockResolvedValue(ok(['other']))
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )

    const result = await SdRecurringTicketRunner.runTick()

    expect(result).toMatchObject({ rules: 0, created: 0 })
    expect(runs.claim).not.toHaveBeenCalled()
    expect(rules.update).not.toHaveBeenCalled()
  })

  it('reuses the engine config of each workspace', async () => {
    context.listEnabledWorkspaceIds.mockResolvedValue(ok(['ws1', 'ws2']))
    rules.listDue.mockResolvedValue(
      ok([
        createFakeSdRecurringTicket({ id: 'rec1', nextRunAt: DUE }),
        createFakeSdRecurringTicket({ id: 'rec2', nextRunAt: DUE }),
        createFakeSdRecurringTicket({
          id: 'rec3',
          workspaceId: 'ws2',
          nextRunAt: DUE,
        }),
      ]),
    )

    const result = await SdRecurringTicketRunner.runTick()

    expect(engine.loadConfig).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ workspaces: 2, rules: 3, created: 3 })
  })

  it('counts an error when the engine config cannot be loaded', async () => {
    engine.loadConfig.mockResolvedValue(err(databaseError('nope')))
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )

    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ rules: 1, errors: 1, created: 0 })
    expect(runs.claim).not.toHaveBeenCalled()
  })

  it('counts an error when the due rules cannot be read', async () => {
    rules.listDue.mockResolvedValue(err(databaseError('nope')))
    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ errors: 1, rules: 0 })
  })

  it('counts an error when the enabled workspaces cannot be read', async () => {
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )
    context.listEnabledWorkspaceIds.mockResolvedValue(err(databaseError('x')))
    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ errors: 1, rules: 0 })
  })

  it('reprocessing the same tick does not open a second ticket', async () => {
    runs.claim.mockResolvedValue(ok(null))
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )

    const result = await SdRecurringTicketRunner.runTick()

    expect(engine.create).not.toHaveBeenCalled()
    expect(result).toMatchObject({ rules: 1, created: 0, skipped: 0 })
    expect(rules.update).toHaveBeenCalledWith('rec1', 'ws1', {
      lastRunAt: NOW,
      nextRunAt: new Date('2026-10-12T11:00:00.000Z'),
    })
  })

  it.each([
    ['an Error', new Error('boom')],
    ['something that is not an Error', 'boom'],
  ])('survives %s thrown while running a rule', async (_label, thrown) => {
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )
    runs.claim.mockRejectedValue(thrown)

    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ rules: 1, errors: 1 })
  })

  it('logs but tolerates a failure to save the next run', async () => {
    rules.listDue.mockResolvedValue(
      ok([createFakeSdRecurringTicket({ nextRunAt: DUE })]),
    )
    rules.update.mockResolvedValue(err(databaseError('nope')))

    const result = await SdRecurringTicketRunner.runTick()
    expect(result).toMatchObject({ created: 1, errors: 0 })
  })
})
