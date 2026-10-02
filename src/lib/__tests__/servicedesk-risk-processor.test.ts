import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { recomputeMock, scanMock, loggerMock } = vi.hoisted(() => ({
  recomputeMock: vi.fn(),
  scanMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-risk.service', () => ({
  SdRiskService: { recomputeTick: recomputeMock, scanClusters: scanMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processServicedeskRisk } from '@/src/lib/queue/processors/servicedesk-risk'

function fakeJob(
  name: string,
  data: { workspaceId?: string } = {},
  id?: string,
): Job<{ workspaceId?: string }> {
  return { id, name, data } as unknown as Job<{ workspaceId?: string }>
}

describe('processServicedeskRisk', () => {
  it('recalcula o risco e registra o resultado', async () => {
    const value = {
      workspaces: 2,
      tickets: 30,
      high: 3,
      medium: 7,
      low: 20,
      notified: 2,
      removed: 1,
      errors: 0,
    }
    recomputeMock.mockResolvedValue({ ok: true, value })

    await expect(
      processServicedeskRisk(fakeJob('recompute-risk', {}, 'j1')),
    ).resolves.toBe(value)
    expect(recomputeMock).toHaveBeenCalledWith({ workspaceId: undefined })
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_risk.recompute_completed',
      expect.objectContaining({ jobId: 'j1', high: 3, notified: 2 }),
    )
  })

  it('repassa o workspace do job quando o tick é de um só', async () => {
    recomputeMock.mockResolvedValue({ ok: true, value: {} })

    await processServicedeskRisk(
      fakeJob('recompute-risk', { workspaceId: 'ws1' }),
    )

    expect(recomputeMock).toHaveBeenCalledWith({ workspaceId: 'ws1' })
  })

  it('agrupa os incidentes e registra o resultado', async () => {
    const value = {
      workspaces: 1,
      incidents: 12,
      clusters: 2,
      created: 1,
      reopened: 0,
      removed: 0,
      errors: 0,
    }
    scanMock.mockResolvedValue({ ok: true, value })

    await expect(
      processServicedeskRisk(fakeJob('scan-clusters', {}, 'j2')),
    ).resolves.toBe(value)
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_risk.clusters_completed',
      expect.objectContaining({ jobId: 'j2', created: 1 }),
    )
  })

  it('transforma o erro do service em falha do job (para o retry)', async () => {
    recomputeMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })
    scanMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })

    await expect(
      processServicedeskRisk(fakeJob('recompute-risk', {}, 'j3')),
    ).rejects.toThrow('servicedesk-risk recompute failed: DATABASE_ERROR boom')
    await expect(
      processServicedeskRisk(fakeJob('scan-clusters', {}, 'j4')),
    ).rejects.toThrow(
      'servicedesk-risk cluster scan failed: DATABASE_ERROR boom',
    )
  })

  it('recusa job desconhecido', async () => {
    await expect(processServicedeskRisk(fakeJob('outro-job'))).rejects.toThrow(
      'Unknown servicedesk-risk job: outro-job (id=unknown)',
    )
  })
})
