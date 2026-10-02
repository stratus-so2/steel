import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { runTickMock, loggerMock } = vi.hoisted(() => ({
  runTickMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-contract-billing.service', () => ({
  SdContractBillingService: { runTick: runTickMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processServicedeskBilling } from '@/src/lib/queue/processors/servicedesk-billing'

function fakeJob(name: string, id?: string): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processServicedeskBilling', () => {
  it('roda o tick de faturamento e registra o resultado', async () => {
    const value = { contracts: 3, opened: 2, closed: 1 }
    runTickMock.mockResolvedValue({ ok: true, value })

    await expect(
      processServicedeskBilling(fakeJob('run-tick', 'j1')),
    ).resolves.toBe(value)
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_billing.tick_completed',
      expect.objectContaining({ jobId: 'j1', contracts: 3, closed: 1 }),
    )
  })

  it('transforma o erro do service em falha do job (para o retry)', async () => {
    runTickMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })

    await expect(
      processServicedeskBilling(fakeJob('run-tick', 'j2')),
    ).rejects.toThrow('servicedesk-billing tick failed: DATABASE_ERROR boom')
  })

  it('recusa job desconhecido', async () => {
    await expect(
      processServicedeskBilling(fakeJob('outro-job')),
    ).rejects.toThrow('Unknown servicedesk-billing job: outro-job (id=unknown)')
  })
})
