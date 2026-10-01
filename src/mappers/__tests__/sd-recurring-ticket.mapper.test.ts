import { describe, expect, it } from 'vitest'
import {
  createFakeSdRecurringRun,
  createFakeSdRecurringTicket,
} from '@/src/__tests__/factories/sd-recurring-ticket.factory'
import {
  toSdRecurrenceSchedule,
  toSdRecurringTicketDTO,
  toSdRecurringTicketRunDTO,
} from '@/src/mappers/sd-recurring-ticket.mapper'

const NOW = new Date('2026-10-01T12:00:00.000Z')

describe('toSdRecurrenceSchedule', () => {
  it('takes the schedule fields out of the row', () => {
    const row = createFakeSdRecurringTicket({
      frequency: 'MONTHLY',
      interval: 2,
      byWeekday: [],
      byMonthday: 15,
      atTime: '07:00',
      timezone: 'America/Manaus',
      leadTimeMinutes: 60,
    })
    expect(toSdRecurrenceSchedule(row)).toEqual({
      frequency: 'MONTHLY',
      interval: 2,
      byWeekday: [],
      byMonthday: 15,
      atTime: '07:00',
      timezone: 'America/Manaus',
      startsAt: row.startsAt,
      endsAt: null,
      leadTimeMinutes: 60,
    })
  })
})

describe('toSdRecurringTicketDTO', () => {
  it('serializes the rule and previews the next five occurrences', () => {
    const dto = toSdRecurringTicketDTO(
      createFakeSdRecurringTicket({
        description: 'Conferir',
        templateId: 'tpl1',
        template: { id: 'tpl1', name: 'Backup' },
        customerId: 'cus1',
        customer: { id: 'cus1', name: 'ACME' },
        configItemId: 'ci1',
        configItem: { id: 'ci1', name: 'Servidor', code: 'SRV-01' },
        departmentId: 'dep1',
        assigneeId: 'u2',
        defaults: { title: 'Backup semanal', priorityId: 'p1' },
        lastRunAt: new Date('2026-09-28T11:00:00.000Z'),
        _count: { runs: 3 },
      }),
      NOW,
    )

    expect(dto).toMatchObject({
      id: 'rec1',
      name: 'Backup semanal do ERP',
      active: true,
      ticketType: 'SERVICE_REQUEST',
      template: { id: 'tpl1', name: 'Backup' },
      customer: { id: 'cus1', name: 'ACME' },
      configItem: { id: 'ci1', name: 'Servidor', code: 'SRV-01' },
      departmentId: 'dep1',
      assigneeId: 'u2',
      defaults: { title: 'Backup semanal', priorityId: 'p1' },
      frequency: 'WEEKLY',
      byWeekday: [1],
      atTime: '08:00',
      timezone: 'America/Sao_Paulo',
      leadTimeMinutes: 0,
      skipIfOpen: true,
      lastRunAt: '2026-09-28T11:00:00.000Z',
      nextRunAt: '2026-10-05T11:00:00.000Z',
      runCount: 3,
    })
    // Segundas-feiras, 08:00 em São Paulo (11:00Z).
    expect(dto.upcoming).toEqual([
      '2026-10-05T11:00:00.000Z',
      '2026-10-12T11:00:00.000Z',
      '2026-10-19T11:00:00.000Z',
      '2026-10-26T11:00:00.000Z',
      '2026-11-02T11:00:00.000Z',
    ])
  })

  it('discards defaults that do not match the template shape', () => {
    const dto = toSdRecurringTicketDTO(
      createFakeSdRecurringTicket({ defaults: { nope: 1 } }),
      NOW,
    )
    expect(dto.defaults).toEqual({})
  })

  it('previews nothing for a paused rule', () => {
    const dto = toSdRecurringTicketDTO(
      createFakeSdRecurringTicket({ active: false, nextRunAt: null }),
      NOW,
    )
    expect(dto.upcoming).toEqual([])
    expect(dto.nextRunAt).toBeNull()
  })

  it('previews nothing once the validity window is over', () => {
    const dto = toSdRecurringTicketDTO(
      createFakeSdRecurringTicket({
        endsAt: new Date('2026-09-30T03:00:00.000Z'),
      }),
      NOW,
    )
    expect(dto.upcoming).toEqual([])
    expect(dto.endsAt).toBe('2026-09-30T03:00:00.000Z')
  })

  it('defaults the preview clock to now', () => {
    const dto = toSdRecurringTicketDTO(createFakeSdRecurringTicket())
    expect(dto.upcoming.length).toBeGreaterThan(0)
  })

  it('keeps the empty relations as null', () => {
    const dto = toSdRecurringTicketDTO(createFakeSdRecurringTicket(), NOW)
    expect(dto).toMatchObject({
      template: null,
      customer: null,
      configItem: null,
      description: 'Conferir o backup e registrar o resultado',
      lastRunAt: null,
      endsAt: null,
    })
  })
})

describe('toSdRecurringTicketRunDTO', () => {
  it('serializes an occurrence that opened a ticket', () => {
    const dto = toSdRecurringTicketRunDTO(
      createFakeSdRecurringRun({
        ticketId: 't1',
        ticket: {
          id: 't1',
          number: 42,
          type: 'SERVICE_REQUEST',
          title: 'Backup semanal',
        },
      }),
    )
    expect(dto).toMatchObject({
      recurringId: 'rec1',
      scheduledFor: '2026-10-05T11:00:00.000Z',
      status: 'CREATED',
      ticketId: 't1',
      ticket: { number: 42, title: 'Backup semanal' },
      reason: null,
      createdAt: '2026-10-01T12:00:00.000Z',
    })
  })

  it('serializes a skipped occurrence without a ticket', () => {
    const dto = toSdRecurringTicketRunDTO(
      createFakeSdRecurringRun({
        status: 'SKIPPED',
        reason: 'A ocorrência anterior ainda está aberta',
      }),
    )
    expect(dto).toMatchObject({
      status: 'SKIPPED',
      ticket: null,
      ticketId: null,
      reason: 'A ocorrência anterior ainda está aberta',
    })
  })
})
