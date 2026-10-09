import { describe, expect, it } from 'vitest'
import { wikiSyncStatus } from '@/src/lib/wiki-sync-status'

describe('wikiSyncStatus', () => {
  it('is connecting until the first sync', () => {
    expect(wikiSyncStatus(false, null)).toBe('connecting')
    expect(wikiSyncStatus(false, true)).toBe('connecting')
  })

  it('is synced once Yjs synced and the socket is up', () => {
    expect(wikiSyncStatus(true, true)).toBe('synced')
    expect(wikiSyncStatus(true, null)).toBe('synced')
  })

  it('is offline whenever the socket dropped', () => {
    expect(wikiSyncStatus(true, false)).toBe('offline')
    expect(wikiSyncStatus(false, false)).toBe('offline')
  })
})
