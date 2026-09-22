import type { SdPersonType } from '@prisma/client'
import type z from 'zod'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { sdCustomerDocumentConflict, sdDocumentInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { mapSdCustomerImportRecord } from '@/src/lib/servicedesk/directory-import'
import {
  detectPersonType,
  formatDocument,
  normalizePhone,
  validateDocument,
} from '@/src/lib/servicedesk/document'
import {
  toSdCustomerDetailDTO,
  toSdCustomerDTO,
} from '@/src/mappers/sd-customer.mapper'
import {
  SdCustomerRepository,
  type SdCustomerWithCounts,
  type SdCustomerWriteData,
} from '@/src/repositories/sd-customer.repository'
import {
  type CreateSdCustomerDTO,
  CreateSdCustomerSchema,
  type ImportSdCustomersDTO,
  type ListSdCustomersDTO,
  type SdCustomerOptionsDTO,
  type UpdateSdCustomerDTO,
} from '@/src/schemas/sd-customer.schema'
import type { SdCustomerDetailDTO, SdCustomerDTO } from '@/types/sd-customer'
import type {
  SdImportResultDTO,
  SdOptionDTO,
  SdPage,
} from '@/types/sd-directory'
import type { PermissionAction } from '../lib/permissions'
import { SdAccess } from './sd-access'

const RESOURCE = 'sd-customers'

function agent(actorId: string, workspaceId: string, action: PermissionAction) {
  return SdAccess.requireAgent(actorId, workspaceId, {
    resource: RESOURCE,
    action,
  })
}

/**
 * Documento normalizado + tipo de pessoa. `document` `undefined` = não
 * mexe; `null` = limpa. Com documento, o tipo de pessoa é inferido dele e
 * precisa bater com o informado.
 */
function resolveDocument(
  document: string | null | undefined,
  personType: SdPersonType | undefined,
): Result<{ document: string | null | undefined; personType?: SdPersonType }> {
  if (!document) {
    return ok({
      document,
      ...(personType ? { personType } : {}),
    })
  }
  const validation = validateDocument(document)
  if (!validation.valid) {
    return err(
      sdDocumentInvalid(
        validation.kind === 'CPF'
          ? 'CPF inválido'
          : validation.kind === 'CNPJ'
            ? 'CNPJ inválido'
            : 'Informe um CPF (11 dígitos) ou CNPJ (14 caracteres)',
      ),
    )
  }
  const inferred = detectPersonType(validation.normalized) as SdPersonType
  if (personType && personType !== inferred) {
    return err(
      sdDocumentInvalid(
        inferred === 'INDIVIDUAL'
          ? 'CPF informado para pessoa jurídica'
          : 'CNPJ informado para pessoa física',
      ),
    )
  }
  return ok({ document: validation.normalized, personType: inferred })
}

async function assertDocumentAvailable(
  workspaceId: string,
  document: string | null | undefined,
  excludeId?: string,
): Promise<Result<void>> {
  if (!document) return ok(undefined)
  const existing = await SdCustomerRepository.findByDocument(
    workspaceId,
    document,
    excludeId,
  )
  if (!existing.ok) return existing
  if (existing.value) {
    return err(
      sdCustomerDocumentConflict(
        `Já existe um cadastro com este CPF/CNPJ: ${existing.value.name}`,
      ),
    )
  }
  return ok(undefined)
}

function phones(dto: {
  phone?: string | null
  whatsapp?: string | null
}): Pick<SdCustomerWriteData, 'phone' | 'whatsapp'> {
  return {
    ...(dto.phone !== undefined ? { phone: normalizePhone(dto.phone) } : {}),
    ...(dto.whatsapp !== undefined
      ? { whatsapp: normalizePhone(dto.whatsapp) }
      : {}),
  }
}

/** Documento → disponibilidade → insert (sem autorização: quem chama checa). */
async function insertCustomer(
  actorId: string,
  workspaceId: string,
  dto: CreateSdCustomerDTO,
): Promise<Result<SdCustomerWithCounts>> {
  const doc = resolveDocument(dto.document, dto.personType)
  if (!doc.ok) return doc
  const available = await assertDocumentAvailable(
    workspaceId,
    doc.value.document,
  )
  if (!available.ok) return available

  // TODO(servicedesk-integração): validar `dto.customFields` com
  // `validateSdCustomFieldValues(definitions, values, …)` (entidade CUSTOMER).
  return SdCustomerRepository.create({
    workspaceId,
    createdById: actorId,
    kind: dto.kind,
    personType: doc.value.personType ?? 'LEGAL',
    name: dto.name,
    tradeName: dto.tradeName,
    document: doc.value.document,
    email: dto.email,
    ...phones(dto),
    zipCode: dto.zipCode,
    street: dto.street,
    number: dto.number,
    complement: dto.complement,
    district: dto.district,
    city: dto.city,
    state: dto.state,
    country: dto.country,
    ibgeCode: dto.ibgeCode,
    notes: dto.notes,
    customFields: dto.customFields,
    active: dto.active,
  })
}

/** Primeira mensagem de erro de validação Zod, em pt-BR. */
function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0]
  const field = issue?.path.join('.')
  return field ? `${field}: ${issue.message}` : (issue?.message ?? 'inválido')
}

