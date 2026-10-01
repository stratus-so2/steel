/**
 * Plantão (on-call) do ServiceDesk — parte pura: dado um instante, a escala
 * e as trocas, diz quem responde em cada camada. Só `Intl`, sem banco e sem
 * depender do fuso do servidor.
 *
 * Regras:
 * - O rodízio é determinístico. A âncora é `handoffTime` no dia civil de
 *   `rotationStart`, no fuso da escala; cada período (`DAILY` = 1 dia,
 *   `WEEKLY` = 7, `BIWEEKLY` = 14) é `[âncora + k·P, âncora + (k+1)·P)`,
 *   contado em **dias civis** (sobrevive ao horário de verão) e o
 *   participante da vez é `k mod n` na ordem do rodízio. `k` negativo
 *   (antes do início) também resolve, então a linha do tempo nunca quebra.
 * - Uma **troca** (`SdOnCallOverride`) vence o rodízio na janela dela. Troca
 *   da camada vence troca da escala inteira (`layerId = null`).
 * - Com calendário de expediente, a escala só vale **fora** dele: dentro do
 *   expediente quem atende é a fila normal (`applies = false`).
 * - Camada sem participante (ou com o participante removido) devolve
 *   `userId: null` — quem chama decide o que fazer (cair no líder, avisar o
 *   admin…), em vez de a lib inventar um responsável.
 */

import { businessMinutesBetween, SD_WEEKDAYS, type SdCalendar } from './sla'

export type SdOnCallRotationKind = 'DAILY' | 'WEEKLY' | 'BIWEEKLY'

export interface SdOnCallParticipantSpec {
  userId: string
  /** Ordem do rodízio (menor primeiro); empate desempata pelo `userId`. */
  position: number
}

export interface SdOnCallLayerSpec {
  id: string
  name: string
  /** 1 = primeira chamada, 2 = retaguarda… */
  level: number
  participants: SdOnCallParticipantSpec[]
}

export interface SdOnCallScheduleSpec {
  id: string
  name: string
  departmentId: string | null
  timezone: string
  rotation: SdOnCallRotationKind
  rotationStart: Date
  /** `HH:MM` no fuso da escala. */
  handoffTime: string
  active: boolean
  /** Expediente em que a escala **não** vale; `null` = vale 24 h. */
  calendar: SdCalendar | null
  layers: SdOnCallLayerSpec[]
}

export interface SdOnCallOverrideSpec {
  id: string
  /** `null` = troca da escala inteira (todas as camadas). */
  layerId: string | null
  userId: string
  startsAt: Date
  endsAt: Date
  reason?: string | null
}

export type SdOnCallSource = 'rotation' | 'override' | 'none'

export interface SdOnCallSlot {
  layerId: string
  layerName: string
  level: number
  /** Quem responde; `null` quando a camada não tem participante. */
  userId: string | null
  source: SdOnCallSource
  overrideId: string | null
  /** Período do rodízio vigente (a troca não muda estas bordas). */
  periodStart: Date
  periodEnd: Date
}

export interface SdOnCallResolution {
  scheduleId: string
  scheduleName: string
  at: Date
  /** Fora do expediente do calendário (sempre `true` sem calendário). */
  offHours: boolean
  /** A escala está valendo agora (ativa **e** fora do expediente). */
  applies: boolean
  layers: SdOnCallSlot[]
}

export interface SdOnCallSegment {
  start: Date
  end: Date
  userId: string | null
  source: SdOnCallSource
  overrideId: string | null
}

export interface SdOnCallLayerTimeline {
  layerId: string
  layerName: string
  level: number
  segments: SdOnCallSegment[]
}

const MINUTE_MS = 60_000
const DAY_MS = 24 * 60 * MINUTE_MS

const PERIOD_DAYS: Record<SdOnCallRotationKind, number> = {
  DAILY: 1,
  WEEKLY: 7,
  BIWEEKLY: 14,
}

/** Dias civis de cada período do rodízio. */
export function sdOnCallPeriodDays(rotation: SdOnCallRotationKind): number {
  return PERIOD_DAYS[rotation] ?? 7
}

/** `"09:00"` → 540 minutos. Valor inválido cai na meia-noite (0). */
export function parseSdHandoffMinutes(
  value: string | null | undefined,
): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? '')
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

/* ------------------------------------------------------------------ */
/* Fuso horário (mesma abordagem do relógio de SLA)                     */
/* ------------------------------------------------------------------ */

const formatters = new Map<string, Intl.DateTimeFormat>()

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone)
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    formatters.set(timeZone, fmt)
  }
  return fmt
}

/** Fuso aceito pelo runtime (senão cai em UTC, para nunca lançar). */
function safeTimeZone(timeZone: string): string {
  try {
    formatterFor(timeZone)
    return timeZone
  } catch {
    return 'UTC'
  }
}

