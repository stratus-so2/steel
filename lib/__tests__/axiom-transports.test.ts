import { ConsoleTransport } from '@axiomhq/logging'
import type { Axiom } from '@axiomhq/js'
import { describe, expect, it, vi } from 'vitest'
import {
  buildLogTransports,
  isAxiomIngestConfigured,
  isRoutineNoise,
  NoiseFilterTransport,
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
    expect(transports[0]).toBeInstanceOf(NoiseFilterTransport)
  })

  it('adds the console on top of Axiom when asked', () => {
    const transports = buildLogTransports({
      axiom,
      token: 'xaat-1',
      dataset: 'steel-app',
      console: true,
    })
    expect(transports.map((t) => t.constructor)).toEqual([
      NoiseFilterTransport,
      ConsoleTransport,
    ])
  })

  it('falls back to the console when Axiom is not configured', () => {
    const transports = buildLogTransports({ axiom, console: false })
    expect(transports).toHaveLength(1)
    expect(transports[0]).toBeInstanceOf(ConsoleTransport)
  })
})

describe('isRoutineNoise()', () => {
  it('drops a tick that found nothing to do', () => {
    expect(
      isRoutineNoise({
        level: 'info',
        message: 'queue.crm_social_posts_tick.tick_completed',
        fields: { jobId: 'r1', considered: 0, dispatched: 0, durationMs: 40 },
      }),
    ).toBe(true)
  })

  it('keeps a tick that did work', () => {
    expect(
      isRoutineNoise({
        level: 'info',
        message: 'queue.crm_workflow_schedule.tick_completed',
        fields: { considered: 3, dispatched: 1 },
      }),
    ).toBe(false)
  })

  it('drops the routine status collection and keeps everything else', () => {
    expect(
      isRoutineNoise({ message: 'queue.status_collect.completed', fields: {} }),
    ).toBe(true)
    expect(isRoutineNoise({ message: 'audit.mutation.x.create' })).toBe(false)
    expect(
      isRoutineNoise({ level: 'info', message: 'a.tick_completed', fields: 'x' }),
    ).toBe(true)
  })

  it('never drops warnings or errors', () => {
    expect(
      isRoutineNoise({
        level: 'error',
        message: 'queue.status_collect.completed',
      }),
    ).toBe(false)
  })
})

describe('NoiseFilterTransport', () => {
  it('forwards only non-noise events and flushes the inner transport', async () => {
    const inner = { log: vi.fn(), flush: vi.fn() }
    const transport = new NoiseFilterTransport(inner)
    const kept = { level: 'info', message: 'audit.auth.session.created' }

    transport.log([
      { level: 'info', message: 'queue.status_collect.completed' },
      kept,
    ])
    transport.log([{ level: 'info', message: 'queue.status_collect.completed' }])
    await transport.flush()

    expect(inner.log).toHaveBeenCalledTimes(1)
    expect(inner.log).toHaveBeenCalledWith([kept])
    expect(inner.flush).toHaveBeenCalledTimes(1)
  })
})
