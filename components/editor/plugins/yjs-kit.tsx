'use client'

import { NEXT_PUBLIC_REALTIME_URL } from '@/lib/env/env'
import { YjsPlugin } from '@platejs/yjs/react'

/**
 * Hocuspocus endpoint: `NEXT_PUBLIC_REALTIME_URL` when set (dev runs the
 * server on its own port), otherwise `/realtime` on this origin, which nginx
 * proxies to the realtime container — so the session cookie goes along.
 */
function realtimeUrl(): string {
  if (NEXT_PUBLIC_REALTIME_URL) return NEXT_PUBLIC_REALTIME_URL
  // Server render: the provider only connects from `yjs.init` in an effect.
  if (typeof window === 'undefined') return ''
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/realtime`
}

export function createYjsKit({
  documentName,
  userName,
  userColor,
  onSyncChange,
}: {
  documentName: string
  userName: string
  userColor: string
  onSyncChange?: (isSynced: boolean) => void
  }) {
  return [
    YjsPlugin.configure({
      options: {
        cursors: { data: { name: userName, color: userColor } },
        providers: [
          {
            type: 'hocuspocus',
            options: { name: documentName, url: realtimeUrl() }
          }
        ],
        onConnect: ({ type }) => {
          console.log('[yjs] connected', type)
        },
        onDisconnect: ({ type }) => {
          console.log('[yjs] disconnected', type)
        },
        onError: ({ type, error }) => {
          console.error('[yjs] error', type, error)
        },
        onSyncChange: ({ type, isSynced }) => {
          console.log('[yjs] sync change', type, isSynced)
          if (isSynced) onSyncChange?.(isSynced)
        }
      }
    })
  ]
}
