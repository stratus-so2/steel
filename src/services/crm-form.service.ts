import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmFormDTO,
  toCrmFormPublicDTO,
  toCrmFormSubmissionDTO,
} from '@/src/mappers/crm-form.mapper'
import { CrmCompanyRepository } from '@/src/repositories/crm-company.repository'
import {
  CrmFormRepository,
  CrmFormSubmissionRepository,
} from '@/src/repositories/crm-form.repository'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import type {
  CreateCrmFormDTO,
  CrmFormFieldDTO,
  CrmFormPhaseDTO,
  SubmitCrmFormDTO,
  UpdateCrmFormDTO,
} from '@/src/schemas/crm-form.schema'
import type {
  CrmFormDTO,
  CrmFormPublicDTO,
  CrmFormSubmissionDTO,
} from '@/types/crm-form'
import { assertMember } from './authz'

/** Todo `phaseId` referenciado por um campo precisa existir em `phases`.
 * Usada no update quando o PATCH manda só `fields` ou só `phases` — o Zod
 * não valida a referência cruzada nesse caso (não enxerga o registro atual),
 * então o service faz o merge com o que já está salvo e revalida aqui. */
function findOrphanedPhaseId(
  fields: CrmFormFieldDTO[],
  phases: CrmFormPhaseDTO[],
): string | undefined {
  const phaseIds = new Set(phases.map((p) => p.id))
  return fields.find((f) => f.phaseId && !phaseIds.has(f.phaseId))?.phaseId
}

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

type TargetAttrs = Record<string, unknown>

/** Agrupa os valores enviados pelos atributos de destino declarados no
 * `mapping` de cada campo (ex.: `{ person: { name, email }, ... }`). */
function groupByTarget(
  fields: CrmFormFieldDTO[],
  values: Record<string, string | boolean>,
): Record<string, TargetAttrs> {
  const byTarget: Record<string, TargetAttrs> = {}
  for (const field of fields) {
    const raw = values[field.key]
    if (raw === undefined || raw === '') continue
    const target = (byTarget[field.mapping.target] ??= {})
    target[field.mapping.attribute] = raw
  }
  return byTarget
}

