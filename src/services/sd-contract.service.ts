import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  sdContractOverlap,
  sdContractPeriodClosed,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { sdContractCovers, sdPeriodRange } from '@/src/lib/servicedesk/billing'
import {
  toSdContractDTO,
  toSdContractPeriodDTO,
  toSdContractSummaryDTO,
} from '@/src/mappers/sd-contract.mapper'
import {
  type SdContractRateData,
  SdContractRepository,
  type SdContractWithRelations,
} from '@/src/repositories/sd-contract.repository'
import { SdContractPeriodRepository } from '@/src/repositories/sd-contract-period.repository'
import type {
  CloseSdContractPeriodDTO,
  CreateSdContractDTO,
  ListSdContractsDTO,
  SdContractRateInputDTO,
  UpdateSdContractDTO,
} from '@/src/schemas/sd-contract.schema'
import type {
  SdContractDTO,
  SdContractPeriodDTO,
  SdContractSummaryDTO,
} from '@/types/sd-contract'
import { SdAccess } from './sd-access'
import { SdContractBillingService } from './sd-contract-billing.service'

/**
 * Contratos de atendimento: cadastro só pelos **admins** do módulo
 * (`SdAccess.requireAdmin`); a leitura é de qualquer agente com
 * `sd-contracts:VIEW` (solicitante nunca vê o financeiro).
 *
 * Regra de negócio central: um cliente não pode ter dois contratos
 * **ativos** com vigência sobreposta (`SD_CONTRACT_OVERLAP`).
 */

function audit(
  action: 'create' | 'update' | 'delete',
  actorId: string,
  workspaceId: string,
  targetId: string,
  meta: Record<string, unknown> = {},
): void {
  auditMutation({
    entity: 'sd_contract',
    action,
    actorId,
    targetId,
    meta: { workspaceId, ...meta },
  })
}

function toRateData(rates: SdContractRateInputDTO[]): SdContractRateData[] {
  return rates.map((rate) => ({
    ticketType: rate.ticketType,
    priorityId: rate.priorityId,
    window: rate.window,
    hourlyRate: rate.hourlyRate,
    multiplier: rate.multiplier,
  }))
}

const MISSING_LABEL: Record<string, string> = {
  customerId: 'Cliente não encontrado',
  slaPolicyId: 'Política de SLA não encontrada',
  priorityId: 'Prioridade não encontrada na tabela de valores',
}

async function assertRefs(
  workspaceId: string,
  refs: {
    customerId?: string
    slaPolicyId?: string | null
    rates?: SdContractRateInputDTO[]
  },
): Promise<Result<void>> {
  const priorityIds = (refs.rates ?? [])
    .map((rate) => rate.priorityId)
    .filter((id): id is string => id !== null)
  const missing = await SdContractRepository.validateRefs(workspaceId, {
    customerId: refs.customerId,
    slaPolicyId: refs.slaPolicyId ?? null,
    priorityIds,
  })
  if (!missing.ok) return missing
  const first = missing.value[0]
  if (first)
    return err(validationError(MISSING_LABEL[first] ?? 'Dados inválidos'))
  return ok(undefined)
}

/** Recusa vigência sobreposta de outro contrato ativo do mesmo cliente. */
async function assertNoOverlap(params: {
  workspaceId: string
  customerId: string
  startsAt: Date
  endsAt: Date | null
  excludeId?: string
}): Promise<Result<void>> {
  const clash = await SdContractRepository.findOverlapping(params)
  if (!clash.ok) return clash
  if (clash.value) {
    return err(
      sdContractOverlap(
        `O contrato "${clash.value.name}" já cobre este período para o cliente`,
      ),
    )
  }
  return ok(undefined)
}

