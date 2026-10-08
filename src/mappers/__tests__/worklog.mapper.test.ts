import { describe, expect, it } from 'vitest'
import { createFakeWorkspaceExport } from '@/src/__tests__/factories/workspace-export.factory'
import type { IndicatorSet } from '@/src/lib/productivity/indicators'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { WorklogEntryRow } from '@/src/repositories/worklog.repository'
import type { ProductivityDTO } from '@/types/worklog'
import {
  formatLocalDateTime,
  productivityCsvColumns,
  productivityCsvHeader,
  productivityCsvRows,
  toWorklogEntryDTO,
  toWorklogTotalsDTO,
} from '../worklog.mapper'
import {
  isWorkspaceExportDownloadable,
  toWorkspaceExportDTO,
  workspaceExportDownloadPath,
} from '../workspace-export.mapper'

const NOW = new Date('2026-10-08T12:00:00.000Z')

describe('workspace export mapper', () => {
  it('links a completed, unexpired export', () => {
    const row = createFakeWorkspaceExport({
      id: 'ex1',
      workspaceId: 'ws1',
      kind: 'LOGS',
      status: 'COMPLETED',
      storageKey: 'ws1/ex1.zip',
      fileName: 'logs.zip',
      sizeBytes: BigInt(1234),
      itemCount: 9,
      periodFrom: new Date('2026-10-01T12:00:00.000Z'),
      periodTo: NOW,
      completedAt: NOW,
      expiresAt: new Date('2026-10-15T12:00:00.000Z'),
    })
    expect(toWorkspaceExportDTO(row, NOW)).toMatchObject({
      id: 'ex1',
      kind: 'LOGS',
      status: 'COMPLETED',
      sizeBytes: 1234,
      itemCount: 9,
      periodFrom: '2026-10-01T12:00:00.000Z',
      periodTo: NOW.toISOString(),
      completedAt: NOW.toISOString(),
      expiresAt: '2026-10-15T12:00:00.000Z',
      downloadUrl: workspaceExportDownloadPath('ws1', 'ex1'),
    })
    expect(workspaceExportDownloadPath('ws1', 'ex1')).toBe(
      '/api/workspaces/ws1/exports/ex1/download',
    )
  })

  it('shows a completed export past its expiry as expired, without a link', () => {
    const row = createFakeWorkspaceExport({
      status: 'COMPLETED',
      storageKey: 'k',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    })
    const dto = toWorkspaceExportDTO(row, NOW)
    expect(dto.status).toBe('EXPIRED')
    expect(dto.downloadUrl).toBeNull()
  })

  it('keeps pending and failed exports as they are', () => {
    const pending = toWorkspaceExportDTO(createFakeWorkspaceExport(), NOW)
    expect(pending).toMatchObject({
      status: 'PENDING',
      sizeBytes: null,
      periodFrom: null,
      completedAt: null,
      expiresAt: null,
      downloadUrl: null,
    })
    expect(
      isWorkspaceExportDownloadable(
        { status: 'COMPLETED', storageKey: null, expiresAt: NOW },
        NOW,
      ),
    ).toBe(false)
    expect(
      isWorkspaceExportDownloadable(
        { status: 'COMPLETED', storageKey: 'k', expiresAt: null },
        NOW,
      ),
    ).toBe(false)
  })
})

const set = (overrides: Partial<IndicatorSet> = {}): IndicatorSet => ({
  serviceDesk: {
    loggedMinutes: 90,
    businessMinutes: 2400,
    utilization: 0.0375,
    billableShare: 0.5,
    billedAmount: '150.00',
    ticketsResolved: 2,
    minutesPerResolvedTicket: 45,
    avgFirstResponseMinutes: 30,
    avgResolutionMinutes: 600,
    slaCompliance: 1,
    reopenRate: 0,
    timerShare: 0.6667,
    daysWithoutEntries: 3,
    businessDays: 5,
  },
  crm: { tasksCompleted: 4, opportunitiesWon: 1, wonAmount: '900.00' },
  communication: { conversationsHandled: 7 },
  ...overrides,
})

