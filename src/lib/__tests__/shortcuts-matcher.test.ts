import { describe, expect, it } from 'vitest'
import {
  compareBindings,
  type MatchContext,
  SEQUENCE_TIMEOUT_MS,
  type ShortcutBinding,
  ShortcutMatcher,
} from '@/src/lib/shortcuts/matcher'
import { getShortcut } from '@/src/lib/shortcuts/registry'

function bind(id: string, order = 0, extra: Partial<ShortcutBinding> = {}) {
  return { definition: getShortcut(id), order, enabled: true, ...extra }
}

const base: MatchContext = {
  isMac: false,
  typing: false,
  inRichEditor: false,
  overlayOpen: false,
  singleKeyEnabled: true,
  now: 10_000,
}

function ids(result: ReturnType<ShortcutMatcher['match']>) {
  return result.kind === 'fire'
    ? result.candidates.map((b) => b.definition.id)
    : []
}

describe('ShortcutMatcher', () => {
  it('fires a single stroke', () => {
    const matcher = new ShortcutMatcher()
    const result = matcher.match('mod+k', [bind('global.search')], base)
    expect(result).toMatchObject({ kind: 'fire', keys: 'mod+k' })
  })

  it('waits for the second stroke of a sequence, then fires', () => {
    const matcher = new ShortcutMatcher()
    const bindings = [bind('nav.crm'), bind('nav.home')]
    expect(matcher.match('g', bindings, base)).toEqual({
      kind: 'pending',
      keys: 'g',
    })
    expect(matcher.pending).toEqual(['g'])
    const result = matcher.match('c', bindings, {
      ...base,
      now: base.now + 300,
    })
    expect(ids(result)).toEqual(['nav.crm'])
    expect(matcher.pending).toEqual([])
  })

  it('drops a sequence after the timeout', () => {
    const matcher = new ShortcutMatcher()
    const bindings = [bind('nav.crm')]
    matcher.match('g', bindings, base)
    const late = matcher.match('c', bindings, {
      ...base,
      now: base.now + SEQUENCE_TIMEOUT_MS + 1,
    })
    expect(late).toEqual({ kind: 'none' })
  })

  it('restarts with the current stroke when a sequence breaks', () => {
    const matcher = new ShortcutMatcher()
    const bindings = [bind('nav.crm'), bind('list.next')]
    matcher.match('g', bindings, base)
    expect(ids(matcher.match('j', bindings, base))).toEqual(['list.next'])
    matcher.match('g', bindings, base)
    expect(matcher.match('q', bindings, base)).toEqual({ kind: 'none' })
    expect(matcher.pending).toEqual([])
  })

  it('can start a new sequence from a broken one', () => {
    const matcher = new ShortcutMatcher()
    const bindings = [bind('nav.crm'), bind('create.ticket')]
    matcher.match('g', bindings, base)
    expect(matcher.match('c', [bind('create.ticket')], base)).toEqual({
      kind: 'pending',
      keys: 'c',
    })
    matcher.reset()
    expect(matcher.pending).toEqual([])
  })

  it('orders candidates: inner scope first, then latest mounted', () => {
    const matcher = new ShortcutMatcher()
    const result = matcher.match(
      'escape',
      [bind('global.escape', 5), bind('list.clear', 1), bind('ai.stop', 2)],
      base,
    )
    expect(ids(result)).toEqual(['ai.stop', 'list.clear', 'global.escape'])
    expect(
      compareBindings(bind('list.next', 1), bind('list.next', 2)),
    ).toBeGreaterThan(0)
  })

  it('applies the typing guard', () => {
    const matcher = new ShortcutMatcher()
    const typing = { ...base, typing: true }
    expect(matcher.match('j', [bind('list.next')], typing).kind).toBe('none')
    expect(matcher.match('mod+k', [bind('global.search')], typing).kind).toBe(
      'fire',
    )
    expect(matcher.match('g', [bind('nav.crm')], typing).kind).toBe('none')
  })

  it('leaves the editor keys to the rich editor', () => {
    const matcher = new ShortcutMatcher()
    const editor = { ...base, typing: true, inRichEditor: true }
    expect(matcher.match('mod+k', [bind('global.search')], editor).kind).toBe(
      'none',
    )
    expect(matcher.match('mod+i', [bind('global.ask-ai')], editor).kind).toBe(
      'none',
    )
    // Documentation-only entries are never dispatched.
    expect(matcher.match('mod+b', [bind('editor.bold')], base).kind).toBe(
      'none',
    )
  })

  it('traps shortcuts while a dialog is open, except its own and allowed ones', () => {
    const matcher = new ShortcutMatcher()
    const dialog = { ...base, overlayOpen: true }
    expect(matcher.match('?', [bind('global.shortcuts')], dialog).kind).toBe(
      'none',
    )
    expect(matcher.match('mod+k', [bind('global.search')], dialog).kind).toBe(
      'fire',
    )
    expect(
      matcher.match('j', [bind('list.next', 0, { inOverlay: true })], dialog)
        .kind,
    ).toBe('fire')
  })

  it('skips disabled bindings', () => {
    const matcher = new ShortcutMatcher()
    expect(
      matcher.match('n', [bind('list.new', 0, { enabled: false })], base).kind,
    ).toBe('none')
  })

  it('turns off single keys and sequences but keeps modified and named keys', () => {
    const matcher = new ShortcutMatcher()
    const off = { ...base, singleKeyEnabled: false }
    expect(matcher.match('j', [bind('list.next')], off).kind).toBe('none')
    expect(matcher.match('arrowdown', [bind('list.next')], off).kind).toBe(
      'fire',
    )
    expect(matcher.match('g', [bind('nav.crm')], off).kind).toBe('none')
    expect(matcher.match('mod+k', [bind('global.search')], off).kind).toBe(
      'fire',
    )
    expect(matcher.match('escape', [bind('global.escape')], off).kind).toBe(
      'fire',
    )
  })

  it('uses the macOS keys on Mac', () => {
    const matcher = new ShortcutMatcher()
    const definition = {
      ...getShortcut('editor.heading'),
      scope: 'global' as const,
    }
    const binding = { definition, order: 0, enabled: true }
    expect(
      matcher.match('mod+alt+1', [binding], { ...base, isMac: true }).kind,
    ).toBe('fire')
    expect(matcher.match('mod+alt+1', [binding], base).kind).toBe('none')
  })
})
