import { logger } from '@/lib/axiom/logger'
import { sdChangeConflict, sdChangeFrozen } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  sdPeriodsOverlap,
  sdWindowApplies,
} from '@/src/lib/servicedesk/change-calendar'
import {
  sdExpandWindows,
  toSdChangeOccurrenceDTO,
} from '@/src/mappers/sd-change-window.mapper'
import { SdChangeScheduleRepository } from '@/src/repositories/sd-change-schedule.repository'
import { SdChangeWindowRepository } from '@/src/repositories/sd-change-window.repository'
import type {
  SdChangeWarningDTO,
  SdChangeWindowOccurrenceDTO,
  SdTicketChangeScheduleDTO,
} from '@/types/sd-change'

/**
 * Agenda da mudança: congelamento e conflito de janela.
 *
 * Isto é **aviso, não bloqueio absoluto**. Ao agendar uma mudança (mexer em
 * `plannedStartAt`/`plannedEndAt`) o motor pergunta aqui se o período cai
 * dentro de uma janela `FREEZE` (`SD_CHANGE_FROZEN`) ou se já existe outra
 * mudança ativa com janela sobreposta no mesmo item de configuração
 * (`SD_CHANGE_CONFLICT`). Sem confirmação explícita, a atualização é recusada
 * com esse código; um **admin** do ServiceDesk pode confirmar e seguir, e o
 * que foi ignorado vira evento de rastreabilidade (`change.schedule_forced`).
 *
 * Só mudanças (`type: 'CHANGE'`) com as duas pontas da janela preenchidas são
 * analisadas — sem janela planejada não há o que conferir.
 */

export interface SdChangeTarget {
  workspaceId: string
  ticketId: string
  type: string
  configItemId: string | null
  departmentId: string | null
  plannedStartAt: Date | null
  plannedEndAt: Date | null
}

export interface SdChangeScheduleCheck {
  warnings: SdChangeWarningDTO[]
  /** Janelas (manutenção e congelamento) que cobrem o período planejado. */
  windows: SdChangeWindowOccurrenceDTO[]
}

const EMPTY: SdChangeScheduleCheck = { warnings: [], windows: [] }

const WHEN = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  dateStyle: 'short',
  timeStyle: 'short',
})

/** `true` quando dá para analisar a agenda deste chamado. */
export function sdHasPlannedWindow(
  target: Pick<SdChangeTarget, 'type' | 'plannedStartAt' | 'plannedEndAt'>,
): boolean {
  return (
    target.type === 'CHANGE' &&
    target.plannedStartAt !== null &&
    target.plannedEndAt !== null &&
    target.plannedEndAt.getTime() > target.plannedStartAt.getTime()
  )
}

/**
 * Confere a agenda da mudança e devolve os avisos — nunca um erro de negócio:
 * quem chama decide se recusa (`sdAssertChangeSchedule`) ou só exibe.
 */
