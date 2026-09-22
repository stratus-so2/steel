import type { SdPhase, SdPhaseTransition } from '@prisma/client'
import { SD_TICKET_TYPES } from '@/src/schemas/sd-rule.schema'
import type {
  SdPhaseDTO,
  SdPhaseFlowDTO,
  SdPhaseTransitionDTO,
} from '@/types/sd-config'

export function toSdPhaseDTO(phase: SdPhase): SdPhaseDTO {
  return {
    id: phase.id,
    ticketType: phase.ticketType,
    name: phase.name,
    description: phase.description,
    color: phase.color,
    category: phase.category,
    completionPercent: phase.completionPercent,
    position: phase.position,
    isInitial: phase.isInitial,
    pausesSla: phase.pausesSla,
    requiresApproval: phase.requiresApproval,
    requiredFields: phase.requiredFields,
    wipLimit: phase.wipLimit,
    active: phase.active,
    createdAt: phase.createdAt.toISOString(),
    updatedAt: phase.updatedAt.toISOString(),
  }
}

export function toSdPhaseTransitionDTO(
  transition: SdPhaseTransition,
): SdPhaseTransitionDTO {
  return {
    id: transition.id,
    fromPhaseId: transition.fromPhaseId,
    toPhaseId: transition.toPhaseId,
    allowedDepartmentIds: transition.allowedDepartmentIds,
  }
}

/** Fases (ordenadas) + transições → um fluxo por tipo, na ordem ITIL. */
export function toSdPhaseFlows(
  phases: SdPhaseDTO[],
  transitions: SdPhaseTransitionDTO[],
): SdPhaseFlowDTO[] {
  return SD_TICKET_TYPES.map((ticketType) => {
    const own = phases.filter((p) => p.ticketType === ticketType)
    const ids = new Set(own.map((p) => p.id))
    return {
      ticketType,
      phases: own,
      transitions: transitions.filter((t) => ids.has(t.fromPhaseId)),
    }
  })
}
