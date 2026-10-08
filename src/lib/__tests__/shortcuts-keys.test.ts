import { describe, expect, it } from 'vitest'
import {
  detectMac,
  eventToStroke,
  formatKeys,
  formatKeysText,
  formatStroke,
  isCharacterStroke,
  isSingleKeySequence,
  normalizeKeys,
  parseSequence,
  parseStroke,
} from '@/src/lib/shortcuts/keys'

function ev(
  key: string,
  extra: Partial<{
    code: string
    ctrlKey: boolean
    metaKey: boolean
    altKey: boolean
    shiftKey: boolean
    isComposing: boolean
  }> = {},
) {
  return {
    key,
    code: extra.code ?? '',
    ctrlKey: extra.ctrlKey ?? false,
    metaKey: extra.metaKey ?? false,
    altKey: extra.altKey ?? false,
    shiftKey: extra.shiftKey ?? false,
    isComposing: extra.isComposing,
  }
}

describe('parseStroke / normalizeKeys', () => {
  it('parses modifiers and key', () => {
    expect(parseStroke('Mod+Shift+O')).toEqual({
      mod: true,
      ctrl: false,
      meta: false,
      alt: false,
      shift: true,
      key: 'o',
    })
  })

  it('normalizes modifier order and case', () => {
    expect(normalizeKeys('Shift+Mod+K')).toBe('mod+shift+k')
    expect(normalizeKeys('alt+shift+ArrowDown')).toBe('alt+shift+arrowdown')
    expect(normalizeKeys('  g   c ')).toBe('g c')
  })

  it('rejects unknown modifiers and empty keys', () => {
    expect(() => parseStroke('hyper+k')).toThrow(/Unknown modifier/)
    expect(() => parseStroke('mod+')).toThrow(/Empty shortcut key/)
  })

  it('splits sequences', () => {
    expect(parseSequence('g c').map((s) => s.key)).toEqual(['g', 'c'])
  })
})

describe('character keys (WCAG 2.1.4)', () => {
  it('flags letters, digits and symbols without real modifiers', () => {
    expect(isCharacterStroke(parseStroke('j'))).toBe(true)
    expect(isCharacterStroke(parseStroke('shift+r'))).toBe(true)
    expect(isCharacterStroke(parseStroke('?'))).toBe(true)
    expect(isCharacterStroke(parseStroke('1'))).toBe(true)
  })

  it('keeps named keys and modified strokes', () => {
    expect(isCharacterStroke(parseStroke('escape'))).toBe(false)
    expect(isCharacterStroke(parseStroke('arrowdown'))).toBe(false)
    expect(isCharacterStroke(parseStroke('mod+k'))).toBe(false)
    expect(isCharacterStroke(parseStroke('alt+m'))).toBe(false)
    expect(isCharacterStroke(parseStroke('ctrl+x'))).toBe(false)
    expect(isCharacterStroke(parseStroke('meta+x'))).toBe(false)
  })

  it('judges a sequence by its first stroke', () => {
    expect(isSingleKeySequence('g c')).toBe(true)
    expect(isSingleKeySequence('mod+k')).toBe(false)
  })
})

describe('eventToStroke', () => {
  it('maps Ctrl to mod on Windows/Linux and ⌘ to mod on Mac', () => {
    expect(eventToStroke(ev('k', { ctrlKey: true }), false)).toBe('mod+k')
    expect(eventToStroke(ev('k', { metaKey: true }), true)).toBe('mod+k')
    expect(eventToStroke(ev('k', { ctrlKey: true }), true)).toBe('ctrl+k')
    expect(eventToStroke(ev('k', { metaKey: true }), false)).toBe('meta+k')
  })

  it('keeps Shift on letters and drops it on shifted symbols', () => {
    expect(eventToStroke(ev('R', { shiftKey: true }), false)).toBe('shift+r')
    expect(eventToStroke(ev('?', { shiftKey: true }), false)).toBe('?')
    expect(eventToStroke(ev('#', { shiftKey: true }), false)).toBe('#')
    expect(eventToStroke(ev('ArrowLeft', { shiftKey: true }), false)).toBe(
      'shift+arrowleft',
    )
  })

  it('reads the physical key when Alt is held (⌥M → µ on Mac)', () => {
    expect(eventToStroke(ev('µ', { altKey: true, code: 'KeyM' }), true)).toBe(
      'alt+m',
    )
    expect(eventToStroke(ev('¡', { altKey: true, code: 'Digit1' }), true)).toBe(
      'alt+1',
    )
    expect(
      eventToStroke(
        ev('ArrowDown', { altKey: true, shiftKey: true, code: 'ArrowDown' }),
        false,
      ),
    ).toBe('alt+shift+arrowdown')
    expect(eventToStroke(ev('…', { altKey: true, code: 'Period' }), true)).toBe(
      'alt+.',
    )
    expect(
      eventToStroke(ev('x', { altKey: true, code: 'IntlRo' }), false),
    ).toBe('alt+x')
  })

  it('names space and the legacy Esc', () => {
    expect(eventToStroke(ev(' '), false)).toBe('space')
    expect(eventToStroke(ev('Esc'), false)).toBe('escape')
    expect(eventToStroke(ev('Escape'), false)).toBe('escape')
    expect(eventToStroke(ev('Enter', { ctrlKey: true }), false)).toBe(
      'mod+enter',
    )
  })

  it('ignores modifiers alone, dead keys and IME composition', () => {
    expect(eventToStroke(ev('Shift', { shiftKey: true }), false)).toBeNull()
    expect(eventToStroke(ev('Dead'), false)).toBeNull()
    expect(eventToStroke(ev('AltGraph'), false)).toBeNull()
    expect(eventToStroke(ev('a', { isComposing: true }), false)).toBeNull()
    expect(eventToStroke(ev(''), false)).toBeNull()
  })
})

describe('display', () => {
  it('formats for Windows/Linux', () => {
    expect(formatStroke('mod+shift+o', false)).toEqual(['Ctrl', 'Shift', 'O'])
    expect(formatStroke('alt+arrowdown', false)).toEqual(['Alt', '↓'])
    expect(formatStroke('meta+x', false)).toEqual(['Win', 'X'])
    expect(formatKeys('g c', false)).toEqual([['G'], ['C']])
    expect(formatStroke('escape', false)).toEqual(['Esc'])
    expect(formatStroke('space', false)).toEqual(['Espaço'])
  })

  it('formats for macOS with symbols in Apple order', () => {
    expect(formatStroke('mod+shift+o', true)).toEqual(['⇧', '⌘', 'O'])
    expect(formatStroke('mod+alt+1', true)).toEqual(['⌥', '⌘', '1'])
    expect(formatStroke('ctrl+enter', true)).toEqual(['⌃', '↵'])
  })

  it('renders plain text', () => {
    expect(formatKeysText('mod+k', false)).toBe('Ctrl+K')
    expect(formatKeysText('mod+k', true)).toBe('⌘K')
    expect(formatKeysText('g c', false)).toBe('G depois C')
  })

  it('detects the platform', () => {
    expect(detectMac({ platform: 'MacIntel' })).toBe(true)
    expect(detectMac({ platform: '', userAgent: 'iPhone OS' })).toBe(true)
    expect(detectMac({ platform: 'Win32' })).toBe(false)
    expect(detectMac({})).toBe(false)
    expect(detectMac(undefined)).toBe(false)
  })
})
