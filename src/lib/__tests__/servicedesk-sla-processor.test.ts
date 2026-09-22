import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { runTickMock, loggerMock } = vi.hoisted(() => ({
  runTickMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-sla-monitor.service', () => ({
  SdSlaMonitorService: { runTick: runTickMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processServicedeskSla } from '@/src/lib/queue/processors/servicedesk-sla'

function fakeJob(name: string, id?: string): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processServicedeskSla', () => {
  it('runs the SLA tick and logs the result', async () => {
    const result = {
      workspaces: 1,
      tickets: 2,
      breached: 1,
      atRisk: 0,
      escalations: 0,
      autoClosed: 0,
      errors: 0,
    }
    runTickMock.mockResolvedValue(result)

    await expect(
      processServicedeskSla(fakeJob('run-tick', 'j1')),
    ).resolves.toBe(result)
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_sla.tick_completed',
      expect.objectContaining({ jobId: 'j1', tickets: 2 }),
    )
  })

  it('throws on unknown job names', async () => {
    await expect(processServicedeskSla(fakeJob('nope'))).rejects.toThrow(
      'Unknown servicedesk-sla job: nope (id=unknown)',
    )
    await expect(processServicedeskSla(fakeJob('nope', 'x'))).rejects.toThrow(
      '(id=x)',
    )
  })
})
