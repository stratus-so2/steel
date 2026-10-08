'use client'

import { useCallback } from 'react'
import {
  isQuickSend,
  type QuickSendMode,
  quickSendHint,
} from '@/src/lib/shortcuts/quick-send'
import { useIsMac, useShortcuts } from './shortcuts-provider'

/**
 * The user's "Envio rápido" preference for a composer: `isSend(event)` on
 * keydown and the footer `hint`. The workspace shell loads it; outside it
 * (and until it loads) Enter sends.
 */
export function useQuickSend() {
  const ctx = useShortcuts()
  const isMac = useIsMac()
  const mode: QuickSendMode = ctx?.quickSendMode ?? 'ENTER'
  const isSend = useCallback(
    (event: Parameters<typeof isQuickSend>[0]) => isQuickSend(event, mode),
    [mode],
  )
  return { mode, isSend, hint: quickSendHint(mode, isMac) }
}
