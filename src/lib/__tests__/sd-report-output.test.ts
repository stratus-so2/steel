import { describe, expect, it } from 'vitest'
import {
  createFakeSdReportSummary,
  createFakeSdReportTicketRow,
} from '@/src/__tests__/factories/sd-report.factory'
import { csvToRecords } from '@/src/lib/servicedesk/csv'
import { buildSdSlaReportCsv } from '@/src/lib/servicedesk/report-csv'
import {
  SD_REPORT_BUCKET,
  SD_REPORT_CONTENT_TYPE,
  sdReportFileKey,
  sdReportFileName,
} from '@/src/lib/servicedesk/report-files'
import { renderSdSlaReportPdf } from '@/src/lib/servicedesk/report-pdf'

/**
 * Saída do relatório: CSV (blocos de indicadores, quebras, CSAT e
 * violações), PDF (renderizado de verdade — é o mesmo caminho do worker) e
 * as chaves/nomes dos arquivos no MinIO.
 */

const SP = 'America/Sao_Paulo'

const rows = [
  createFakeSdReportTicketRow({ number: 1 }),
  createFakeSdReportTicketRow({
    number: 2,
    title: 'Atendimento atrasado',
    createdAt: new Date('2026-09-04T11:00:00.000Z'),
    firstResponseDueAt: new Date('2026-09-04T12:00:00.000Z'),
    firstRespondedAt: new Date('2026-09-04T13:00:00.000Z'),
    resolutionDueAt: new Date('2026-09-04T16:00:00.000Z'),
    resolvedAt: new Date('2026-09-04T18:00:00.000Z'),
    customerId: 'cus2',
    customerName: 'Beta',
    departmentId: null,
    departmentName: null,
    priorityId: null,
    priorityName: null,
    csatScore: 2,
  }),
]

const summary = createFakeSdReportSummary(rows)
const emptySummary = createFakeSdReportSummary([])

describe('buildSdSlaReportCsv()', () => {
  it('opens with the indicators block, in the report timezone', () => {
    const csv = buildSdSlaReportCsv(summary, {
      reportName: 'SLA mensal',
      timezone: SP,
    })

    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Relatório de SLA')
    expect(csv).toContain('Período,01/09/2026 a 30/09/2026')
    expect(csv).toContain('Chamados abertos,2')
    // Valor com vírgula decimal sai entre aspas (RFC 4180).
    expect(csv).toContain('SLA de resolução,"50,0%"')
    expect(csv).toContain('Violações de SLA,2')
  })

  it('brings the breakdowns, the CSAT and every violation', () => {
    const csv = buildSdSlaReportCsv(summary, {
      reportName: 'SLA mensal',
      timezone: SP,
    })

    expect(csv).toContain('Por departamento')
    expect(csv).toContain('Sem departamento')
    expect(csv).toContain('Por cliente')
    expect(csv).toContain('ACME')
    expect(csv).toContain('Por prioridade')
    expect(csv).toContain('Satisfação (CSAT)')
    expect(csv).toContain('INC-000002')
    // Vencimento formatado no fuso do relatório (16:00Z = 13:00 em SP).
    expect(csv).toContain('04/09/2026 13:00')
    expect(csv).toContain('Primeira resposta')
  })

  it('is parseable by the module CSV reader (block by block)', () => {
    const csv = buildSdSlaReportCsv(summary, {
      reportName: 'SLA mensal',
      timezone: SP,
    })
    const violationsBlock = csv.split('Violações de SLA\r\n')[1] ?? ''
    const { records } = csvToRecords(violationsBlock)

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ chamado: 'INC-000002' })
  })

  it('writes a dash for a violation without a customer', () => {
    const anonymous = {
      ...summary,
      violations: summary.violations.map((violation) => ({
        ...violation,
        customer: null,
      })),
    }
    const csv = buildSdSlaReportCsv(anonymous, {
      reportName: 'SLA mensal',
      timezone: SP,
    })

    expect(csv).toContain('INC-000002,Atendimento atrasado,—,')
  })

  it('still renders every block with no tickets at all', () => {
    const csv = buildSdSlaReportCsv(emptySummary, {
      reportName: 'SLA mensal',
      timezone: SP,
    })

    expect(csv).toContain('Chamados abertos,0')
    expect(csv).toContain('CSAT médio,—')
    expect(csv).toContain('Violações de SLA,0')
  })
})

describe('renderSdSlaReportPdf()', () => {
  const options = {
    reportName: 'SLA mensal',
    workspaceName: 'Stratus',
    timezone: SP,
    generatedAt: new Date('2026-10-01T12:00:00.000Z'),
  }

  it('renders a real PDF with the violations page', async () => {
    const pdf = await renderSdSlaReportPdf(summary, options)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
    expect(pdf.byteLength).toBeGreaterThan(1000)
  })

  it('renders the empty report (no breakdown, no violation)', async () => {
    const pdf = await renderSdSlaReportPdf(emptySummary, options)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders a violation without a customer', async () => {
    const anonymous = {
      ...summary,
      violations: summary.violations.map((violation) => ({
        ...violation,
        customer: null,
      })),
    }
    const pdf = await renderSdSlaReportPdf(anonymous, options)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('renders the truncated violation list', async () => {
    const truncated = {
      ...summary,
      violations: summary.violations.slice(0, 1),
      violationCount: 9,
    }
    const pdf = await renderSdSlaReportPdf(truncated, options)

    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

describe('arquivos no MinIO', () => {
  it('keys the files under the workspace reports prefix', () => {
    expect(SD_REPORT_BUCKET).toBe('servicedesk')
    expect(sdReportFileKey('ws1', 'run1', 'PDF')).toBe('ws1/reports/run1.pdf')
    expect(sdReportFileKey('ws1', 'run1', 'CSV')).toBe('ws1/reports/run1.csv')
    expect(SD_REPORT_CONTENT_TYPE.CSV).toBe('text/csv; charset=utf-8')
  })

  it('slugifies the download name with the period', () => {
    expect(
      sdReportFileName(
        'SLA mensal — Clientes Premium',
        '2026-09-01T03:00:00.000Z',
        'PDF',
      ),
    ).toBe('sla-mensal-clientes-premium-2026-09-01.pdf')
    expect(
      sdReportFileName('???', new Date('2026-09-01T03:00:00.000Z'), 'CSV'),
    ).toBe('relatorio-2026-09-01.csv')
  })
})
