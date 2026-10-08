import { isSingleKeySequence } from './keys'
import {
  SHORTCUT_SCOPES,
  type ShortcutDefinition,
  shortcutKeys,
} from './registry'

/** How long the second stroke of a sequence (`g` → `c`) may wait. */
export const SEQUENCE_TIMEOUT_MS = 1000

export type ShortcutBinding = {
  definition: ShortcutDefinition
  /** Registration order: among equal scopes, the latest mounted wins. */
  order: number
  enabled: boolean
  /** The binding lives inside the dialog that is open now. */
  inOverlay?: boolean
}

export type MatchContext = {
  isMac: boolean
  /** Focus is in an input, textarea, select or contenteditable. */
  typing: boolean
  /** Focus is inside the rich (Plate) editor. */
  inRichEditor: boolean
  /** A dialog or menu is open. */
  overlayOpen: boolean
  /** User preference: single-key shortcuts and sequences on. */
  singleKeyEnabled: boolean
  now: number
}

export type MatchResult<B extends ShortcutBinding> =
  | { kind: 'fire'; keys: string; candidates: B[] }
  | { kind: 'pending'; keys: string }
  | { kind: 'none' }

function eligible(binding: ShortcutBinding, ctx: MatchContext): boolean {
  const def = binding.definition
  if (!binding.enabled) return false
  if (SHORTCUT_SCOPES[def.scope].documentationOnly) return false
  if (ctx.typing && !def.allowInInput) return false
  if (ctx.inRichEditor && def.notInRichEditor) return false
  if (ctx.overlayOpen && !def.allowInDialog && !binding.inOverlay) return false
  return true
}

/** The binding's keys that may fire under the user's preference. */
function activeKeys(binding: ShortcutBinding, ctx: MatchContext): string[] {
  return shortcutKeys(binding.definition, ctx.isMac).filter(
    (keys) => ctx.singleKeyEnabled || !isSingleKeySequence(keys),
  )
}

/** Inner scope first; same scope → most recently mounted first. */
export function compareBindings(a: ShortcutBinding, b: ShortcutBinding) {
  const depth =
    SHORTCUT_SCOPES[b.definition.scope].depth -
    SHORTCUT_SCOPES[a.definition.scope].depth
  return depth !== 0 ? depth : b.order - a.order
}

/**
 * Stateful matcher: keeps the pending strokes of a sequence. Pure (no DOM),
 * so the provider and the unit tests share it.
 */
export class ShortcutMatcher {
  private buffer: string[] = []
  private lastAt = 0

  constructor(private readonly timeoutMs = SEQUENCE_TIMEOUT_MS) {}

  get pending(): readonly string[] {
    return this.buffer
  }

  reset() {
    this.buffer = []
  }

  match<B extends ShortcutBinding>(
    stroke: string,
    bindings: readonly B[],
    ctx: MatchContext,
  ): MatchResult<B> {
    if (ctx.now - this.lastAt > this.timeoutMs) this.buffer = []
    this.lastAt = ctx.now

    const usable = bindings
      .filter((binding) => eligible(binding, ctx))
      .map((binding) => ({ binding, keys: activeKeys(binding, ctx) }))

    const attempt = (sequence: string[]): MatchResult<B> => {
      const text = sequence.join(' ')
      const exact = usable
        .filter((item) => item.keys.includes(text))
        .map((item) => item.binding)
      if (exact.length > 0) {
        this.buffer = []
        return {
          kind: 'fire',
          keys: text,
          candidates: exact.sort(compareBindings),
        }
      }
      const waits = usable.some((item) =>
        item.keys.some((keys) => keys.startsWith(`${text} `)),
      )
      if (waits) {
        this.buffer = sequence
        return { kind: 'pending', keys: text }
      }
      return { kind: 'none' }
    }

    if (this.buffer.length > 0) {
      const continued = attempt([...this.buffer, stroke])
      if (continued.kind !== 'none') return continued
      this.buffer = []
    }
    return attempt([stroke])
  }
}