export const CrmFormService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmFormDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmFormRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmFormDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    formId: string,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmFormRepository.findById(formId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmFormDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmFormDTO,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmFormRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      description: dto.description,
      action: dto.action,
      fields: dto.fields as unknown as Prisma.InputJsonValue,
      phases: dto.phases as unknown as Prisma.InputJsonValue,
      successMessage: dto.successMessage,
      redirectUrl: dto.redirectUrl,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_form',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_form',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmFormDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    formId: string,
    dto: UpdateCrmFormDTO,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    // fields/phases são independentes no PATCH (semântica de Update), então
    // um payload que só manda um dos dois é validado aqui contra o que já
    // está salvo — evita persistir um phaseId órfão (ex. campo apontando pra
    // uma fase apagada num PATCH anterior).
    if (dto.fields || dto.phases) {
      const mergedFields =
        dto.fields ??
        (existing.value.fields as unknown as CrmFormFieldDTO[]) ??
        []
      const mergedPhases =
        dto.phases ??
        (existing.value.phases as unknown as CrmFormPhaseDTO[]) ??
        []
      const orphan = findOrphanedPhaseId(mergedFields, mergedPhases)
      if (orphan) {
        return err(
          validationError(`Fase inválida para este campo: "${orphan}"`),
        )
      }
    }

    const result = await CrmFormRepository.update(formId, {
      name: dto.name,
      description: dto.description,
      action: dto.action,
      fields: dto.fields as unknown as Prisma.InputJsonValue | undefined,
      phases: dto.phases as unknown as Prisma.InputJsonValue | undefined,
      status: dto.status,
      publishedAt:
        dto.status === undefined
          ? undefined
          : dto.status === 'PUBLISHED'
            ? new Date()
            : null,
      successMessage: dto.successMessage,
      redirectUrl: dto.redirectUrl,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'update',
      actorId,
      targetId: formId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmFormDTO(result.value))
  },

  async setPublished(
    actorId: string,
    workspaceId: string,
    formId: string,
    published: boolean,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmFormRepository.setPublished(formId, published)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'update',
      actorId,
      targetId: formId,
      meta: { published },
    })

    return ok(toCrmFormDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    formId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmFormRepository.softDelete(formId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'delete',
      actorId,
      targetId: formId,
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

    return CrmFormRepository.reorder(workspaceId, orderedIds)
  },

  async listSubmissions(
    actorId: string,
    workspaceId: string,
    formId: string,
  ): Promise<Result<CrmFormSubmissionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const form = await CrmFormRepository.findById(formId, workspaceId)
    if (!form.ok) return form

    const result = await CrmFormSubmissionRepository.listByForm(formId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmFormSubmissionDTO))
  },

  async getPublicByToken(
    publicToken: string,
  ): Promise<Result<CrmFormPublicDTO>> {
    const result =
      await CrmFormRepository.findPublishedByPublicToken(publicToken)
    if (!result.ok) return result

    return ok(toCrmFormPublicDTO(result.value))
  },

  async submit(
    publicToken: string,
    ip: string,
    referrer: string | undefined,
    dto: SubmitCrmFormDTO,
  ): Promise<Result<CrmFormSubmissionDTO>> {
    const form = await CrmFormRepository.findPublishedByPublicToken(publicToken)
    if (!form.ok) return form

    const fields = (form.value.fields as unknown as CrmFormFieldDTO[]) ?? []
    const byTarget = groupByTarget(fields, dto.values)

    let createdCompanyId: string | undefined
    let createdPersonId: string | undefined
    let createdLeadId: string | undefined

    if (form.value.action === 'COMPANY') {
      const attrs = byTarget.company ?? {}
      const created = await CrmCompanyRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name: String(attrs.name ?? 'Sem nome'),
        cnpj: attrs.cnpj ? String(attrs.cnpj) : undefined,
        domain: attrs.domain ? String(attrs.domain) : undefined,
        employees: attrs.employees ? Number(attrs.employees) : undefined,
        linkedin: attrs.linkedin ? String(attrs.linkedin) : undefined,
        arr: attrs.arr ? Number(attrs.arr) : undefined,
      })
      if (!created.ok) return created
      createdCompanyId = created.value.id
    } else if (form.value.action === 'PERSON') {
      const attrs = byTarget.person ?? {}
      const created = await CrmPersonRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name: String(attrs.name ?? attrs.email ?? 'Sem nome'),
        emails: attrs.email ? [String(attrs.email)] : [],
        phones: attrs.phone ? [String(attrs.phone)] : [],
        city: attrs.city ? String(attrs.city) : undefined,
        jobTitle: attrs.jobTitle ? String(attrs.jobTitle) : undefined,
        linkedin: attrs.linkedin ? String(attrs.linkedin) : undefined,
        avatar: attrs.avatar ? String(attrs.avatar) : undefined,
      })
      if (!created.ok) return created
      createdPersonId = created.value.id
    } else {
      const attrs = byTarget.lead ?? {}
      const created = await CrmLeadRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name: String(attrs.name ?? attrs.email ?? 'Sem nome'),
        emails: attrs.email ? [String(attrs.email)] : [],
        phones: attrs.phone ? [String(attrs.phone)] : [],
        company: attrs.company ? String(attrs.company) : undefined,
        jobTitle: attrs.jobTitle ? String(attrs.jobTitle) : undefined,
        source: attrs.source ? String(attrs.source) : 'form',
        score: 0,
      })
      if (!created.ok) return created
      createdLeadId = created.value.id
    }

    const result = await CrmFormSubmissionRepository.create({
      formId: form.value.id,
      values: dto.values as unknown as Prisma.InputJsonValue,
      action: form.value.action,
      createdCompanyId,
      createdPersonId,
      createdLeadId,
      ipHash: hashIp(ip),
      referrer,
    })
    if (!result.ok) return result

    return ok(toCrmFormSubmissionDTO(result.value))
  },
}
