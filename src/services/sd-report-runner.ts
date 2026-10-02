import type { Prisma, SdReportFormat, SdTicketType } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { sdReportGenerationFailed, sdReportNotFound } from '@/src/errors'
import { sendSdSlaReportEmail } from '@/src/lib/mail/servicedesk/send-sd-sla-report'
import { ServicedeskReportsJob } from '@/src/lib/queue/jobs'
import { getServicedeskReportsQueue } from '@/src/lib/queue/queues'
import { err, ok, type Result } from '@/src/lib/result'
import { buildSdSlaReportCsv } from '@/src/lib/servicedesk/report-csv'
import {
  SD_REPORT_BUCKET,
  SD_REPORT_CONTENT_TYPE,
  sdReportFileKey,
  sdReportFileName,
} from '@/src/lib/servicedesk/report-files'
import { renderSdSlaReportPdf } from '@/src/lib/servicedesk/report-pdf'
import {
  formatSdReportRange,
  type SdReportPeriodKind,
  sdReportNextRunAt,
  sdReportPeriodRange,
} from '@/src/lib/servicedesk/report-schedule'
import {
  computeSdSlaReport,
  formatSdReportMinutes,
  formatSdReportPercent,
  type SdReportTicketRow,
  type SdSlaReportSummary,
} from '@/src/lib/servicedesk/report-sla'
import { parseSdCalendar } from '@/src/lib/servicedesk/sla'
import { resolveSdTicketPrefixes } from '@/src/lib/servicedesk/ticket-code'
import { putObject } from '@/src/lib/storage/s3'
import { toSdReportRunDTO } from '@/src/mappers/sd-report.mapper'
import {
  SdReportDataRepository,
  SdReportRunRepository,
  SdScheduledReportRepository,
  type SdScheduledReportWithCount,
} from '@/src/repositories/sd-report.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type { SdReportRunDTO } from '@/types/sd-report'
import { NotificationService } from './notification.service'

/**
 * Geração do relatório de SLA — **sem autorização** (quem chama já resolveu
 * o acesso): é usado pelo `SdReportService` ("gerar agora") e pelo processor
 * da fila `servicedesk-reports`.
 *
 * O caminho é sempre o mesmo:
 *
 * 1. período no **fuso do relatório** (`report-schedule.ts`);
 * 2. idempotência: com agendamento, `(reportId, periodStart)` já registrado
 *    devolve a execução anterior — reprocessar o job não reenvia e-mail;
 * 3. leitura dos chamados do recorte (o repositório) + apuração pura
 *    (`report-sla.ts`);
 * 4. PDF e/ou CSV gravados no bucket privado `servicedesk`;
 * 5. e-mail para os destinatários (livres + responsáveis das contas), com os
 *    arquivos anexos enquanto couberem;
 * 6. aviso `report.ready` a quem pediu o relatório sob demanda.
 *
 * Nunca lança: falha vira execução `FAILED` com o motivo, que é o que a tela
 * de histórico mostra.
 */

/** Teto de chamados lidos por relatório (protege a memória do worker). */
const TICKET_LIMIT = 20_000
/** Violações detalhadas no PDF/e-mail; o CSV traz as mesmas. */
const MAX_VIOLATIONS = 200
/** Violações citadas no corpo do e-mail. */
const EMAIL_VIOLATIONS = 5
/** Acima disso os arquivos não vão anexos (só o link do histórico). */
const ATTACHMENT_LIMIT_BYTES = 8 * 1024 * 1024
/** Agendamentos processados por tick. */
const TICK_BATCH = 200

export interface SdReportScope {
  customerIds: string[]
  departmentIds: string[]
  ticketTypes: SdTicketType[]
}

export interface GenerateSdReportInput {
  workspaceId: string
  /** Agendamento de origem; ausente = relatório sob demanda. */
  report?: SdScheduledReportWithCount | null
  name: string
  scope: SdReportScope
  period: SdReportPeriodKind
  formats: SdReportFormat[]
  timezone: string
  recipients: string[]
  includeAccountOwners: boolean
  /** Quem pediu (sob demanda): recebe o aviso `report.ready`. */
  requestedById?: string | null
  /** Período explícito (o tick carimba o seu, para a idempotência bater). */
  periodStart?: Date
  periodEnd?: Date
  now?: Date
  /** Origem, só para o log (`report.manual`, `report.schedule`). */
  source: string
}

