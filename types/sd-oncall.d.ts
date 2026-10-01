/**
 * DTOs do plantão (on-call) do ServiceDesk: escalas com camadas e
 * participantes, trocas pontuais, quem está de plantão agora e a linha do
 * tempo das próximas semanas.
 */

export type SdOnCallRotationDTO = 'DAILY' | 'WEEKLY' | 'BIWEEKLY'

/** De onde veio o responsável do período. */
export type SdOnCallSourceDTO = 'rotation' | 'override' | 'none'

export interface SdOnCallUserDTO {
  id: string
  name: string
  email: string
  image: string | null
}

export interface SdOnCallParticipantDTO {
  id: string
  position: number
  user: SdOnCallUserDTO
}

export interface SdOnCallLayerDTO {
  id: string
  name: string
  /** 1 = primeira chamada, 2 = retaguarda… */
  level: number
  participants: SdOnCallParticipantDTO[]
}

export interface SdOnCallScheduleDTO {
  id: string
  name: string
  department: { id: string; name: string } | null
  timezone: string
  rotation: SdOnCallRotationDTO
  rotationStart: string
  /** Hora da virada no fuso da escala (`HH:MM`). */
  handoffTime: string
  /** Expediente em que a escala **não** vale (`null` = vale 24 h). */
  calendar: { id: string; name: string } | null
  active: boolean
  layers: SdOnCallLayerDTO[]
  createdAt: string
  updatedAt: string
}

export interface SdOnCallOverrideDTO {
  id: string
  scheduleId: string
  scheduleName: string
  /** `null` = a troca cobre a escala inteira. */
  layerId: string | null
  user: SdOnCallUserDTO
  startsAt: string
  endsAt: string
  reason: string | null
  createdAt: string
}

/** Responsável de uma camada num instante. */
export interface SdOnCallSlotDTO {
  layerId: string
  layerName: string
  level: number
  userId: string | null
  user: SdOnCallUserDTO | null
  source: SdOnCallSourceDTO
  overrideId: string | null
  periodStart: string
  periodEnd: string
}

/** Quem está de plantão agora, numa escala. */
export interface SdOnCallNowDTO {
  scheduleId: string
  scheduleName: string
  department: { id: string; name: string } | null
  timezone: string
  at: string
  /** Fora do expediente do calendário (sempre `true` sem calendário). */
  offHours: boolean
  /** A escala está valendo neste instante (ativa **e** fora do expediente). */
  applies: boolean
  layers: SdOnCallSlotDTO[]
}

export interface SdOnCallSegmentDTO {
  start: string
  end: string
  userId: string | null
  user: SdOnCallUserDTO | null
  source: SdOnCallSourceDTO
  overrideId: string | null
}

export interface SdOnCallLayerTimelineDTO {
  layerId: string
  layerName: string
  level: number
  segments: SdOnCallSegmentDTO[]
}

/** Linha do tempo da escala: um bloco por camada, do período pedido. */
export interface SdOnCallTimelineDTO {
  scheduleId: string
  scheduleName: string
  timezone: string
  from: string
  to: string
  layers: SdOnCallLayerTimelineDTO[]
}