function dto(overrides: Partial<ProductivityDTO> = {}): ProductivityDTO {
  return {
    period: {
      from: '2026-10-01',
      to: '2026-10-07',
      timezone: 'America/Sao_Paulo',
      previousFrom: '2026-09-24',
      previousTo: '2026-09-30',
    },
    calendar: { source: 'standard', name: 'Padrão' },
    modules: { serviceDesk: true, crm: true, communication: true },
    canViewTeam: true,
    team: { current: set(), previous: set(), people: 1 },
    people: [
      {
        user: { id: 'u1', name: 'Ana', email: 'ana@x.com', image: null },
        current: set(),
        previous: set({ serviceDesk: null, crm: null, communication: null }),
      },
    ],
    trend: [],
    ...overrides,
  }
}

describe('worklog mapper', () => {
  it('formats local date-times in the given zone', () => {
    const at = new Date('2026-10-08T02:05:00.000Z')
    expect(formatLocalDateTime(at, 'America/Sao_Paulo')).toBe(
      '2026-10-07 23:05',
    )
    expect(formatLocalDateTime(at, 'UTC')).toBe('2026-10-08 02:05')
  })

  it('maps a running entry without an amount', () => {
    const row = {
      id: 'e1',
      startedAt: NOW,
      endedAt: null,
      minutes: 0,
      billable: false,
      source: 'MANUAL',
      amount: null,
      description: null,
      user: { id: 'u1', name: 'Ana', email: 'ana@x.com', image: null },
      ticket: { id: 't1', number: 7, type: 'PROBLEM', title: 'Lentidão' },
    } as WorklogEntryRow
    expect(toWorklogEntryDTO(row, DEFAULT_SD_TICKET_PREFIXES)).toMatchObject({
      endedAt: null,
      amount: null,
      ticket: { code: 'PRB-000007' },
    })
  })

  it('derives the non-billable and manual minutes of the totals', () => {
    expect(
      toWorklogTotalsDTO({
        entries: 3,
        minutes: 100,
        billableMinutes: 70,
        timerMinutes: 40,
        amount: '10.00',
      }),
    ).toEqual({
      entries: 3,
      minutes: 100,
      billableMinutes: 70,
      nonBillableMinutes: 30,
      timerMinutes: 40,
      manualMinutes: 60,
      amount: '10.00',
    })
  })

  it('writes one column per enabled indicator, percentages ×100', () => {
    const header = productivityCsvHeader(dto().modules)
    expect(header.slice(0, 5)).toEqual([
      'pessoa',
      'email',
      'periodo',
      'de',
      'ate',
    ])
    expect(header).toHaveLength(5 + 13 + 3 + 1)
    const rows = productivityCsvRows(dto())
    expect(rows).toHaveLength(4)
    expect(rows[0].slice(0, 9)).toEqual([
      'Equipe',
      null,
      'atual',
      '2026-10-01',
      '2026-10-07',
      1.5,
      3.8,
      50,
      '150.00',
    ])
    expect(rows[1][2]).toBe('anterior')
    // A previous period without data: empty cells, hours 0.
    expect(rows[3].slice(5, 8)).toEqual([0, null, null])
    expect(rows[3].at(-1)).toBeNull()
  })

  it('leaves out switched-off modules and the team row', () => {
    const modules = { serviceDesk: false, crm: true, communication: false }
    expect(productivityCsvColumns(modules).map(([h]) => h)).toEqual([
      'tarefas_concluidas',
      'oportunidades_ganhas',
      'valor_ganho',
    ])
    const rows = productivityCsvRows(dto({ modules, team: null }))
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual([
      'Ana',
      'ana@x.com',
      'atual',
      '2026-10-01',
      '2026-10-07',
      4,
      1,
      '900.00',
    ])
    expect(rows[1].slice(5)).toEqual([null, null, null])
    expect(
      productivityCsvColumns({
        serviceDesk: false,
        crm: false,
        communication: true,
      })[0][1](set({ communication: null })),
    ).toBeNull()
  })
})