export interface SdReportTickResult {
  due: number
  enqueued: number
  errors: number
}

function unique(emails: string[]): string[] {
  return [
    ...new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.includes('@')),
    ),
  ]
}

/** Resumo em linhas "rótulo: valor" para o corpo do e-mail. */
export function sdReportEmailIndicators(
  summary: SdSlaReportSummary,
): { label: string; value: string }[] {
  return [
    { label: 'Chamados abertos', value: String(summary.volume.opened) },
    { label: 'Chamados resolvidos', value: String(summary.volume.resolved) },
    {
      label: 'Em aberto no fim do período',
      value: String(summary.volume.openAtEnd),
    },
    {
      label: 'SLA de primeira resposta',
      value: formatSdReportPercent(summary.firstResponse.compliance),
    },
    {
      label: 'SLA de resolução',
      value: formatSdReportPercent(summary.resolution.compliance),
    },
    {
      label: 'Tempo médio de primeira resposta',
      value: formatSdReportMinutes(summary.firstResponse.averageMinutes),
    },
    {
      label: 'MTTR',
      value: formatSdReportMinutes(summary.resolution.averageMinutes),
    },
    {
      label: 'CSAT',
      value:
        summary.csat.average === null
          ? '—'
          : `${summary.csat.average.toFixed(1).replace('.', ',')} (${summary.csat.answered})`,
    },
  ]
}

/** Linhas dos chamados prontas para a apuração (calendário resolvido). */
async function loadRows(
  workspaceId: string,
  scope: SdReportScope,
  start: Date,
  end: Date,
): Promise<Result<SdReportTicketRow[]>> {
  const fallback = await SdReportDataRepository.findDefaultCalendar(workspaceId)
  if (!fallback.ok) return fallback
  const defaultCalendar = parseSdCalendar(fallback.value)

  const tickets = await SdReportDataRepository.collectTickets(
    workspaceId,
    scope,
    start,
    end,
    TICKET_LIMIT,
  )
  if (!tickets.ok) return tickets

  return ok(
    tickets.value.map((ticket) => ({
      id: ticket.id,
      number: ticket.number,
      type: ticket.type,
      title: ticket.title,
      createdAt: ticket.createdAt,
      firstResponseDueAt: ticket.firstResponseDueAt,
      resolutionDueAt: ticket.resolutionDueAt,
      firstRespondedAt: ticket.firstRespondedAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      csatScore: ticket.csatScore,
      customerId: ticket.customerId,
      customerName: ticket.customer?.name ?? null,
      departmentId: ticket.departmentId,
      departmentName: ticket.department?.name ?? null,
      priorityId: ticket.priorityId,
      priorityName: ticket.priority?.name ?? null,
      calendar: ticket.slaPolicy?.calendar
        ? parseSdCalendar(ticket.slaPolicy.calendar)
        : defaultCalendar,
    })),
  )
}

/** Destinatários: os livres + o responsável de cada cliente do recorte. */
async function resolveRecipients(
  workspaceId: string,
  input: GenerateSdReportInput,
): Promise<string[]> {
  if (!input.includeAccountOwners || input.scope.customerIds.length === 0) {
    return unique(input.recipients)
  }
  const contacts = await SdReportDataRepository.findCustomerContacts(
    workspaceId,
    input.scope.customerIds,
  )
  if (!contacts.ok) {
    logger.warn('servicedesk.report.account_owners_failed', {
      workspaceId,
      reason: contacts.error.code,
    })
    return unique(input.recipients)
  }
  const extra = contacts.value.flatMap((contact) =>
    [contact.email, contact.ownerEmail].filter(
      (email): email is string => !!email,
    ),
  )
  return unique([...input.recipients, ...extra])
}

interface RenderedFile {
  format: SdReportFormat
  key: string
  filename: string
  body: Buffer
  contentType: string
}

