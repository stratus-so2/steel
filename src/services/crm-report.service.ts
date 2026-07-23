import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { crmReportInvalidSource } from '@/src/errors'
import { isCrmReportSource, runCrmReport } from '@/src/lib/crm-report-runner'
import { err, ok, type Result } from '@/src/lib/result'
import { toCrmReportDTO } from '@/src/mappers/crm-report.mapper'
import { CrmReportRepository } from '@/src/repositories/crm-report.repository'
import type {
  CreateCrmReportDTO,
  UpdateCrmReportDTO,
} from '@/src/schemas/crm-report.schema'
import type { CrmReportDTO } from '@/types/crm-report'
import { assertMember } from './authz'

export const CrmReportService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmReportDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmReportRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmReportDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmReportDTO,
  ): Promise<Result<CrmReportDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmReportRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      source: dto.source,
      columns: dto.columns as Prisma.InputJsonValue,
      filters: dto.filters as Prisma.InputJsonValue,
      groupBy: dto.groupBy,
      sort: dto.sort as Prisma.InputJsonValue | undefined,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_report',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_report',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmReportDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    reportId: string,
    dto: UpdateCrmReportDTO,
  ): Promise<Result<CrmReportDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmReportRepository.findById(reportId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmReportRepository.update(reportId, {
      name: dto.name,
      columns: dto.columns as Prisma.InputJsonValue | undefined,
      filters: dto.filters as Prisma.InputJsonValue | undefined,
      groupBy: dto.groupBy,
      sort: dto.sort as Prisma.InputJsonValue | undefined,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_report',
      action: 'update',
      actorId,
      targetId: reportId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmReportDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    reportId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmReportRepository.findById(reportId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmReportRepository.softDelete(reportId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_report',
      action: 'delete',
      actorId,
      targetId: reportId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmReportRepository.reorder(workspaceId, orderedIds)
  },

  async runData(
    actorId: string,
    workspaceId: string,
    reportId: string,
  ): Promise<Result<Record<string, unknown>[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const report = await CrmReportRepository.findById(reportId, workspaceId)
    if (!report.ok) return report

    if (!isCrmReportSource(report.value.source)) {
      return err(crmReportInvalidSource())
    }

    const rows = await runCrmReport({
      source: report.value.source,
      workspaceId,
      columns: report.value.columns as string[],
      filters: (report.value.filters as Record<string, unknown>) ?? {},
      groupBy: report.value.groupBy,
      sort: report.value.sort as {
        field: string
        direction: 'asc' | 'desc'
      } | null,
    })

    return ok(rows)
  },
}