export const SdCustomerService = {
  /**
   * Importação de planilha (linhas já convertidas em `{ coluna: valor }` —
   * ver `src/lib/servicedesk/csv.ts`). Cada linha é validada e criada
   * separadamente; as recusadas voltam com o número da linha (cabeçalho = 1).
   */
  async importRows(
    actorId: string,
    workspaceId: string,
    dto: ImportSdCustomersDTO,
  ): Promise<Result<SdImportResultDTO>> {
    const ctx = await agent(actorId, workspaceId, 'CREATE')
    if (!ctx.ok) return ctx

    let created = 0
    const rejected: SdImportResultDTO['rejected'] = []
    for (const [index, record] of dto.rows.entries()) {
      const line = index + 2
      const parsed = CreateSdCustomerSchema.safeParse({
        ...mapSdCustomerImportRecord(record),
        kind: dto.kind,
      })
      if (!parsed.success) {
        rejected.push({ line, message: firstIssue(parsed.error) })
        continue
      }
      const result = await insertCustomer(actorId, workspaceId, parsed.data)
      if (result.ok) created++
      else rejected.push({ line, message: result.error.message })
    }

    auditMutation({
      entity: 'sd_customer',
      action: 'create',
      actorId,
      meta: {
        workspaceId,
        import: true,
        created,
        rejected: rejected.length,
      },
    })
    return ok({ created, rejected })
  },

  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdCustomersDTO,
  ): Promise<Result<SdPage<SdCustomerDTO>>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const result = await SdCustomerRepository.list(workspaceId, filters)
    if (!result.ok) return result

    return ok({
      items: result.value.items.map(toSdCustomerDTO),
      total: result.value.total,
      page: filters.page,
      pageSize: filters.pageSize,
    })
  },

  async get(
    actorId: string,
    workspaceId: string,
    customerId: string,
  ): Promise<Result<SdCustomerDetailDTO>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const detail = await SdCustomerRepository.findDetail(
      customerId,
      workspaceId,
    )
    if (!detail.ok) return detail

    const tickets = await SdCustomerRepository.listRecentTickets(
      workspaceId,
      customerId,
    )
    if (!tickets.ok) return tickets

    return ok(toSdCustomerDetailDTO(detail.value, tickets.value))
  },

  /** Busca leve para o seletor (combobox) do formulário de chamado. */
  async options(
    actorId: string,
    workspaceId: string,
    query: SdCustomerOptionsDTO,
  ): Promise<Result<SdOptionDTO[]>> {
    const ctx = await agent(actorId, workspaceId, 'VIEW')
    if (!ctx.ok) return ctx

    const rows = await SdCustomerRepository.options(workspaceId, query)
    if (!rows.ok) return rows

    return ok(
      rows.value.map((row) => {
        const place = [row.city, row.state].filter(Boolean).join('/')
        const parts = [
          row.tradeName && row.tradeName !== row.name ? row.tradeName : null,
          row.document ? formatDocument(row.document) : null,
          place || null,
        ].filter(Boolean)
        return {
          id: row.id,
          label: row.name,
          sublabel: parts.length ? parts.join(' · ') : null,
        }
      }),
    )
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCustomerDTO,
  ): Promise<Result<SdCustomerDTO>> {
    const ctx = await agent(actorId, workspaceId, 'CREATE')
    if (!ctx.ok) return ctx

    const result = await insertCustomer(actorId, workspaceId, dto)
    if (!result.ok) {
      auditMutation({
        entity: 'sd_customer',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'sd_customer',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { workspaceId, kind: result.value.kind },
    })
    logger.info('servicedesk.customer.created', {
      workspaceId,
      customerId: result.value.id,
      kind: result.value.kind,
    })
    return ok(toSdCustomerDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    customerId: string,
    dto: UpdateSdCustomerDTO,
  ): Promise<Result<SdCustomerDTO>> {
    const ctx = await agent(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const existing = await SdCustomerRepository.findById(
      customerId,
      workspaceId,
    )
    if (!existing.ok) return existing

    // Tipo de pessoa confere com o documento final (novo ou o já salvo).
    const finalDocument =
      dto.document !== undefined ? dto.document : existing.value.document
    const doc = resolveDocument(finalDocument, dto.personType)
    if (!doc.ok) return doc
    if (dto.document !== undefined) {
      const available = await assertDocumentAvailable(
        workspaceId,
        doc.value.document,
        customerId,
      )
      if (!available.ok) return available
    }

    // TODO(servicedesk-integração): validar `dto.customFields` com
    // `validateSdCustomFieldValues(definitions, values, …)` (entidade CUSTOMER).
    const result = await SdCustomerRepository.update(customerId, {
      kind: dto.kind,
      personType: doc.value.personType,
      name: dto.name,
      tradeName: dto.tradeName,
      ...(dto.document !== undefined ? { document: doc.value.document } : {}),
      email: dto.email,
      ...phones(dto),
      zipCode: dto.zipCode,
      street: dto.street,
      number: dto.number,
      complement: dto.complement,
      district: dto.district,
      city: dto.city,
      state: dto.state,
      country: dto.country,
      ibgeCode: dto.ibgeCode,
      notes: dto.notes,
      customFields: dto.customFields,
      active: dto.active,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_customer',
      action: 'update',
      actorId,
      targetId: customerId,
      meta: { workspaceId, fields: Object.keys(dto) },
    })
    return ok(toSdCustomerDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    customerId: string,
  ): Promise<Result<void>> {
    const ctx = await agent(actorId, workspaceId, 'DELETE')
    if (!ctx.ok) return ctx

    const existing = await SdCustomerRepository.findById(
      customerId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await SdCustomerRepository.softDelete(customerId)
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_customer',
      action: 'delete',
      actorId,
      targetId: customerId,
      meta: { workspaceId },
    })
    return ok(undefined)
  },
}