async function renderFiles(
  input: GenerateSdReportInput,
  runId: string,
  summary: SdSlaReportSummary,
  context: { workspaceName: string },
  range: { start: Date; end: Date },
  now: Date,
): Promise<RenderedFile[]> {
  const files: RenderedFile[] = []

  if (input.formats.includes('PDF')) {
    const pdf = await renderSdSlaReportPdf(summary, {
      reportName: input.name,
      workspaceName: context.workspaceName,
      timezone: input.timezone,
      generatedAt: now,
    })
    files.push({
      format: 'PDF',
      key: sdReportFileKey(input.workspaceId, runId, 'PDF'),
      filename: sdReportFileName(input.name, range.start, 'PDF'),
      body: pdf,
      contentType: SD_REPORT_CONTENT_TYPE.PDF,
    })
  }

  if (input.formats.includes('CSV')) {
    const csv = buildSdSlaReportCsv(summary, {
      reportName: input.name,
      timezone: input.timezone,
    })
    files.push({
      format: 'CSV',
      key: sdReportFileKey(input.workspaceId, runId, 'CSV'),
      filename: sdReportFileName(input.name, range.start, 'CSV'),
      body: Buffer.from(csv, 'utf-8'),
      contentType: SD_REPORT_CONTENT_TYPE.CSV,
    })
  }

  return files
}

/**
 * Gera o relatório e devolve a execução registrada. Idempotente por
 * `(reportId, periodStart)` quando há agendamento.
 */
export async function generateSdReport(
  input: GenerateSdReportInput,
): Promise<Result<SdReportRunDTO>> {
  const now = input.now ?? new Date()
  const range =
    input.periodStart && input.periodEnd
      ? { start: input.periodStart, end: input.periodEnd }
      : sdReportPeriodRange(input.period, now, input.timezone)

  if (input.report) {
    const existing = await SdReportRunRepository.findByPeriod(
      input.report.id,
      range.start,
    )
    if (!existing.ok) return existing
    if (existing.value) {
      logger.info('servicedesk.report.skipped_duplicate', {
        workspaceId: input.workspaceId,
        reportId: input.report.id,
        periodStart: range.start.toISOString(),
        source: input.source,
      })
      return ok(toSdReportRunDTO(existing.value))
    }
  }

  const context = await SdReportDataRepository.findContext(input.workspaceId)
  if (!context.ok) return context
  if (!context.value) return err(sdReportGenerationFailed())

  const rows = await loadRows(
    input.workspaceId,
    input.scope,
    range.start,
    range.end,
  )
  if (!rows.ok) return rows

  const summary = computeSdSlaReport({
    periodStart: range.start,
    periodEnd: range.end,
    rows: rows.value,
    prefixes: resolveSdTicketPrefixes(context.value.ticketPrefixes),
    now,
    maxViolations: MAX_VIOLATIONS,
  })

  const recipients = await resolveRecipients(input.workspaceId, input)

  const created = await SdReportRunRepository.create({
    workspaceId: input.workspaceId,
    reportId: input.report?.id ?? null,
    status: 'GENERATED',
    periodStart: range.start,
    periodEnd: range.end,
    // `Json` do Prisma: o resumo é um objeto serializável puro.
    summary: summary as unknown as Prisma.InputJsonValue,
    recipients,
    requestedById: input.requestedById ?? null,
  })
  if (!created.ok) return created
  const run = created.value

  logger.info('servicedesk.report.generated', {
    workspaceId: input.workspaceId,
    reportId: input.report?.id ?? null,
    runId: run.id,
    source: input.source,
    tickets: rows.value.length,
    opened: summary.volume.opened,
    resolved: summary.volume.resolved,
    violations: summary.violationCount,
    recipients: recipients.length,
  })

  try {
    const files = await renderFiles(
      input,
      run.id,
      summary,
      context.value,
      range,
      now,
    )
    for (const file of files) {
      await putObject({
        bucket: SD_REPORT_BUCKET,
        key: file.key,
        body: file.body,
        contentType: file.contentType,
      })
    }

    const stored = await SdReportRunRepository.update(run.id, {
      pdfKey: files.find((f) => f.format === 'PDF')?.key ?? null,
      csvKey: files.find((f) => f.format === 'CSV')?.key ?? null,
    })
    if (!stored.ok) return stored

    const sent = await deliver({
      input,
      runId: run.id,
      summary,
      files,
      recipients,
      range,
      workspaceName: context.value.workspaceName,
      workspaceSlug: context.value.workspaceSlug,
    })

    if (input.report) {
      const touched = await SdScheduledReportRepository.update(
        input.report.id,
        input.workspaceId,
        { lastRunAt: now },
      )
      if (!touched.ok) {
        logger.warn('servicedesk.report.touch_failed', {
          workspaceId: input.workspaceId,
          reportId: input.report.id,
          reason: touched.error.code,
        })
      }
    }

    await notifyRequester({
      input,
      runId: run.id,
      summary,
      workspaceSlug: context.value.workspaceSlug,
    })

    if (sent === 0) return ok(toSdReportRunDTO(stored.value))

    const finished = await SdReportRunRepository.update(run.id, {
      status: 'SENT',
      sentAt: now,
    })
    if (!finished.ok) return finished
    return ok(toSdReportRunDTO(finished.value))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    logger.error('servicedesk.report.failed', {
      workspaceId: input.workspaceId,
      reportId: input.report?.id ?? null,
      runId: run.id,
      source: input.source,
      message,
    })
    const failed = await SdReportRunRepository.update(run.id, {
      status: 'FAILED',
      error: message.slice(0, 500),
    })
    if (!failed.ok) return failed
    return err(sdReportGenerationFailed(message.slice(0, 200)))
  }
}

