/**
 * Keyboard shortcut notation, event normalization and display.
 *
 * A binding is written as a *sequence* of space-separated *strokes*; each
 * stroke is `modifier+…+key`, lower case:
 *
 * - `mod+k` — Ctrl on Windows/Linux, ⌘ on macOS
 * - `g c` — press G, release, then C
 * - `shift+r`, `alt+arrowdown`, `alt+shift+arrowdown`, `?`, `#`, `[`
 *
 * Modifiers are always written in the canonical order
 * `mod, ctrl, meta, alt, shift`. Symbols that need Shift on most layouts
 * (`?`, `#`) are written bare: the produced character is what matters, so
 * they work the same on US and ABNT2 keyboards.
 */

export const MODIFIERS = ['mod', 'ctrl', 'meta', 'alt', 'shift'] as const
export type Modifier = (typeof MODIFIERS)[number]

/** Keys with a name instead of the character they produce. */
const NAMED_KEYS = new Set([
  'arrowdown',
  'arrowup',
  'arrowleft',
  'arrowright',
  'enter',
  'escape',
  'space',
  'tab',
  'backspace',
  'delete',
  'home',
  'end',
  'pageup',
  'pagedown',
])

/** `KeyboardEvent.code` → key, used when Alt is held (⌥ changes `key` on Mac). */
const CODE_KEYS: Record<string, string> = {
  Period: '.',
  Comma: ',',
  Slash: '/',
  Semicolon: ';',
  BracketLeft: '[',
  BracketRight: ']',
  Minus: '-',
  Equal: '=',
  Space: 'space',
  Enter: 'enter',
  Escape: 'escape',
  ArrowDown: 'arrowdown',
  ArrowUp: 'arrowup',
  ArrowLeft: 'arrowleft',
  ArrowRight: 'arrowright',
}

/** Keys that never start a shortcut on their own. */
const IGNORED_KEYS = new Set([
  'shift',
  'control',
  'alt',
  'meta',
  'altgraph',
  'capslock',
  'dead',
  'unidentified',
  'process',
  'os',
  'fn',
])

export type Stroke = {
  mod: boolean
  ctrl: boolean
  meta: boolean
  alt: boolean
  shift: boolean
  key: string
}

/** Letters, digits and named keys keep Shift; other symbols already carry it. */
function keepsShift(key: string): boolean {
  return /^[a-z0-9]$/.test(key) || NAMED_KEYS.has(key)
}

/** Parses one stroke (`mod+shift+o`). Throws on an unknown modifier. */
export function parseStroke(text: string): Stroke {
  // `+` itself is never bound, so it is always a separator.
  const parts = text.trim().toLowerCase().split('+')
  const key = parts.pop() ?? ''
  if (!key) throw new Error(`Empty shortcut key in "${text}"`)
  const stroke: Stroke = {
    mod: false,
    ctrl: false,
    meta: false,
    alt: false,
    shift: false,
    key,
  }
  for (const part of parts) {
    if (!(MODIFIERS as readonly string[]).includes(part)) {
      throw new Error(`Unknown modifier "${part}" in "${text}"`)
    }
    stroke[part as Modifier] = true
  }
  return stroke
}

export function parseSequence(text: string): Stroke[] {
  return text.trim().split(/\s+/).map(parseStroke)
}

/** Canonical text of a stroke, used as the matching key. */
export function strokeToString(stroke: Stroke): string {
  const parts: string[] = []
  for (const modifier of MODIFIERS) if (stroke[modifier]) parts.push(modifier)
  parts.push(stroke.key)
  return parts.join('+')
}

/** Normalizes a written binding (`Shift+Mod+K` → `mod+shift+k`). */
export function normalizeKeys(text: string): string {
  return parseSequence(text).map(strokeToString).join(' ')
}

/** Is this a "character key" shortcut (WCAG 2.1.4)? */
export function isCharacterStroke(stroke: Stroke): boolean {
  if (stroke.mod || stroke.ctrl || stroke.meta || stroke.alt) return false
  return !NAMED_KEYS.has(stroke.key)
}

/** A sequence is "single key" when its first stroke has no real modifier. */
export function isSingleKeySequence(keys: string): boolean {
  return isCharacterStroke(parseSequence(keys)[0])
}

