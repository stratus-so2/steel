import { ok, type Result } from '@/src/lib/result'
import {
  resolveSdOnCall,
  type SdOnCallResolution,
  type SdOnCallSlot,
} from '@/src/lib/servicedesk/oncall'
import {
  toSdOnCallOverrideSpecs,
  toSdOnCallSpec,
} from '@/src/mappers/sd-oncall.mapper'
import { SdOnCallRepository } from '@/src/repositories/sd-oncall.repository'

/**
 * Plantão **sem autorização**, para quem já resolveu o acesso: o motor de
 * escalonamento (`escalateSdTicket`) usa isto para achar quem responde no
 * momento. O CRUD e as consultas da UI ficam em `sd-oncall.service.ts`.
 */

export interface SdOnCallTarget {
  scheduleId: string
  scheduleName: string
  /** Camada consultada (`level`); `null` quando a escala não tem a camada. */
  slot: SdOnCallSlot | null
  resolution: SdOnCallResolution
}

/**
 * Escala ativa do departamento (ou a geral do workspace) resolvida em `at`.
 * `null` quando o departamento não tem plantão configurado.
 */
export async function resolveSdOnCallForDepartment(
  workspaceId: string,
  departmentId: string | null,
  at: Date,
): Promise<Result<SdOnCallResolution | null>> {
  const schedule = await SdOnCallRepository.findActiveForDepartment(
    workspaceId,
    departmentId,
  )
  if (!schedule.ok) return schedule
  if (!schedule.value) return ok(null)

  const overrides = await SdOnCallRepository.listOverridesInRange(
    schedule.value.id,
    at,
    new Date(at.getTime() + 1),
  )
  if (!overrides.ok) return overrides

  return ok(
    resolveSdOnCall(
      at,
      toSdOnCallSpec(schedule.value),
      toSdOnCallOverrideSpecs(overrides.value),
    ),
  )
}

/** Camada do `level` pedido; sem ela, a camada de maior nível disponível. */
export function sdOnCallSlotForLevel(
  resolution: SdOnCallResolution,
  level: number,
): SdOnCallSlot | null {
  const exact = resolution.layers.find((slot) => slot.level === level)
  if (exact) return exact
  const sorted = [...resolution.layers].sort((a, b) => a.level - b.level)
  const fallback = sorted.filter((slot) => slot.level < level).pop()
  return fallback ?? sorted[0] ?? null
}

/**
 * Quem o escalonamento deve chamar: o responsável da camada do nível pedido
 * e os das camadas acima (retaguarda), para entrar no aviso. Só devolve
 * alguém quando a escala está valendo (`applies`).
 */
export async function sdOnCallEscalationTarget(
  workspaceId: string,
  departmentId: string | null,
  at: Date,
  level: number,
): Promise<Result<SdOnCallTarget | null>> {
  const resolution = await resolveSdOnCallForDepartment(
    workspaceId,
    departmentId,
    at,
  )
  if (!resolution.ok) return resolution
  if (!resolution.value) return ok(null)
  if (!resolution.value.applies) return ok(null)

  return ok({
    scheduleId: resolution.value.scheduleId,
    scheduleName: resolution.value.scheduleName,
    slot: sdOnCallSlotForLevel(resolution.value, level),
    resolution: resolution.value,
  })
}
