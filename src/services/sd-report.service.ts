import { logger } from '@/lib/axiom/logger'
import {
  sdConfigNotFound,
  sdReportNotFound,
  sdReportRunNotFound,
  sdReportScheduleInvalid,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  SD_REPORT_BUCKET,
  SD_REPORT_CONTENT_TYPE,
  sdReportFileName,
} from '@/src/lib/servicedesk/report-files'
import {
  sdReportNextRunAt,
  sdReportScheduleProblem,
} from '@/src/lib/servicedesk/report-schedule'
import { getObject } from '@/src/lib/storage/s3'
import {
  type SdReportLabelLookup,
  toSdReportRunDTO,
  toSdScheduledReportDTO,
} from '@/src/mappers/sd-report.mapper'
import {
  SdReportDataRepository,
  SdReportRunRepository,
  type SdScheduledReportData,
  SdScheduledReportRepository,
  type SdScheduledReportWithCount,
} from '@/src/repositories/sd-report.repository'
import type {
  CreateSdScheduledReportDTO,
  GenerateSdReportDTO,
  ListSdReportRunsDTO,
  ListSdScheduledReportsDTO,
  SdReportDownloadQueryDTO,
  UpdateSdScheduledReportDTO,
} from '@/src/schemas/sd-report.schema'
import type { SdReportRunDTO, SdScheduledReportDTO } from '@/types/sd-report'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'
import { generateSdReport } from './sd-report-runner'

/**
 * Relatórios de SLA agendados. **Leitura** (agendamentos, histórico e
 * download dos arquivos) é de qualquer agente com `sd-reports:VIEW`;
 * **configurar** e **gerar agora** são do admin do módulo e vão auditados —
 * um relatório sai por e-mail para gente de fora, então quem dispara fica
 * registrado.
 *
 * A geração em si mora no `SdReportRunner` (sem autorização), compartilhada
 * com a fila `servicedesk-reports`.
 */

const VIEW = { resource: 'sd-reports', action: 'VIEW' } as const

/** Confere o recorte: cliente e departamento precisam ser deste workspace. */
async function assertScope(
  workspaceId: string,
  scope: { customerIds?: string[]; departmentIds?: string[] },
): Promise<Result<true>> {
  const refs = await assertSdRefs(workspaceId, {
    departmentIds: scope.departmentIds ?? [],
  })
  if (!refs.ok) return refs

  const customerIds = scope.customerIds ?? []
  if (customerIds.length === 0) return ok(true)

  const found = await SdReportDataRepository.findScopeLabels(workspaceId, {
    customerIds,
    departmentIds: [],
  })
  if (!found.ok) return found
  const known = new Set(found.value.customers.map((customer) => customer.id))
  const missing = customerIds.filter((id) => !known.has(id))
  if (missing.length === 0) return ok(true)

  const base = sdConfigNotFound()
  return err({
    ...base,
    message: 'Cliente não encontrado nesta workspace',
    details: { missing },
  })
}

/** Rótulos do recorte de vários agendamentos numa consulta só. */
async function lookupFor(
  workspaceId: string,
  rows: SdScheduledReportWithCount[],
): Promise<Result<SdReportLabelLookup>> {
  const customerIds = [...new Set(rows.flatMap((row) => row.customerIds))]
  const departmentIds = [...new Set(rows.flatMap((row) => row.departmentIds))]
  const labels = await SdReportDataRepository.findScopeLabels(workspaceId, {
    customerIds,
    departmentIds,
  })
  if (!labels.ok) return labels
  return ok({
    customers: new Map(
      labels.value.customers.map((customer) => [customer.id, customer.name]),
    ),
    departments: new Map(
      labels.value.departments.map((department) => [
        department.id,
        department.name,
      ]),
    ),
  })
}

