import { AxiomJSTransport, ConsoleTransport } from '@axiomhq/logging'
import type { Axiom } from '@axiomhq/js'
import { describe, expect, it } from 'vitest'
import {
  buildLogTransports,
  isAxiomIngestConfigured,
} from '@/lib/axiom/transports'

const axiom = {} as Axiom

describe('isAxiomIngestConfigured()', () => {
  it('needs both the token and the dataset', () => {
    expect(isAxiomIngestConfigured('xaat-1', 'steel-app')).toBe(true)
    expect(isAxiomIngestConfigured(undefined, 'steel-app')).toBe(false)
    expect(isAxiomIngestConfigured('xaat-1', undefined)).toBe(false)
    expect(isAxiomIngestConfigured('', '')).toBe(false)
  })
})

describe('buildLogTransports()', () => {
  it('ships to Axiom only when configured', () => {
    const transports = buildLogTransports({
      axiom,
      token: 'xaat-1',
      dataset: 'steel-app',
      console: false,
    })
    expect(transports).toHaveLength(1)
    expect(transports[0]).toBeInstanceOf(AxiomJSTransport)
  })

  it('adds the console on top of Axiom when asked', () => {
    const transports = buildLogTransports({
      axiom,
      token: 'xaat-1',
      dataset: 'steel-app',
      console: true,
    })
    expect(transports.map((t) => t.constructor)).toEqual([
      AxiomJSTransport,
      ConsoleTransport,
    ])
  })

  it('falls back to the console when Axiom is not configured', () => {
    const transports = buildLogTransports({ axiom, console: false })
    expect(transports).toHaveLength(1)
    expect(transports[0]).toBeInstanceOf(ConsoleTransport)
  })
})