export const SdContractService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdContractsDTO = {},
  ): Promise<Result<SdContractDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contracts',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const rows = await SdContractRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdContractDTO))
  },

  async get(
    actorId: string,
    workspaceId: string,
    contractId: string,
  ): Promise<Result<SdContractDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contracts',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const row = await SdContractRepository.findById(contractId, workspaceId)
    if (!row.ok) return row
    return ok(toSdContractDTO(row.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdContractDTO,
  ): Promise<Result<SdContractDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const refs = await assertRefs(workspaceId, dto)
    if (!refs.ok) return refs

    if (dto.status === 'ACTIVE') {
      const overlap = await assertNoOverlap({
        workspaceId,
        customerId: dto.customerId,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt ?? null,
      })
      if (!overlap.ok) return overlap
    }

    const created = await SdContractRepository.create(
      workspaceId,
      actorId,
      {
        customerId: dto.customerId,
        name: dto.name,
        code: dto.code ?? null,
        status: dto.status,
        startsAt: dto.startsAt,
        endsAt: dto.endsAt ?? null,
        billingCycle: dto.billingCycle,
        includedMinutes: dto.includedMinutes,
        carryOver: dto.carryOver,
        hourlyRate: dto.hourlyRate,
        overtimeRate: dto.overtimeRate ?? null,
        roundingMinutes: dto.roundingMinutes,
        minimumMinutes: dto.minimumMinutes,
        ticketTypes: dto.ticketTypes,
        slaPolicyId: dto.slaPolicyId ?? null,
        notes: dto.notes ?? null,
      },
      toRateData(dto.rates),
    )
    if (!created.ok) return created

    // Contrato que já nasce ativo ganha o período do ciclo corrente.
    if (created.value.status === 'ACTIVE') {
      const period = await SdContractBillingService.ensureOpenPeriod(
        created.value,
        new Date(),
      )
      if (!period.ok) {
        logger.warn('servicedesk.contract.period_open_failed', {
          workspaceId,
          contractId: created.value.id,
          code: period.error.code,
        })
      }
    }

    audit('create', actorId, workspaceId, created.value.id, {
      customerId: dto.customerId,
      status: dto.status,
      rates: dto.rates.length,
    })
    logger.info('servicedesk.contract.created', {
      workspaceId,
      contractId: created.value.id,
      billingCycle: dto.billingCycle,
    })
    const reloaded = await SdContractRepository.findById(
      created.value.id,
      workspaceId,
    )
    if (!reloaded.ok) return reloaded
    return ok(toSdContractDTO(reloaded.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    contractId: string,
    dto: UpdateSdContractDTO,
  ): Promise<Result<SdContractDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const existing = await SdContractRepository.findById(
      contractId,
      workspaceId,
    )
    if (!existing.ok) return existing
    const current = existing.value

    const refs = await assertRefs(workspaceId, dto)
    if (!refs.ok) return refs

    const next = {
      status: dto.status ?? current.status,
      customerId: dto.customerId ?? current.customerId,
      startsAt: dto.startsAt ?? current.startsAt,
      endsAt: dto.endsAt === undefined ? current.endsAt : dto.endsAt,
    }
    if (next.endsAt && next.endsAt <= next.startsAt) {
      return err(validationError('O término deve ser depois do início'))
    }
    if (next.status === 'ACTIVE') {
      const overlap = await assertNoOverlap({
        workspaceId,
        customerId: next.customerId,
        startsAt: next.startsAt,
        endsAt: next.endsAt,
        excludeId: contractId,
      })
      if (!overlap.ok) return overlap
    }

    const { rates, ...fields } = dto
    const updated = await SdContractRepository.update(
      contractId,
      {
        ...fields,
        ...(fields.code !== undefined ? { code: fields.code ?? null } : {}),
        ...(fields.endsAt !== undefined
          ? { endsAt: fields.endsAt ?? null }
          : {}),
        ...(fields.overtimeRate !== undefined
          ? { overtimeRate: fields.overtimeRate ?? null }
          : {}),
        ...(fields.slaPolicyId !== undefined
          ? { slaPolicyId: fields.slaPolicyId ?? null }
          : {}),
        ...(fields.notes !== undefined ? { notes: fields.notes ?? null } : {}),
      },
      rates ? toRateData(rates) : undefined,
    )
    if (!updated.ok) return updated

    audit('update', actorId, workspaceId, contractId, {
      fields: Object.keys(dto),
    })
    return ok(toSdContractDTO(updated.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    contractId: string,
  ): Promise<Result<void>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const existing = await SdContractRepository.findById(
      contractId,
      workspaceId,
    )
    if (!existing.ok) return existing
    const removed = await SdContractRepository.softDelete(contractId)
    if (!removed.ok) return removed
    audit('delete', actorId, workspaceId, contractId, {
      customerId: existing.value.customerId,
    })
    return ok(undefined)
  },

  async listPeriods(
    actorId: string,
    workspaceId: string,
    contractId: string,
  ): Promise<Result<SdContractPeriodDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contracts',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const contract = await SdContractRepository.findById(
      contractId,
      workspaceId,
    )
    if (!contract.ok) return contract
    const rows = await SdContractPeriodRepository.listByContract(contractId)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdContractPeriodDTO))
  },

  /**
   * Fechamento manual: consolida os apontamentos e congela o período
   * (`periodId` vazio = o período do ciclo corrente). Período já fechado
   * devolve `SD_CONTRACT_PERIOD_CLOSED`.
   */
  async closePeriod(
    actorId: string,
    workspaceId: string,
    contractId: string,
    dto: CloseSdContractPeriodDTO = {},
  ): Promise<Result<SdContractPeriodDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const contract = await SdContractRepository.findById(
      contractId,
      workspaceId,
    )
    if (!contract.ok) return contract

    const period = dto.periodId
      ? await SdContractPeriodRepository.findById(dto.periodId, contractId)
      : await SdContractBillingService.ensureOpenPeriod(
          contract.value,
          new Date(),
        )
    if (!period.ok) return period
    if (period.value.status === 'CLOSED') return err(sdContractPeriodClosed())

    const closed = await SdContractBillingService.consolidate(
      contract.value,
      period.value,
      { close: true, closedById: actorId },
    )
    if (!closed.ok) return closed

    auditMutation({
      entity: 'sd_contract_period',
      action: 'update',
      actorId,
      targetId: closed.value.id,
      meta: {
        workspaceId,
        contractId,
        amount: closed.value.amount.toFixed(2),
        overageMinutes: closed.value.overageMinutes,
      },
    })
    logger.info('servicedesk.contract.period_closed_manually', {
      workspaceId,
      contractId,
      periodId: closed.value.id,
    })
    return ok(toSdContractPeriodDTO(closed.value))
  },

  /**
   * Contrato vigente do cliente e o consumo do período corrente — bloco da
   * tela do cliente. Sem contrato ativo, devolve tudo nulo.
   */
  async summaryForCustomer(
    actorId: string,
    workspaceId: string,
    customerId: string,
  ): Promise<Result<SdContractSummaryDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-contracts',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx

    const rows = await SdContractRepository.list(workspaceId, {
      customerId,
      status: 'ACTIVE',
    })
    if (!rows.ok) return rows
    const contract = pickCurrent(rows.value, new Date())
    if (!contract) return ok(toSdContractSummaryDTO(null, null))

    const range = sdPeriodRange(contract.billingCycle, new Date())
    const period = await SdContractPeriodRepository.findByStart(
      contract.id,
      range.start,
    )
    if (!period.ok) return period
    return ok(toSdContractSummaryDTO(contract, period.value))
  },
}

/** Contrato ativo mais recente já vigente em `at` (a lista já vem ordenada). */
function pickCurrent(
  contracts: SdContractWithRelations[],
  at: Date,
): SdContractWithRelations | null {
  return contracts.find((contract) => sdContractCovers(contract, at)) ?? null
}
