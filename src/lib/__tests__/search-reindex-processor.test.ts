import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/search-index.service')
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { SearchIndexService } from '@/src/services/search-index.service'
import { processSearchReindex } from '../queue/processors/search-reindex'

const service = vi.mocked(SearchIndexService)

function job(name: string, data: unknown = {}): Job {
  return { id: 'j1', name, data } as unknown as Job
}

describe('processSearchReindex', () => {
  it('should rebuild every workspace on reindex-all', async () => {
    const stats = { workspaces: 2, failed: 0, indexed: 10, removed: 1 }
    service.reindexAll.mockResolvedValue(ok(stats))

    await expect(processSearchReindex(job('reindex-all'))).resolves.toEqual(
      stats,
    )
  })

  it('should throw on reindex-all failure so BullMQ retries', async () => {
    service.reindexAll.mockResolvedValue(err(databaseError('down')))
    await expect(processSearchReindex(job('reindex-all'))).rejects.toThrow(
      'DATABASE_ERROR',
    )
  })

  it('should rebuild one workspace on reindex-workspace', async () => {
    service.reindexWorkspace.mockResolvedValue(ok({ indexed: 3, removed: 0 }))

    await expect(
      processSearchReindex(job('reindex-workspace', { workspaceId: 'ws1' })),
    ).resolves.toEqual({ indexed: 3, removed: 0 })
    expect(service.reindexWorkspace).toHaveBeenCalledWith('ws1')
  })

  it('should throw when a workspace reindex fails', async () => {
    service.reindexWorkspace.mockResolvedValue(err(databaseError('down')))
    await expect(
      processSearchReindex(job('reindex-workspace', { workspaceId: 'ws1' })),
    ).rejects.toThrow('ws1')
  })

  it('should reject unknown job names', async () => {
    await expect(processSearchReindex(job('nope'))).rejects.toThrow(
      'Unknown search-reindex job: nope (id=j1)',
    )
    await expect(
      processSearchReindex({ name: 'nope', data: {} } as unknown as Job),
    ).rejects.toThrow('(id=unknown)')
  })
})