/** Envia o e-mail a cada destinatário; devolve quantos receberam. */
async function deliver(args: {
  input: GenerateSdReportInput
  runId: string
  summary: SdSlaReportSummary
  files: RenderedFile[]
  recipients: string[]
  range: { start: Date; end: Date }
  workspaceName: string
  workspaceSlug: string
}): Promise<number> {
  const { input, summary, files, recipients } = args
  if (recipients.length === 0) return 0

  const totalBytes = files.reduce((sum, file) => sum + file.body.byteLength, 0)
  const attach = totalBytes > 0 && totalBytes <= ATTACHMENT_LIMIT_BYTES
  const redirectUrl = `${NEXT_PUBLIC_URL}/${args.workspaceSlug}/servicedesk/settings?tab=reports`
  const periodLabel = formatSdReportRange(args.range, input.timezone)

  let delivered = 0
  for (const email of recipients) {
    try {
      await sendSdSlaReportEmail({
        email,
        reportName: input.name,
        workspaceName: args.workspaceName,
        periodLabel,
        indicators: sdReportEmailIndicators(summary),
        violations: summary.violations
          .slice(0, EMAIL_VIOLATIONS)
          .map((violation) => ({
            code: violation.code,
            title: violation.title,
            customer: violation.customer,
            delay: formatSdReportMinutes(violation.delayMinutes),
          })),
        violationCount: summary.violationCount,
        attached: attach,
        formats: files.map((file) => file.format),
        redirectUrl,
        ...(attach
          ? {
              attachments: files.map((file) => ({
                filename: file.filename,
                content: file.body,
              })),
            }
          : {}),
      })
      delivered += 1
    } catch (error) {
      logger.warn('servicedesk.report.email_failed', {
        workspaceId: input.workspaceId,
        runId: args.runId,
        reason: error instanceof Error ? error.message : 'unknown',
      })
    }
  }

  if (delivered > 0) {
    logger.info('servicedesk.report.sent', {
      workspaceId: input.workspaceId,
      reportId: input.report?.id ?? null,
      runId: args.runId,
      recipients: delivered,
      attached: attach,
    })
  }
  return delivered
}

