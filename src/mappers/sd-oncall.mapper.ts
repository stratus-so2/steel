import type {
  SdOnCallLayerTimeline,
  SdOnCallOverrideSpec,
  SdOnCallResolution,
  SdOnCallScheduleSpec,
} from '@/src/lib/servicedesk/oncall'
import { parseSdCalendar } from '@/src/lib/servicedesk/sla'
import type {
  SdOnCallOverrideWithRelations,
  SdOnCallScheduleWithRelations,
} from '@/src/repositories/sd-oncall.repository'
import type {
  SdOnCallLayerTimelineDTO,
  SdOnCallNowDTO,
  SdOnCallOverrideDTO,
  SdOnCallScheduleDTO,
  SdOnCallSlotDTO,
  SdOnCallTimelineDTO,
  SdOnCallUserDTO,
} from '@/types/sd-oncall'

/**
 * Prisma → DTO do plantão, e também Prisma → o recorte puro que
 * `src/lib/servicedesk/oncall.ts` consome (`toSdOnCallSpec`), de modo que o
 * rodízio não conheça o banco.
 */

function toUserDTO(user: {
  id: string
  name: string
  email: string
  image: string | null
}): SdOnCallUserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  }
}

export function toSdOnCallScheduleDTO(
  schedule: SdOnCallScheduleWithRelations,
): SdOnCallScheduleDTO {
  return {
    id: schedule.id,
    name: schedule.name,
    department: schedule.department
      ? { id: schedule.department.id, name: schedule.department.name }
      : null,
    timezone: schedule.timezone,
    rotation: schedule.rotation,
    rotationStart: schedule.rotationStart.toISOString(),
    handoffTime: schedule.handoffTime,
    calendar: schedule.calendar
      ? { id: schedule.calendar.id, name: schedule.calendar.name }
      : null,
    active: schedule.active,
    layers: schedule.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      level: layer.level,
      participants: layer.participants.map((participant) => ({
        id: participant.id,
        position: participant.position,
        user: toUserDTO(participant.user),
      })),
    })),
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString(),
  }
}

export function toSdOnCallOverrideDTO(
  override: SdOnCallOverrideWithRelations,
): SdOnCallOverrideDTO {
  return {
    id: override.id,
    scheduleId: override.scheduleId,
    scheduleName: override.schedule.name,
    layerId: override.layerId,
    user: toUserDTO(override.user),
    startsAt: override.startsAt.toISOString(),
    endsAt: override.endsAt.toISOString(),
    reason: override.reason,
    createdAt: override.createdAt.toISOString(),
  }
}

/** Escala do banco → entrada da lib pura (calendário já normalizado). */
export function toSdOnCallSpec(
  schedule: SdOnCallScheduleWithRelations,
): SdOnCallScheduleSpec {
  return {
    id: schedule.id,
    name: schedule.name,
    departmentId: schedule.departmentId,
    timezone: schedule.timezone,
    rotation: schedule.rotation,
    rotationStart: schedule.rotationStart,
    handoffTime: schedule.handoffTime,
    active: schedule.active,
    calendar: schedule.calendar ? parseSdCalendar(schedule.calendar) : null,
    layers: schedule.layers.map((layer) => ({
      id: layer.id,
      name: layer.name,
      level: layer.level,
      participants: layer.participants.map((participant) => ({
        userId: participant.userId,
        position: participant.position,
      })),
    })),
  }
}

/** Trocas do banco → entrada da lib pura. */
export function toSdOnCallOverrideSpecs(
  overrides: {
    id: string
    layerId: string | null
    userId: string
    startsAt: Date
    endsAt: Date
    reason: string | null
  }[],
): SdOnCallOverrideSpec[] {
  return overrides.map((override) => ({
    id: override.id,
    layerId: override.layerId,
    userId: override.userId,
    startsAt: override.startsAt,
    endsAt: override.endsAt,
    reason: override.reason,
  }))
}

/** Índice `userId → usuário` montado com os participantes e as trocas. */
function userIndex(
  schedule: SdOnCallScheduleWithRelations,
  overrides: SdOnCallOverrideWithRelations[],
): Map<string, SdOnCallUserDTO> {
  const index = new Map<string, SdOnCallUserDTO>()
  for (const layer of schedule.layers) {
    for (const participant of layer.participants) {
      index.set(participant.userId, toUserDTO(participant.user))
    }
  }
  for (const override of overrides) {
    index.set(override.userId, toUserDTO(override.user))
  }
  return index
}

export function toSdOnCallNowDTO(
  schedule: SdOnCallScheduleWithRelations,
  resolution: SdOnCallResolution,
  overrides: SdOnCallOverrideWithRelations[] = [],
): SdOnCallNowDTO {
  const users = userIndex(schedule, overrides)
  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    department: schedule.department
      ? { id: schedule.department.id, name: schedule.department.name }
      : null,
    timezone: schedule.timezone,
    at: resolution.at.toISOString(),
    offHours: resolution.offHours,
    applies: resolution.applies,
    layers: resolution.layers.map<SdOnCallSlotDTO>((slot) => ({
      layerId: slot.layerId,
      layerName: slot.layerName,
      level: slot.level,
      userId: slot.userId,
      user: slot.userId ? (users.get(slot.userId) ?? null) : null,
      source: slot.source,
      overrideId: slot.overrideId,
      periodStart: slot.periodStart.toISOString(),
      periodEnd: slot.periodEnd.toISOString(),
    })),
  }
}

export function toSdOnCallTimelineDTO(
  schedule: SdOnCallScheduleWithRelations,
  timeline: SdOnCallLayerTimeline[],
  range: { from: Date; to: Date },
  overrides: SdOnCallOverrideWithRelations[] = [],
): SdOnCallTimelineDTO {
  const users = userIndex(schedule, overrides)
  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    timezone: schedule.timezone,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    layers: timeline.map<SdOnCallLayerTimelineDTO>((layer) => ({
      layerId: layer.layerId,
      layerName: layer.layerName,
      level: layer.level,
      segments: layer.segments.map((segment) => ({
        start: segment.start.toISOString(),
        end: segment.end.toISOString(),
        userId: segment.userId,
        user: segment.userId ? (users.get(segment.userId) ?? null) : null,
        source: segment.source,
        overrideId: segment.overrideId,
      })),
    })),
  }
}
