/**
 * "Envio rápido" (user preference `quickSendShortcut`): which key sends a
 * message in the composers (ServiceDesk, WhatsApp, Steel AI, home prompt).
 *
 * - `ENTER`: Enter sends, Shift+Enter breaks the line.
 * - `CTRL_ENTER`: Ctrl/⌘+Enter sends, Enter breaks the line.
 */
export type QuickSendMode = 'ENTER' | 'CTRL_ENTER'

type KeyLike = {
  key: string
  shiftKey: boolean
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  /** IME composition (accents, CJK): Enter confirms it, never sends. */
  isComposing?: boolean
  nativeEvent?: { isComposing?: boolean }
}

export function isQuickSend(
  event: KeyLike,
  mode: QuickSendMode = 'ENTER',
): boolean {
  if (event.key !== 'Enter') return false
  if (event.isComposing || event.nativeEvent?.isComposing) return false
  if (event.altKey) return false
  const mod = event.ctrlKey || event.metaKey
  if (mode === 'CTRL_ENTER') return mod
  return !mod && !event.shiftKey
}

/** Footer hint of the composer, in pt-BR. */
export function quickSendHint(mode: QuickSendMode, isMac: boolean): string {
  if (mode === 'CTRL_ENTER') {
    return `${isMac ? '⌘' : 'Ctrl'}+Enter envia · Enter quebra linha`
  }
  return 'Enter envia · Shift+Enter quebra linha'
}
