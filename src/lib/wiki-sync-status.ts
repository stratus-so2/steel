/** What the wiki page header shows about the collaboration connection. */
export type WikiSyncStatus = 'connecting' | 'synced' | 'offline'

/**
 * `isSynced`: Yjs finished its first sync. `connected`: the Hocuspocus socket
 * state (null before the first event). A dropped socket wins over a past sync.
 */
export function wikiSyncStatus(
  isSynced: boolean,
  connected: boolean | null,
): WikiSyncStatus {
  if (connected === false) return 'offline'
  return isSynced ? 'synced' : 'connecting'
}
