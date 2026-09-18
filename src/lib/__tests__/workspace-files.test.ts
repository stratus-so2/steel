import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  listObjectKeys: vi.fn(),
  deleteObjects: vi.fn(),
}))
vi.mock('@/src/lib/storage/s3', () => mocks)

import {
  purgeWorkspaceFiles,
  WORKSPACE_PREFIXED_BUCKETS,
} from '@/src/lib/storage/workspace-files'

describe('purgeWorkspaceFiles()', () => {
  it('deletes every object under the workspace prefix plus AI attachments', async () => {
    mocks.listObjectKeys.mockImplementation(async (bucket: string) =>
      bucket === 'whatsapp-media' ? ['ws1/a.jpg', 'ws1/b.ogg'] : [],
    )
    mocks.deleteObjects.mockImplementation(
      async (_bucket: string, keys: string[]) => keys.length,
    )

    const result = await purgeWorkspaceFiles('ws1', ['conv1/x.pdf'])

    for (const bucket of WORKSPACE_PREFIXED_BUCKETS) {
      expect(mocks.listObjectKeys).toHaveBeenCalledWith(bucket, 'ws1/')
    }
    expect(mocks.deleteObjects).toHaveBeenCalledWith('whatsapp-media', [
      'ws1/a.jpg',
      'ws1/b.ogg',
    ])
    expect(mocks.deleteObjects).toHaveBeenCalledWith('crm-ai-attachments', [
      'conv1/x.pdf',
    ])
    expect(result.deleted).toBe(3)
    expect(result.byBucket['whatsapp-media']).toBe(2)
  })

  it('never lists with an empty prefix (would match other workspaces)', async () => {
    mocks.listObjectKeys.mockResolvedValue([])
    await purgeWorkspaceFiles('ws1', [])
    for (const [, prefix] of mocks.listObjectKeys.mock.calls) {
      expect(prefix).toBe('ws1/')
    }
  })
})