/** A agenda resultante de uma edição parcial. */
function mergedSchedule(
  row: SdScheduledReportWithCount,
  dto: UpdateSdScheduledReportDTO,
) {
  return {
    dayOfMonth: dto.dayOfMonth ?? row.dayOfMonth,
    atTime: dto.atTime ?? row.atTime,
    timezone: dto.timezone ?? row.timezone,
  }
}

export const SdReportService = {
  /** Agendamentos do workspace (agentes e admins). */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdScheduledReportsDTO = { includeInactive: false },
  ): Promise<Result<SdScheduledReportDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx

    const rows = await SdScheduledReportRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    const lookup = await lookupFor(workspaceId, rows.value)
    if (!lookup.ok) return lookup
    return ok(
      rows.value.map((row) => toSdScheduledReportDTO(row, lookup.value)),
    )
  },

  async get(
    actorId: string,
    workspaceId: string,
    reportId: string,
  ): Promise<Result<SdScheduledReportDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx

    const row = await SdScheduledReportRepository.findById(
      reportId,
      workspaceId,
    )
    if (!row.ok) return err(sdReportNotFound())
    const lookup = await lookupFor(workspaceId, [row.value])
    if (!lookup.ok) return lookup
    return ok(toSdScheduledReportDTO(row.value, lookup.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdScheduledReportDTO,
  ): Promise<Result<SdScheduledReportDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_scheduled_report',
      action: 'create',
      targetId: (value) => value.id,
      meta: { period: dto.period, formats: dto.formats },
      run: async () => {
        const problem = sdReportScheduleProblem(dto)
        if (problem) return err(sdReportScheduleInvalid(problem))

        const scope = await assertScope(workspaceId, dto)
        if (!scope.ok) return scope

        const created = await SdScheduledReportRepository.create(workspaceId, {
          ...dto,
          createdById: actorId,
          nextRunAt: dto.active ? sdReportNextRunAt(dto, new Date()) : null,
        })
        if (!created.ok) return created

        const lookup = await lookupFor(workspaceId, [created.value])
        if (!lookup.ok) return lookup
        return ok(toSdScheduledReportDTO(created.value, lookup.value))
      },
    })
  },

  /** Editar, pausar (`active: false`) ou retomar: recalcula o próximo envio. */
  async update(
    actorId: string,
    workspaceId: string,
    reportId: string,
    dto: UpdateSdScheduledReportDTO,
  ): Promise<Result<SdScheduledReportDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_scheduled_report',
      action: 'update',
      targetId: reportId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdScheduledReportRepository.findById(
          reportId,
          workspaceId,
        )
        if (!existing.ok) return err(sdReportNotFound())

        const schedule = mergedSchedule(existing.value, dto)
        const problem = sdReportScheduleProblem(schedule)
        if (problem) return err(sdReportScheduleInvalid(problem))

        const scope = await assertScope(workspaceId, dto)
        if (!scope.ok) return scope

        const active = dto.active ?? existing.value.active
        const data: SdScheduledReportData = {
          ...dto,
          nextRunAt: active ? sdReportNextRunAt(schedule, new Date()) : null,
        }
        const updated = await SdScheduledReportRepository.update(
          reportId,
          workspaceId,
          data,
        )
        if (!updated.ok) return updated

        const lookup = await lookupFor(workspaceId, [updated.value])
        if (!lookup.ok) return lookup
        return ok(toSdScheduledReportDTO(updated.value, lookup.value))
      },
    })
  },

  /** Exclusão lógica: para de enviar; o histórico de execuções fica. */
  async remove(
    actorId: string,
    workspaceId: string,
    reportId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_scheduled_report',
      action: 'delete',
      targetId: reportId,
      run: async () => {
        const existing = await SdScheduledReportRepository.findById(
          reportId,
          workspaceId,
        )
        if (!existing.ok) return err(sdReportNotFound())
        return SdScheduledReportRepository.softDelete(reportId, workspaceId)
      },
    })
  },

  /** Histórico de execuções (do workspace ou de um agendamento). */
  async runs(
    actorId: string,
    workspaceId: string,
    filters: ListSdReportRunsDTO = { limit: 50 },
  ): Promise<Result<SdReportRunDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx

    if (filters.reportId) {
      const existing = await SdScheduledReportRepository.findById(
        filters.reportId,
        workspaceId,
      )
      if (!existing.ok) return err(sdReportNotFound())
    }

    const rows = await SdReportRunRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdReportRunDTO))
  },

  /**
   * "Gerar agora": apura e envia na hora. Com `reportId` usa o recorte e os
   * destinatários do agendamento (e vale a trava `(reportId, periodStart)`:
   * o mesmo período não é reenviado); sem ele é um relatório pontual, que
   * sem destinatário só gera os arquivos para baixar. Auditado.
   */
  async generateNow(
    actorId: string,
    workspaceId: string,
    dto: GenerateSdReportDTO,
  ): Promise<Result<SdReportRunDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_scheduled_report',
      action: 'activate',
      targetId: (value) => dto.reportId ?? value.id,
      meta: { period: dto.period ?? null, onDemand: !dto.reportId },
      run: async () => {
        let report: SdScheduledReportWithCount | null = null
        if (dto.reportId) {
          const existing = await SdScheduledReportRepository.findById(
            dto.reportId,
            workspaceId,
          )
          if (!existing.ok) return err(sdReportNotFound())
          report = existing.value
        } else {
          const scope = await assertScope(workspaceId, dto)
          if (!scope.ok) return scope
        }

        const timezone = report?.timezone ?? 'America/Sao_Paulo'
        logger.info('servicedesk.report.manual_requested', {
          workspaceId,
          actorId,
          reportId: report?.id ?? null,
        })

        return generateSdReport({
          workspaceId,
          report,
          name: report?.name ?? 'Relatório de SLA',
          scope: {
            customerIds: dto.customerIds ?? report?.customerIds ?? [],
            departmentIds: dto.departmentIds ?? report?.departmentIds ?? [],
            ticketTypes: dto.ticketTypes ?? report?.ticketTypes ?? [],
          },
          period: dto.period ?? report?.period ?? 'LAST_MONTH',
          formats: dto.formats ?? report?.formats ?? ['PDF', 'CSV'],
          timezone,
          recipients: dto.recipients ?? report?.recipients ?? [],
          includeAccountOwners: report?.includeAccountOwners ?? false,
          requestedById: actorId,
          source: 'report.manual',
        })
      },
    })
  },

  /**
   * Arquivo de uma execução (bucket privado): confere o acesso a cada
   * pedido e devolve os bytes — a rota autenticada é o "link assinado" do
   * módulo, porque a API do MinIO não é pública.
   */
  async download(
    actorId: string,
    workspaceId: string,
    runId: string,
    query: SdReportDownloadQueryDTO = { format: 'PDF' },
  ): Promise<Result<{ body: Buffer; contentType: string; fileName: string }>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, VIEW)
    if (!ctx.ok) return ctx

    const run = await SdReportRunRepository.findById(runId, workspaceId)
    if (!run.ok) return err(sdReportRunNotFound())

    const key = query.format === 'PDF' ? run.value.pdfKey : run.value.csvKey
    if (!key) return err(sdReportRunNotFound())

    try {
      const body = await getObject({ bucket: SD_REPORT_BUCKET, key })
      return ok({
        body,
        contentType: SD_REPORT_CONTENT_TYPE[query.format],
        fileName: sdReportFileName(
          run.value.report?.name ?? 'relatorio-sla',
          run.value.periodStart,
          query.format,
        ),
      })
    } catch (error) {
      logger.warn('servicedesk.report.download_failed', {
        workspaceId,
        runId,
        format: query.format,
        reason: error instanceof Error ? error.message : 'unknown',
      })
      return err(sdReportRunNotFound())
    }
  },
}