export type KeyEventLike = Pick<
  KeyboardEvent,
  'key' | 'code' | 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey'
> & { isComposing?: boolean }

/**
 * Turns a keydown into a canonical stroke string, or `null` for keys that
 * never trigger a shortcut (bare modifiers, dead keys, IME composition).
 */
export function eventToStroke(
  event: KeyEventLike,
  isMac: boolean,
): string | null {
  if (event.isComposing) return null
  const rawKey = event.key ?? ''
  const lowered = rawKey.toLowerCase()
  if (!rawKey || IGNORED_KEYS.has(lowered)) return null

  let key: string
  if (event.altKey) {
    // ⌥ on Mac turns `m` into `µ`: read the physical key instead.
    const code = event.code ?? ''
    if (/^Key[A-Z]$/.test(code)) key = code.slice(3).toLowerCase()
    else if (/^Digit[0-9]$/.test(code)) key = code.slice(5)
    else key = CODE_KEYS[code] ?? lowered
  } else if (rawKey === ' ') {
    key = 'space'
  } else if (rawKey === 'Esc') {
    key = 'escape'
  } else {
    key = lowered
  }

  const stroke: Stroke = {
    mod: isMac ? event.metaKey : event.ctrlKey,
    ctrl: isMac ? event.ctrlKey : false,
    meta: isMac ? false : event.metaKey,
    alt: event.altKey,
    shift: event.shiftKey && keepsShift(key),
    key,
  }
  return strokeToString(stroke)
}

const MAC_SYMBOLS: Record<Modifier, string> = {
  mod: '⌘',
  ctrl: '⌃',
  meta: '⌘',
  alt: '⌥',
  shift: '⇧',
}

const PC_NAMES: Record<Modifier, string> = {
  mod: 'Ctrl',
  ctrl: 'Ctrl',
  meta: 'Win',
  alt: 'Alt',
  shift: 'Shift',
}

const KEY_LABELS: Record<string, string> = {
  arrowdown: '↓',
  arrowup: '↑',
  arrowleft: '←',
  arrowright: '→',
  enter: '↵',
  escape: 'Esc',
  space: 'Espaço',
  tab: 'Tab',
  backspace: '⌫',
  delete: 'Del',
  home: 'Home',
  end: 'End',
  pageup: 'PgUp',
  pagedown: 'PgDn',
}

function keyLabel(key: string): string {
  return KEY_LABELS[key] ?? key.toUpperCase()
}

/**
 * Display tokens for one stroke: `mod+shift+o` → `['Ctrl', 'Shift', 'O']`
 * on Windows/Linux and `['⌘', '⇧', 'O']` on macOS. Mac orders modifiers
 * the Apple way (⌃⌥⇧⌘).
 */
export function formatStroke(text: string, isMac: boolean): string[] {
  const stroke = parseStroke(text)
  if (isMac) {
    const order: Modifier[] = ['ctrl', 'alt', 'shift', 'mod', 'meta']
    return [
      ...order.filter((m) => stroke[m]).map((m) => MAC_SYMBOLS[m]),
      keyLabel(stroke.key),
    ]
  }
  return [
    ...MODIFIERS.filter((m) => stroke[m]).map((m) => PC_NAMES[m]),
    keyLabel(stroke.key),
  ]
}

/** Display tokens for a whole sequence: `g c` → `[['G'], ['C']]`. */
export function formatKeys(keys: string, isMac: boolean): string[][] {
  return keys
    .trim()
    .split(/\s+/)
    .map((stroke) => formatStroke(stroke, isMac))
}

/** Plain text, for `aria-keyshortcuts`-like labels and titles. */
export function formatKeysText(keys: string, isMac: boolean): string {
  return formatKeys(keys, isMac)
    .map((tokens) => tokens.join(isMac ? '' : '+'))
    .join(' depois ')
}

/** Detects macOS/iOS from a `navigator`-like object. */
export function detectMac(
  nav: { platform?: string; userAgent?: string } | undefined,
): boolean {
  if (!nav) return false
  return /Mac|iPhone|iPad|iPod/.test(nav.platform || nav.userAgent || '')
}
