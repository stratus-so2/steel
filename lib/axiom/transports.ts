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
      new AxiomJSTransport({ axiom: options.axiom, dataset: options.dataset }),
    )
  }
  if (options.console || transports.length === 0) {
    transports.push(new ConsoleTransport({ prettyPrint: true }))
  }
  return transports as [Transport, ...Transport[]]
}