/** Aviso `report.ready` a quem pediu o relatório sob demanda. */
async function notifyRequester(args: {
  input: GenerateSdReportInput
  runId: string
  summary: SdSlaReportSummary
  workspaceSlug: string
}): Promise<void> {
  const requestedById = args.input.requestedById
  if (!requestedById) return

  const notified = await NotificationService.notifyUsers({
    workspaceId: args.input.workspaceId,
    userIds: [requestedById],
    // Mesmo `kind` que o catálogo declara para `report.ready`.
    kind: 'SD_REPORT_READY',
    title: 'Relatório pronto',
    body: `${args.input.name} — ${args.summary.volume.resolved} chamado(s) resolvido(s) no período.`,
    href: `/${args.workspaceSlug}/servicedesk/settings?tab=reports`,
  })
  if (!notified.ok) {
    logger.warn('servicedesk.report.notify_failed', {
      workspaceId: args.input.workspaceId,
      runId: args.runId,
      reason: notified.error.code,
    })
  }
}

export const SdReportRunner = {
  /**
   * Tick horário (`ServicedeskReportsCron`, :10): enfileira um
   * `generate-report` por agendamento vencido — com o período já carimbado,
   * para a idempotência bater — e recalcula o próximo envio. Workspace com o
   * módulo desligado é ignorado (e o agendamento não acumula atraso).
   */
  async runTick(now = new Date()): Promise<SdReportTickResult> {
    const result: SdReportTickResult = { due: 0, enqueued: 0, errors: 0 }

    const due = await SdScheduledReportRepository.listDue(now, TICK_BATCH)
    if (!due.ok) {
      result.errors += 1
      return result
    }
    if (due.value.length === 0) return result

    const enabled = await SdTicketContextRepository.listEnabledWorkspaceIds()
    if (!enabled.ok) {
      result.errors += 1
      return result
    }
    const allowed = new Set(enabled.value)
    const queue = getServicedeskReportsQueue()

    for (const report of due.value) {
      const next = sdReportNextRunAt(report, now)
      const rescheduled = await SdScheduledReportRepository.update(
        report.id,
        report.workspaceId,
        { nextRunAt: next },
      )
      if (!rescheduled.ok) {
        result.errors += 1
        continue
      }
      if (!allowed.has(report.workspaceId)) continue

      result.due += 1
      const range = sdReportPeriodRange(report.period, now, report.timezone)
      try {
        await queue.add(ServicedeskReportsJob.GenerateReport, {
          workspaceId: report.workspaceId,
          reportId: report.id,
          periodStart: range.start.toISOString(),
          periodEnd: range.end.toISOString(),
        })
        result.enqueued += 1
      } catch (error) {
        result.errors += 1
        logger.error('servicedesk.report.enqueue_failed', {
          workspaceId: report.workspaceId,
          reportId: report.id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }

    logger.info('servicedesk.report.tick', {
      component: 'Worker',
      ...result,
    })
    return result
  },

  /**
   * Job `generate-report`: carrega o agendamento (quando houver) e gera. O
   * payload pode sobrepor período e destinatários (envio pontual).
   */
  async generateFromJob(payload: {
    workspaceId: string
    reportId?: string
    requestedById?: string
    periodStart?: string
    periodEnd?: string
    recipients?: string[]
  }): Promise<Result<SdReportRunDTO>> {
    if (!payload.reportId) {
      return err(sdReportNotFound())
    }
    const report = await SdScheduledReportRepository.findById(
      payload.reportId,
      payload.workspaceId,
    )
    if (!report.ok) return err(sdReportNotFound())

    return generateSdReport({
      workspaceId: payload.workspaceId,
      report: report.value,
      name: report.value.name,
      scope: {
        customerIds: report.value.customerIds,
        departmentIds: report.value.departmentIds,
        ticketTypes: report.value.ticketTypes,
      },
      period: report.value.period,
      formats: report.value.formats,
      timezone: report.value.timezone,
      recipients: payload.recipients ?? report.value.recipients,
      includeAccountOwners: report.value.includeAccountOwners,
      requestedById: payload.requestedById ?? null,
      periodStart: payload.periodStart
        ? new Date(payload.periodStart)
        : undefined,
      periodEnd: payload.periodEnd ? new Date(payload.periodEnd) : undefined,
      source: 'report.schedule',
    })
  },
}
