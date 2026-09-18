import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { collectMock, loggerMock, envMock } = vi.hoisted(() => ({
  collectMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  envMock: {
    BETTER_AUTH_URL: 'https://steel.example.com',
    STATUS_APP_PROBE_URL: undefined as string | undefined,
  },
}))

vi.mock('@/src/services/status/status.service', () => ({
  StatusService: { collect: collectMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))
vi.mock('@/lib/env/server', () => envMock)

import { processStatusCollect } from '@/src/lib/queue/processors/status-collect'

function fakeJob(name: string, id = 'job-1'): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processStatusCollect', () => {
  it('collects the core tier for collect-core', async () => {
    collectMock.mockResolvedValue({ ok: true, value: undefined })

    const result = await processStatusCollect(fakeJob('collect-core'))

    expect(result.tier).toBe('core')
    expect(collectMock).toHaveBeenCalledWith('core', {
      appUrl: 'https://steel.example.com',
    })
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.status_collect.completed',
      expect.objectContaining({ tier: 'core' }),
    )
  })

  it('collects the peripheral tier for collect-peripheral', async () => {
    collectMock.mockResolvedValue({ ok: true, value: undefined })

    const result = await processStatusCollect(fakeJob('collect-peripheral'))

    expect(result.tier).toBe('peripheral')
    expect(collectMock).toHaveBeenCalledWith('peripheral', expect.any(Object))
  })

  it('prefers STATUS_APP_PROBE_URL over BETTER_AUTH_URL for the app probe', async () => {
    envMock.STATUS_APP_PROBE_URL = 'http://nextjs-app:3000'
    collectMock.mockResolvedValue({ ok: true, value: undefined })

    try {
      await processStatusCollect(fakeJob('collect-core'))
      expect(collectMock).toHaveBeenCalledWith('core', {
        appUrl: 'http://nextjs-app:3000',
      })
    } finally {
      envMock.STATUS_APP_PROBE_URL = undefined
    }
  })

  it('throws and logs when the service returns an error', async () => {
    collectMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'db down' },
    })

    await expect(processStatusCollect(fakeJob('collect-core'))).rejects.toThrow(
      /Status collect \(core\) failed: db down/,
    )
    expect(loggerMock.error).toHaveBeenCalledWith(
      'queue.status_collect.failed',
      expect.objectContaining({ tier: 'core', errorCode: 'DATABASE_ERROR' }),
    )
  })

  it('throws on unknown job name without collecting', async () => {
    await expect(processStatusCollect(fakeJob('nope'))).rejects.toThrow(
      /Unknown status-collect job/,
    )
    expect(collectMock).not.toHaveBeenCalled()
  })
})