interface LocalParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function localParts(ms: number, timeZone: string): LocalParts {
  const parts: Record<string, number> = {}
  for (const part of formatterFor(timeZone).formatToParts(new Date(ms))) {
    if (part.type !== 'literal') parts[part.type] = Number(part.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

/** Deslocamento do fuso (ms) no instante `ms`: local − UTC. */
function offsetAt(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** Meia-noite UTC do dia civil local em que `ms` cai (marcador do dia). */
function localDayMarker(ms: number, timeZone: string): number {
  const p = localParts(ms, timeZone)
  return Date.UTC(p.year, p.month - 1, p.day)
}

/** Instante UTC de `minutes` minutos após a meia-noite local do dia `day`. */
function localToUtc(day: number, minutes: number, timeZone: string): number {
  const guess = day + minutes * MINUTE_MS
  const first = guess - offsetAt(guess, timeZone)
  return guess - offsetAt(first, timeZone)
}

/* ------------------------------------------------------------------ */
/* Expediente                                                           */
/* ------------------------------------------------------------------ */

function hasBusinessWindows(calendar: SdCalendar): boolean {
  return SD_WEEKDAYS.some((day) => (calendar.schedule[day]?.length ?? 0) > 0)
}

/**
 * `true` quando `at` cai dentro do expediente do calendário. Um calendário
 * 24×7 é expediente o tempo todo (a escala nunca vale); um calendário sem
 * nenhuma janela não tem expediente (a escala vale sempre).
 */
export function isWithinSdBusinessHours(
  at: Date,
  calendar: SdCalendar,
): boolean {
  if (calendar.is24x7) return true
  if (!hasBusinessWindows(calendar)) return false
  // O relógio de SLA conta minutos úteis: um minuto cheio a partir de `at`
  // só rende 1 se `at` estiver dentro de uma janela de expediente.
  return (
    businessMinutesBetween(at, new Date(at.getTime() + MINUTE_MS), calendar) > 0
  )
}

/* ------------------------------------------------------------------ */
/* Rodízio                                                              */
/* ------------------------------------------------------------------ */

export interface SdOnCallPeriod {
  /** Índice do período desde a âncora (negativo antes do início). */
  index: number
  start: Date
  end: Date
}

/**
 * Período do rodízio que contém `at`. As bordas são a hora da virada no fuso
 * da escala, contadas em dias civis — a virada no meio do dia e o horário de
 * verão não deslocam o rodízio.
 */
export function sdOnCallPeriodAt(
  at: Date,
  schedule: Pick<
    SdOnCallScheduleSpec,
    'timezone' | 'rotation' | 'rotationStart' | 'handoffTime'
  >,
): SdOnCallPeriod {
  const timeZone = safeTimeZone(schedule.timezone)
  const minutes = parseSdHandoffMinutes(schedule.handoffTime)
  const period = sdOnCallPeriodDays(schedule.rotation)
  const anchorDay = localDayMarker(schedule.rotationStart.getTime(), timeZone)
  const startOf = (index: number) =>
    localToUtc(anchorDay + index * period * DAY_MS, minutes, timeZone)

  const target = at.getTime()
  const dayDiff = Math.floor(
    (localDayMarker(target, timeZone) - anchorDay) / DAY_MS,
  )
  let index = Math.floor(dayDiff / period)
  // A diferença em dias ignora a hora da virada, então sobra no máximo um
  // período para cada lado; o laço fecha em poucas voltas.
  for (let i = 0; i < 8 && startOf(index) > target; i++) index--
  for (let i = 0; i < 8 && startOf(index + 1) <= target; i++) index++

  return {
    index,
    start: new Date(startOf(index)),
    end: new Date(startOf(index + 1)),
  }
}

/** Participantes na ordem do rodízio (`position`, depois `userId`). */
export function sdOnCallRotationOrder(
  layer: Pick<SdOnCallLayerSpec, 'participants'>,
): string[] {
  return [...layer.participants]
    .sort((a, b) =>
      a.position === b.position
        ? a.userId.localeCompare(b.userId)
        : a.position - b.position,
    )
    .map((participant) => participant.userId)
}

/** Troca vigente em `at` para a camada (a da camada vence a da escala). */
function activeOverride(
  at: Date,
  layerId: string,
  overrides: SdOnCallOverrideSpec[],
): SdOnCallOverrideSpec | null {
  const target = at.getTime()
  let best: SdOnCallOverrideSpec | null = null
  for (const override of overrides) {
    if (override.layerId !== null && override.layerId !== layerId) continue
    if (override.startsAt.getTime() > target) continue
    if (override.endsAt.getTime() <= target) continue
    if (
      best === null ||
      (best.layerId === null && override.layerId !== null) ||
      (best.layerId === override.layerId &&
        override.startsAt.getTime() > best.startsAt.getTime())
    ) {
      best = override
    }
  }
  return best
}

/**
 * Quem responde em cada camada no instante `at`. `applies` diz se a escala
 * está valendo (ativa e fora do expediente); as camadas vêm sempre, porque a
 * tela de configuração e a linha do tempo mostram o rodízio de qualquer jeito.
 */
export function resolveSdOnCall(
  at: Date,
  schedule: SdOnCallScheduleSpec,
  overrides: SdOnCallOverrideSpec[] = [],
): SdOnCallResolution {
  const period = sdOnCallPeriodAt(at, schedule)
  const offHours = schedule.calendar
    ? !isWithinSdBusinessHours(at, schedule.calendar)
    : true

  const layers = [...schedule.layers]
    .sort((a, b) => a.level - b.level)
    .map<SdOnCallSlot>((layer) => {
      const override = activeOverride(at, layer.id, overrides)
      const order = sdOnCallRotationOrder(layer)
      const rotationUserId =
        order.length === 0
          ? null
          : order[((period.index % order.length) + order.length) % order.length]
      const userId = override ? override.userId : rotationUserId
      return {
        layerId: layer.id,
        layerName: layer.name,
        level: layer.level,
        userId,
        source: override ? 'override' : rotationUserId ? 'rotation' : 'none',
        overrideId: override?.id ?? null,
        periodStart: period.start,
        periodEnd: period.end,
      }
    })

  return {
    scheduleId: schedule.id,
    scheduleName: schedule.name,
    at,
    offHours,
    applies: schedule.active && offHours,
    layers,
  }
}

/** Responsável de uma camada (por `level`) no instante `at`. */
export function sdOnCallUserAt(
  at: Date,
  schedule: SdOnCallScheduleSpec,
  overrides: SdOnCallOverrideSpec[],
  level: number,
): SdOnCallSlot | null {
  const resolution = resolveSdOnCall(at, schedule, overrides)
  return resolution.layers.find((slot) => slot.level === level) ?? null
}

/**
 * Linha do tempo por camada entre `from` e `to`: as bordas são as viradas do
 * rodízio e os limites das trocas, e trechos seguidos do mesmo responsável se
 * juntam num só.
 */
export function sdOnCallTimeline(
  schedule: SdOnCallScheduleSpec,
  overrides: SdOnCallOverrideSpec[],
  from: Date,
  to: Date,
): SdOnCallLayerTimeline[] {
  const start = from.getTime()
  const end = to.getTime()
  const sorted = [...schedule.layers].sort((a, b) => a.level - b.level)
  if (end <= start) {
    return sorted.map((layer) => ({
      layerId: layer.id,
      layerName: layer.name,
      level: layer.level,
      segments: [],
    }))
  }

  const bounds = new Set<number>([start])
  let cursor = sdOnCallPeriodAt(from, schedule).end.getTime()
  // Uma borda por virada do rodízio; `MAX` protege de um período degenerado.
  for (let i = 0; i < 400 && cursor < end; i++) {
    bounds.add(cursor)
    const next = sdOnCallPeriodAt(new Date(cursor), schedule).end.getTime()
    if (next <= cursor) break
    cursor = next
  }
  for (const override of overrides) {
    for (const edge of [
      override.startsAt.getTime(),
      override.endsAt.getTime(),
    ]) {
      if (edge > start && edge < end) bounds.add(edge)
    }
  }
  const points = [...bounds].sort((a, b) => a - b)

  return sorted.map((layer) => {
    const segments: SdOnCallSegment[] = []
    for (const [index, point] of points.entries()) {
      const slot = sdOnCallUserAt(
        new Date(point),
        schedule,
        overrides,
        layer.level,
      )
      if (!slot) continue
      const previous = segments[segments.length - 1]
      const stop = index + 1 < points.length ? points[index + 1] : end
      if (
        previous &&
        previous.userId === slot.userId &&
        previous.source === slot.source &&
        previous.overrideId === slot.overrideId
      ) {
        previous.end = new Date(stop)
        continue
      }
      segments.push({
        start: new Date(point),
        end: new Date(stop),
        userId: slot.userId,
        source: slot.source,
        overrideId: slot.overrideId,
      })
    }
    return {
      layerId: layer.id,
      layerName: layer.name,
      level: layer.level,
      segments,
    }
  })
}

/** Janela mínima de uma troca, para a checagem de sobreposição. */
export interface SdOnCallOverrideWindow {
  layerId?: string | null
  startsAt: Date
  endsAt: Date
}

/** Duas trocas brigam pela mesma camada na mesma janela? */
export function sdOnCallOverridesOverlap(
  a: SdOnCallOverrideWindow,
  b: SdOnCallOverrideWindow,
): boolean {
  const left = a.layerId ?? null
  const right = b.layerId ?? null
  const sameScope = left === null || right === null || left === right
  if (!sameScope) return false
  return (
    a.startsAt.getTime() < b.endsAt.getTime() &&
    b.startsAt.getTime() < a.endsAt.getTime()
  )
}
