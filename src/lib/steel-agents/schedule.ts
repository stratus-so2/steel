import { Cron } from 'croner'
import { STEEL_AGENT_EVENT_KEYS } from './events'

/**
 * Pure helpers for the agent trigger: cron/timezone validation and the next
 * occurrence. `croner` is the same engine the worker tick uses, so whatever
 * the editor accepts the scheduler can run.
 */

export const STEEL_AGENT_DEFAULT_TIMEZONE = 'America/Sao_Paulo'

export function isValidTimeZone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/** Five-field cron (minute precision); croner also takes 6 fields — refused. */
export function isValidCron(cron: string, timezone: string): boolean {
  if (cron.trim().split(/\s+/).length !== 5) return false
  try {
    new Cron(cron, { timezone, paused: true })
    return true
  } catch {
    return false
  }
}

/** Next occurrence after `now`, or null for an invalid expression. */
export function nextCronRun(
  cron: string,
  timezone: string,
  now: Date = new Date(),
): Date | null {
  if (!isValidCron(cron, timezone) || !isValidTimeZone(timezone)) return null
  return new Cron(cron, { timezone, paused: true }).nextRun(now)
}

/** Latest occurrence at or before `now`, or null. */
export function previousCronRun(
  cron: string,
  timezone: string,
  now: Date = new Date(),
): Date | null {
  if (!isValidCron(cron, timezone) || !isValidTimeZone(timezone)) return null
  const [previous] = new Cron(cron, { timezone, paused: true }).previousRuns(
    1,
    now,
  )
  return previous ?? null
}

export interface SteelAgentTriggerInput {
  triggerType: 'SCHEDULE' | 'EVENT' | 'MANUAL'
  cron?: string | null
  timezone?: string | null
  eventKey?: string | null
}

/** pt-BR problem with a trigger, or null when it is valid. */
export function steelAgentTriggerProblem(
  input: SteelAgentTriggerInput,
): string | null {
  if (input.triggerType === 'SCHEDULE') {
    const timezone = input.timezone ?? STEEL_AGENT_DEFAULT_TIMEZONE
    if (!isValidTimeZone(timezone)) return 'Fuso horário inválido'
    if (!input.cron || !isValidCron(input.cron, timezone)) {
      return 'Expressão cron inválida (use 5 campos: minuto hora dia mês dia-da-semana)'
    }
  }
  if (input.triggerType === 'EVENT') {
    if (
      !input.eventKey ||
      !(STEEL_AGENT_EVENT_KEYS as readonly string[]).includes(input.eventKey)
    ) {
      return 'Escolha um evento válido para o gatilho'
    }
  }
  return null
}

/** Columns derived from the trigger (irrelevant fields are cleared). */
export function normalizeSteelAgentTrigger(
  input: SteelAgentTriggerInput,
  now: Date = new Date(),
): {
  cron: string | null
  timezone: string
  eventKey: string | null
  nextRunAt: Date | null
} {
  const timezone = input.timezone ?? STEEL_AGENT_DEFAULT_TIMEZONE
  if (input.triggerType === 'SCHEDULE' && input.cron) {
    const cron = input.cron.trim().replace(/\s+/g, ' ')
    return {
      cron,
      timezone,
      eventKey: null,
      nextRunAt: nextCronRun(cron, timezone, now),
    }
  }
  return {
    cron: null,
    timezone,
    eventKey: input.triggerType === 'EVENT' ? (input.eventKey ?? null) : null,
    nextRunAt: null,
  }
}