export async function checkSdChangeSchedule(
  target: SdChangeTarget,
): Promise<Result<SdChangeScheduleCheck>> {
  if (!sdHasPlannedWindow(target)) return ok(EMPTY)
  const startsAt = target.plannedStartAt as Date
  const endsAt = target.plannedEndAt as Date

  const [windows, rivals] = await Promise.all([
    SdChangeWindowRepository.listForRange(target.workspaceId, {
      from: startsAt,
      to: endsAt,
    }),
    SdChangeScheduleRepository.findConflicts({
      workspaceId: target.workspaceId,
      ticketId: target.ticketId,
      configItemId: target.configItemId,
      startsAt,
      endsAt,
    }),
  ])
  if (!windows.ok) return windows
  if (!rivals.ok) return rivals

  const covering = sdExpandWindows(windows.value, {
    from: startsAt,
    to: endsAt,
  }).filter(
    (o) =>
      sdWindowApplies(o.window, target) &&
      sdPeriodsOverlap(o.startsAt, o.endsAt, startsAt, endsAt),
  )

  const warnings: SdChangeWarningDTO[] = []
  for (const o of covering) {
    if (o.window.kind !== 'FREEZE') continue
    warnings.push({
      kind: 'FREEZE',
      message: `A janela de congelamento "${o.window.name}" cobre este período (${WHEN.format(o.startsAt)} – ${WHEN.format(o.endsAt)})`,
      windowId: o.window.id,
      windowName: o.window.name,
      ticketId: null,
      ticketNumber: null,
      ticketTitle: null,
      startsAt: o.startsAt.toISOString(),
      endsAt: o.endsAt.toISOString(),
    })
  }
  for (const rival of rivals.value) {
    warnings.push({
      kind: 'CONFLICT',
      message: `A mudança #${rival.number} ("${rival.title}") já ocupa este item de configuração de ${WHEN.format(rival.plannedStartAt)} a ${WHEN.format(rival.plannedEndAt)}`,
      windowId: null,
      windowName: null,
      ticketId: rival.id,
      ticketNumber: rival.number,
      ticketTitle: rival.title,
      startsAt: rival.plannedStartAt.toISOString(),
      endsAt: rival.plannedEndAt.toISOString(),
    })
  }

  return ok({
    warnings,
    windows: covering.map((o) =>
      toSdChangeOccurrenceDTO(
        {
          windowId: o.window.id,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          recurring: o.recurring,
        },
        o.window,
      ),
    ),
  })
}

export interface SdChangeScheduleGuardOptions {
  /** O ator confirmou os avisos (só vale para admin do ServiceDesk). */
  confirm?: boolean
  /** O ator é admin do ServiceDesk. */
  isAdmin?: boolean
}

export interface SdChangeScheduleGuard {
  /** Avisos que o ator confirmou e seguem para a rastreabilidade. */
  forced: SdChangeWarningDTO[]
}

/**
 * Gancho do caminho de atualização do chamado: recusa o agendamento com
 * `SD_CHANGE_FROZEN`/`SD_CHANGE_CONFLICT` quando há aviso sem confirmação e
 * devolve os avisos aceitos quando um admin confirmou.
 *
 * O congelamento vem antes do conflito: é a recusa mais forte.
 */
export async function sdAssertChangeSchedule(
  target: SdChangeTarget,
  options: SdChangeScheduleGuardOptions = {},
): Promise<Result<SdChangeScheduleGuard>> {
  const checked = await checkSdChangeSchedule(target)
  if (!checked.ok) return checked
  const { warnings } = checked.value
  if (warnings.length === 0) return ok({ forced: [] })

  const confirmed = options.confirm === true && options.isAdmin === true
  if (!confirmed) {
    const freeze = warnings.find((w) => w.kind === 'FREEZE')
    const detail = options.isAdmin
      ? ' Confirme para agendar mesmo assim.'
      : ' Só um administrador do ServiceDesk pode agendar mesmo assim.'
    const base = freeze
      ? sdChangeFrozen(`${freeze.message}.${detail}`)
      : sdChangeConflict(`${warnings[0].message}.${detail}`)
    return err({ ...base, details: { warnings } })
  }

  logger.warn('servicedesk.change_schedule.forced', {
    workspaceId: target.workspaceId,
    ticketId: target.ticketId,
    warnings: warnings.length,
    kinds: [...new Set(warnings.map((w) => w.kind))].join(','),
  })
  return ok({ forced: warnings })
}

/** Bloco "agenda da mudança" da tela do chamado. */
export async function loadSdTicketChangeSchedule(
  target: SdChangeTarget,
): Promise<Result<SdTicketChangeScheduleDTO>> {
  const checked = await checkSdChangeSchedule(target)
  if (!checked.ok) return checked
  const name = target.configItemId
    ? await SdChangeScheduleRepository.findConfigItemName(target.configItemId)
    : null
  if (name && !name.ok) return name
  return ok({
    ticketId: target.ticketId,
    plannedStartAt: target.plannedStartAt?.toISOString() ?? null,
    plannedEndAt: target.plannedEndAt?.toISOString() ?? null,
    configItemId: target.configItemId,
    configItemName: name?.ok ? name.value : null,
    windows: checked.value.windows,
    warnings: checked.value.warnings,
  })
}
