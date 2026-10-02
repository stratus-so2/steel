import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import {
  computeSdSlaReport,
  type SdReportTicketRow,
  type SdSlaReportSummary,
} from '@/src/lib/servicedesk/report-sla'
import { SD_CALENDAR_24X7 } from '@/src/lib/servicedesk/sla'
import type {
  SdReportRunWithRelations,
  SdScheduledReportWithCount,
} from '@/src/repositories/sd-report.repository'

/**
 * Fábricas dos relatórios agendados: fakes para os testes unitários
 * (service, runner, processor, PDF/CSV) e seeds no banco para os de
 * integração. O período padrão é setembro/2026 (fuso America/Sao_Paulo), que
 * é o `LAST_MONTH` de 01/10/2026 — a data fixa dos testes.
 */

const fixed = () => new Date('2026-10-01T12:00:00.000Z')

export const SD_REPORT_PERIOD_START = new Date('2026-09-01T03:00:00.000Z')
export const SD_REPORT_PERIOD_END = new Date('2026-10-01T03:00:00.000Z')

export function createFakeSdScheduledReport(
  overrides?: Partial<SdScheduledReportWithCount>,
): SdScheduledReportWithCount {
  return {
    id: 'rep1',
    workspaceId: 'ws1',
    name: 'SLA mensal',
    kind: 'SLA',
    customerIds: [],
    departmentIds: [],
    ticketTypes: [],
    period: 'LAST_MONTH',
    formats: ['PDF', 'CSV'],
    dayOfMonth: 1,
    atTime: '07:00',
    timezone: 'America/Sao_Paulo',
    recipients: ['gestor@example.com'],
    includeAccountOwners: false,
    active: true,
    lastRunAt: null,
    nextRunAt: new Date('2026-11-01T10:00:00.000Z'),
    createdById: 'u1',
    createdAt: fixed(),
    updatedAt: fixed(),
    deletedAt: null,
    _count: { runs: 0 },
    ...overrides,
  }
}

export function createFakeSdReportRun(
  overrides?: Partial<SdReportRunWithRelations>,
): SdReportRunWithRelations {
  return {
    id: createId(),
    workspaceId: 'ws1',
    reportId: 'rep1',
    kind: 'SLA',
    status: 'GENERATED',
    periodStart: SD_REPORT_PERIOD_START,
    periodEnd: SD_REPORT_PERIOD_END,
    summary: null,
    pdfKey: null,
    csvKey: null,
    recipients: ['gestor@example.com'],
    sentAt: null,
    error: null,
    requestedById: null,
    createdAt: fixed(),
    report: { id: 'rep1', name: 'SLA mensal' },
    requestedBy: null,
    ...overrides,
  }
}

/** Chamado da apuração: 24×7 por padrão, para a conta ser previsível. */
export function createFakeSdReportTicketRow(
  overrides?: Partial<SdReportTicketRow>,
): SdReportTicketRow {
  return {
    id: createId(),
    number: 1,
    type: 'INCIDENT',
    title: 'Link principal instável',
    createdAt: new Date('2026-09-02T12:00:00.000Z'),
    firstResponseDueAt: new Date('2026-09-02T13:00:00.000Z'),
    resolutionDueAt: new Date('2026-09-02T20:00:00.000Z'),
    firstRespondedAt: new Date('2026-09-02T12:30:00.000Z'),
    resolvedAt: new Date('2026-09-02T18:00:00.000Z'),
    closedAt: null,
    csatScore: 5,
    customerId: 'cus1',
    customerName: 'ACME',
    departmentId: 'dep1',
    departmentName: 'Infra',
    priorityId: 'pri1',
    priorityName: 'Alta',
    calendar: SD_CALENDAR_24X7,
    ...overrides,
  }
}

/** Resumo apurado de um conjunto de linhas (atalho do PDF/CSV/e-mail). */
export function createFakeSdReportSummary(
  rows: SdReportTicketRow[] = [createFakeSdReportTicketRow()],
  now = fixed(),
): SdSlaReportSummary {
  return computeSdSlaReport({
    periodStart: SD_REPORT_PERIOD_START,
    periodEnd: SD_REPORT_PERIOD_END,
    rows,
    now,
  })
}

/* --------------------------- seeds (integration) -------------------------- */

export async function seedSdScheduledReport(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.SdScheduledReportUncheckedCreateInput>,
) {
  return prisma.sdScheduledReport.create({
    data: {
      workspaceId,
      createdById,
      name: `Relatório ${createId().slice(0, 6)}`,
      recipients: ['gestor@example.com'],
      nextRunAt: new Date('2026-11-01T10:00:00.000Z'),
      ...overrides,
    },
  })
}

export async function seedSdReportRun(
  workspaceId: string,
  overrides?: Partial<Prisma.SdReportRunUncheckedCreateInput>,
) {
  return prisma.sdReportRun.create({
    data: {
      workspaceId,
      periodStart: SD_REPORT_PERIOD_START,
      periodEnd: SD_REPORT_PERIOD_END,
      ...overrides,
    },
  })
}
