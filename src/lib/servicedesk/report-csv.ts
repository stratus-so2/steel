import { toCsv } from '../crm-export'
import { formatSdReportDateTime, formatSdReportRange } from './report-schedule'
import {
  formatSdReportMinutes,
  formatSdReportPercent,
  type SdReportBreakdown,
  type SdSlaReportSummary,
} from './report-sla'

/**
 * CSV do relatório de SLA (lib pura). Um arquivo com blocos separados por
 * linha vazia — indicadores, quebras, CSAT e as violações —, que é como as
 * equipes de operação consomem relatório em planilha. O escape e o BOM saem
 * de `toCsv` (`src/lib/crm-export.ts`), já usado pelos relatórios do CRM;
 * `src/lib/servicedesk/csv.ts` é o **leitor** de CSV da importação, não um
 * gerador.
 */

const BOM = '﻿'

interface CsvSection {
  title: string
  columns: string[]
  rows: Record<string, unknown>[]
}

function section(part: CsvSection): string {
  const table = toCsv(part.columns, part.rows).replace(BOM, '')
  return `${part.title}\r\n${table}`
}

function breakdownSection(
  title: string,
  label: string,
  rows: SdReportBreakdown[],
): string {
  return section({
    title,
    columns: [label, 'Abertos', 'Resolvidos', 'Violados', 'SLA', 'MTTR'],
    rows: rows.map((row) => ({
      [label]: row.label,
      Abertos: row.opened,
      Resolvidos: row.resolved,
      Violados: row.breached,
      SLA: formatSdReportPercent(row.compliance),
      MTTR: formatSdReportMinutes(row.averageResolutionMinutes),
    })),
  })
}

export interface SdReportCsvOptions {
  reportName: string
  /** Fuso do relatório: toda data do arquivo sai nele. */
  timezone: string
}

export function buildSdSlaReportCsv(
  summary: SdSlaReportSummary,
  options: SdReportCsvOptions,
): string {
  const { timezone } = options
  const blocks = [
    section({
      title: 'Relatório de SLA',
      columns: ['Indicador', 'Valor'],
      rows: [
        { Indicador: 'Relatório', Valor: options.reportName },
        {
          Indicador: 'Período',
          Valor: formatSdReportRange(
            { start: summary.periodStart, end: summary.periodEnd },
            timezone,
          ),
        },
        { Indicador: 'Fuso', Valor: timezone },
        { Indicador: 'Chamados abertos', Valor: summary.volume.opened },
        { Indicador: 'Chamados resolvidos', Valor: summary.volume.resolved },
        { Indicador: 'Chamados fechados', Valor: summary.volume.closed },
        {
          Indicador: 'Em aberto no fim do período',
          Valor: summary.volume.openAtEnd,
        },
        {
          Indicador: 'SLA de primeira resposta',
          Valor: formatSdReportPercent(summary.firstResponse.compliance),
        },
        {
          Indicador: 'Tempo médio de primeira resposta',
          Valor: formatSdReportMinutes(summary.firstResponse.averageMinutes),
        },
        {
          Indicador: 'SLA de resolução',
          Valor: formatSdReportPercent(summary.resolution.compliance),
        },
        {
          Indicador: 'MTTR (tempo médio de resolução)',
          Valor: formatSdReportMinutes(summary.resolution.averageMinutes),
        },
        { Indicador: 'Violações de SLA', Valor: summary.violationCount },
        {
          Indicador: 'CSAT médio',
          Valor:
            summary.csat.average === null
              ? '—'
              : summary.csat.average.toFixed(1).replace('.', ','),
        },
        { Indicador: 'Avaliações respondidas', Valor: summary.csat.answered },
      ],
    }),
    breakdownSection('Por departamento', 'Departamento', summary.byDepartment),
    breakdownSection('Por cliente', 'Cliente', summary.byCustomer),
    breakdownSection('Por prioridade', 'Prioridade', summary.byPriority),
    section({
      title: 'Satisfação (CSAT)',
      columns: ['Nota', 'Respostas'],
      rows: summary.csat.distribution.map((entry) => ({
        Nota: entry.score,
        Respostas: entry.count,
      })),
    }),
    section({
      title: 'Violações de SLA',
      columns: [
        'Chamado',
        'Título',
        'Cliente',
        'Prazo',
        'Vencimento',
        'Atraso',
      ],
      rows: summary.violations.map((violation) => ({
        Chamado: violation.code,
        Título: violation.title,
        Cliente: violation.customer ?? '—',
        Prazo:
          violation.kind === 'FIRST_RESPONSE'
            ? 'Primeira resposta'
            : 'Resolução',
        Vencimento: formatSdReportDateTime(violation.dueAt, timezone),
        Atraso: formatSdReportMinutes(violation.delayMinutes),
      })),
    }),
  ]

  return `${BOM}${blocks.join('\r\n\r\n')}\r\n`
}
