'use client'

import {
  createContext,
  type ReactNode,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { detectMac, eventToStroke } from '@/src/lib/shortcuts/keys'
import {
  type ShortcutBinding,
  ShortcutMatcher,
} from '@/src/lib/shortcuts/matcher'
import type { QuickSendMode } from '@/src/lib/shortcuts/quick-send'
import {
  getShortcut,
  type ShortcutDefinition,
} from '@/src/lib/shortcuts/registry'

/**
 * Return `false` when the shortcut does not apply right now (nothing in
 * focus, no selection…): the key then goes to the next binding or to the
 * browser, and its default is not prevented.
 */
export type ShortcutHandler = (event: KeyboardEvent, keys: string) => unknown

type Registration = {
  key: number
  definition: ShortcutDefinition
  order: number
  handler: RefObject<ShortcutHandler>
  enabled: RefObject<boolean>
  element?: RefObject<Element | null>
}

type ShortcutsApi = {
  isMac: boolean
  singleKeyEnabled: boolean
  /** User preference "Envio rápido" for the composers. */
  quickSendMode: QuickSendMode
  register: (registration: Omit<Registration, 'key' | 'order'>) => () => void
  /** Ids with an enabled binding mounted now (the "Nesta tela" tab). */
  activeIds: () => Set<string>
  cheatSheetOpen: boolean
  setCheatSheetOpen: (open: boolean) => void
}

const ShortcutsContext = createContext<ShortcutsApi | null>(null)

/** Focus is in a field where single keys type text. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (tag === 'INPUT') {
    const type = (target as HTMLInputElement).type
    return ![
      'checkbox',
      'radio',
      'button',
      'submit',
      'reset',
      'range',
    ].includes(type)
  }
  return (
    target.isContentEditable ||
    Boolean(target.closest('[contenteditable="true"]'))
  )
}

export function isRichEditorTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element && Boolean(target.closest('[data-slate-editor]'))
  )
}

const OVERLAY_SELECTOR =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [data-shortcuts-trap]'

/** The open dialog/menu on top, if any (closed or hidden ones are skipped). */
export function topOverlay(doc: Document = document): Element | null {
  const open = [...doc.querySelectorAll(OVERLAY_SELECTOR)].filter(
    (el) =>
      !el.hasAttribute('data-closed') &&
      !el.closest('[hidden], [aria-hidden="true"]'),
  )
  return open.at(-1) ?? null
}

export function ShortcutsProvider({
  children,
  singleKeyEnabled = true,
  quickSendMode = 'ENTER',
  isMac: forcedMac,
}: {
  children: ReactNode
  /** User preference "Atalhos de uma tecla". */
  singleKeyEnabled?: boolean
  /** User preference "Envio rápido". */
  quickSendMode?: QuickSendMode
  /** Tests only: skip the platform detection. */
  isMac?: boolean
}) {
  const registrations = useRef(new Map<number, Registration>())
  const counter = useRef(0)
  const matcher = useRef(new ShortcutMatcher())
  const [detectedMac, setDetectedMac] = useState(false)
  const [cheatSheetOpen, setCheatSheetOpen] = useState(false)
  const isMac = forcedMac ?? detectedMac

  useEffect(() => {
    setDetectedMac(detectMac(window.navigator))
  }, [])

  const register = useCallback(
    (registration: Omit<Registration, 'key' | 'order'>) => {
      counter.current += 1
      const key = counter.current
      registrations.current.set(key, { ...registration, key, order: key })
      return () => {
        registrations.current.delete(key)
      }
    },
    [],
  )

  const activeIds = useCallback(() => {
    const ids = new Set<string>()
    for (const reg of registrations.current.values()) {
      if (reg.enabled.current) ids.add(reg.definition.id)
    }
    return ids
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // A component already handled this key (editor, combobox, composer).
      if (event.defaultPrevented) return
      const stroke = eventToStroke(event, isMac)
      if (!stroke) return

      const overlay = topOverlay()
      const bindings: (ShortcutBinding & { reg: Registration })[] = []
      for (const reg of registrations.current.values()) {
        const element = reg.element?.current
        bindings.push({
          definition: reg.definition,
          order: reg.order,
          enabled: Boolean(reg.enabled.current),
          inOverlay: Boolean(overlay && element && overlay.contains(element)),
          reg,
        })
      }

      const result = matcher.current.match(stroke, bindings, {
        isMac,
        typing: isTypingTarget(event.target),
        inRichEditor: isRichEditorTarget(event.target),
        overlayOpen: overlay !== null,
        singleKeyEnabled,
        now: Date.now(),
      })
      if (result.kind !== 'fire') return

      for (const candidate of result.candidates) {
        const handled = candidate.reg.handler.current?.(event, result.keys)
        if (handled !== false) {
          event.preventDefault()
          return
        }
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isMac, singleKeyEnabled])

  const api = useMemo<ShortcutsApi>(
    () => ({
      isMac,
      singleKeyEnabled,
      quickSendMode,
      register,
      activeIds,
      cheatSheetOpen,
      setCheatSheetOpen,
    }),
    [
      isMac,
      singleKeyEnabled,
      quickSendMode,
      register,
      activeIds,
      cheatSheetOpen,
    ],
  )

  return (
    <ShortcutsContext.Provider value={api}>
      {children}
    </ShortcutsContext.Provider>
  )
}

/** The provider's API, or `null` outside the workspace shell. */
export function useShortcuts(): ShortcutsApi | null {
  return useContext(ShortcutsContext)
}

/** ⌘ on macOS, Ctrl elsewhere — for components that print keys. */
export function useIsMac(): boolean {
  const ctx = useContext(ShortcutsContext)
  const [mac, setMac] = useState(false)
  useEffect(() => {
    if (!ctx) setMac(detectMac(window.navigator))
  }, [ctx])
  return ctx ? ctx.isMac : mac
}

export type UseShortcutOptions = {
  /** Off while the action does not apply (no permission, nothing loaded). */
  enabled?: boolean
  /**
   * Element of the component that owns the binding. While a dialog is open
   * only bindings inside it (and the `allowInDialog` ones) fire.
   */
  ref?: RefObject<Element | null>
}

/**
 * Binds the action of a registry entry while the component is mounted.
 * Outside the provider (public pages, isolated tests) it does nothing.
 */
export function useShortcut(
  id: string,
  handler: ShortcutHandler,
  { enabled = true, ref }: UseShortcutOptions = {},
) {
  const ctx = useContext(ShortcutsContext)
  const handlerRef = useRef(handler)
  const enabledRef = useRef(enabled)
  // Latest handler/flag without re-registering (registration order matters).
  useEffect(() => {
    handlerRef.current = handler
    enabledRef.current = enabled
  })
  const register = ctx?.register

  useEffect(() => {
    if (!register) return
    return register({
      definition: getShortcut(id),
      handler: handlerRef,
      enabled: enabledRef,
      element: ref,
    })
  }, [register, id, ref])
}
