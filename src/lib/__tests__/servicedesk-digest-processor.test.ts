import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { runTickMock, loggerMock } = vi.hoisted(() => ({
  runTickMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-digest.service', () => ({
  SdDigestService: { runTick: runTickMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processServicedeskDigest } from '@/src/lib/queue/processors/servicedesk-digest'

function fakeJob(name: string, id?: string): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processServicedeskDigest', () => {
  it('roda o tick do resumo e loga o desfecho', async () => {
    const result = {
      workspaces: 2,
      due: 1,
      sent: 3,
      inApp: 3,
      email: 1,
      skipped: 0,
      errors: 0,
    }
    runTickMock.mockResolvedValue(result)

    await expect(
      processServicedeskDigest(fakeJob('run-tick', 'j1')),
    ).resolves.toBe(result)
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_digest.tick_completed',
      expect.objectContaining({ jobId: 'j1', sent: 3 }),
    )
  })

  it('recusa um nome de job desconhecido', async () => {
    await expect(processServicedeskDigest(fakeJob('nope'))).rejects.toThrow(
      'Unknown servicedesk-digest job: nope (id=unknown)',
    )
    await expect(
      processServicedeskDigest(fakeJob('nope', 'x')),
    ).rejects.toThrow('(id=x)')
  })
})
