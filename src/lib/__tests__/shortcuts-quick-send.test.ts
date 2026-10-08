import { describe, expect, it } from 'vitest'
import { isQuickSend, quickSendHint } from '@/src/lib/shortcuts/quick-send'

function key(
  k: string,
  extra: Partial<{
    shiftKey: boolean
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    isComposing: boolean
    nativeEvent: { isComposing?: boolean }
  }> = {},
) {
  return {
    key: k,
    shiftKey: false,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    ...extra,
  }
}

describe('isQuickSend', () => {
  it('Enter mode: Enter sends, Shift/Ctrl+Enter do not', () => {
    expect(isQuickSend(key('Enter'))).toBe(true)
    expect(isQuickSend(key('Enter'), 'ENTER')).toBe(true)
    expect(isQuickSend(key('Enter', { shiftKey: true }), 'ENTER')).toBe(false)
    expect(isQuickSend(key('Enter', { ctrlKey: true }), 'ENTER')).toBe(false)
    expect(isQuickSend(key('a'), 'ENTER')).toBe(false)
  })

  it('Ctrl+Enter mode: Ctrl/⌘+Enter sends, Enter breaks the line', () => {
    expect(isQuickSend(key('Enter'), 'CTRL_ENTER')).toBe(false)
    expect(isQuickSend(key('Enter', { ctrlKey: true }), 'CTRL_ENTER')).toBe(
      true,
    )
    expect(isQuickSend(key('Enter', { metaKey: true }), 'CTRL_ENTER')).toBe(
      true,
    )
  })

  it('never sends while composing (IME/accents) or with Alt', () => {
    expect(isQuickSend(key('Enter', { isComposing: true }))).toBe(false)
    expect(
      isQuickSend(key('Enter', { nativeEvent: { isComposing: true } })),
    ).toBe(false)
    expect(isQuickSend(key('Enter', { altKey: true }))).toBe(false)
  })
})

describe('quickSendHint', () => {
  it('describes each mode per platform', () => {
    expect(quickSendHint('ENTER', false)).toBe(
      'Enter envia · Shift+Enter quebra linha',
    )
    expect(quickSendHint('CTRL_ENTER', false)).toBe(
      'Ctrl+Enter envia · Enter quebra linha',
    )
    expect(quickSendHint('CTRL_ENTER', true)).toBe(
      '⌘+Enter envia · Enter quebra linha',
    )
  })
})
