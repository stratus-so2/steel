import {
  AxiomJSTransport,
  ConsoleTransport,
  type Transport,
} from '@axiomhq/logging'
import type { Axiom } from '@axiomhq/js'

export interface LogTransportOptions {
  axiom: Axiom
  token?: string
  dataset?: string
  /** Pretty console output on top of Axiom (dev, local runs). */
  console: boolean
}

/** Numeric keys that don't mean "the tick did work". */
const NON_WORK_KEYS = new Set(['durationMs', 'days', 'attemptsMade'])

/**
 * Routine worker chatter that never reaches Axiom (the console still shows
 * it): a cron tick that found nothing to do, and the per-minute status
 * collection whose result already lives in `HealthCheck`. A tick that did
 * work (any count above zero) or anything at warn/error level is kept.
 */
export function isRoutineNoise(event: {
  level?: string
  message?: string
  fields?: unknown
}): boolean {
  if (event.level && event.level !== 'info' && event.level !== 'debug') {
    return false
  }
  const message = event.message ?? ''
  if (message === 'queue.status_collect.completed') return true
  if (!message.endsWith('.tick_completed')) return false
  const fields =
    event.fields && typeof event.fields === 'object'
      ? (event.fields as Record<string, unknown>)
      : {}
  return !Object.entries(fields).some(
    ([key, value]) =>
      !NON_WORK_KEYS.has(key) && typeof value === 'number' && value > 0,
  )
}

/** Drops `isRoutineNoise` events before they reach the wrapped transport. */
export class NoiseFilterTransport implements Transport {
  constructor(private readonly inner: Transport) {}

  log(logs: { level?: string; message?: string; fields?: unknown }[]) {
    const kept = logs.filter((event) => !isRoutineNoise(event))
    if (kept.length > 0) return this.inner.log(kept)
  }

  flush() {
    return this.inner.flush()
  }
}

/** Axiom ingest runs only when both the token and the dataset are set. */
export function isAxiomIngestConfigured(
  token: string | undefined,
  dataset: string | undefined,
): dataset is string {
  return Boolean(token) && Boolean(dataset)
}

/**
 * Transports of a logger. Without an Axiom token/dataset (local runs, tests,
 * a deploy that left it out) nothing is shipped to Axiom and the logger
 * falls back to the console — `Logger` needs at least one transport.
 */
export function buildLogTransports(
  options: LogTransportOptions,
): [Transport, ...Transport[]] {
  const transports: Transport[] = []
  if (isAxiomIngestConfigured(options.token, options.dataset)) {
    transports.push(
      new NoiseFilterTransport(
        new AxiomJSTransport({
          axiom: options.axiom,
          dataset: options.dataset,
        }),
      ),
    )
  }
  if (options.console || transports.length === 0) {
    transports.push(new ConsoleTransport({ prettyPrint: true }))
  }
  return transports as [Transport, ...Transport[]]
}
