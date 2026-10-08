'use client'

import { Fragment } from 'react'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { cn } from '@/lib/utils'
import {
  formatKeys,
  formatKeysText,
  isSingleKeySequence,
} from '@/src/lib/shortcuts/keys'
import {
  displayKeys,
  getShortcut,
  shortcutKeys,
} from '@/src/lib/shortcuts/registry'
import { useIsMac, useShortcuts } from './shortcuts-provider'

/** Keys of one binding (`mod+k` → `Ctrl` `K`; `g c` → `G` depois `C`). */
export function KeysKbd({
  keys,
  className,
}: {
  keys: string
  className?: string
}) {
  const isMac = useIsMac()
  const strokes = formatKeys(keys, isMac)
  return (
    <KbdGroup
      className={className}
      aria-label={formatKeysText(keys, isMac)}
      data-keys={keys}
    >
      {strokes.map((tokens, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden className='text-[10px] text-muted-foreground'>
              depois
            </span>
          ) : null}
          <span aria-hidden className='inline-flex gap-0.5'>
            {tokens.map((token) => (
              <Kbd key={token}>{token}</Kbd>
            ))}
          </span>
        </Fragment>
      ))}
    </KbdGroup>
  )
}

/**
 * The keys of a registry entry, for tooltips, menu items and the palette.
 * Hidden when single-key shortcuts are turned off and this one has no
 * modifier (it would not work).
 */
export function ShortcutKbd({
  id,
  className,
  all = false,
  always = false,
}: {
  id: string
  className?: string
  /** Show every alternative (`J` ou `↓`); default shows the first one. */
  all?: boolean
  /** Show even when the user turned single-key shortcuts off. */
  always?: boolean
}) {
  const ctx = useShortcuts()
  const isMac = useIsMac()
  const entry = getShortcut(id)
  const keys = displayKeys(entry, isMac).filter(
    (k) => always || ctx?.singleKeyEnabled !== false || !isSingleKeySequence(k),
  )
  // 1–9 and heading ranges are shown as "first a last".
  const range = shortcutKeys(entry, isMac).length > 3
  const shown = all || range ? keys : keys.slice(0, 1)
  if (shown.length === 0) return null
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {shown.map((k, index) => (
        <Fragment key={k}>
          {index > 0 ? (
            <span className='text-muted-foreground text-xs'>
              {range ? 'a' : 'ou'}
            </span>
          ) : null}
          <KeysKbd keys={k} />
        </Fragment>
      ))}
    </span>
  )
}

/** Tooltip body: label plus keys (`Atribuir  A`). */
export function ShortcutHint({
  id,
  label,
}: {
  id: string
  /** Defaults to the registry label. */
  label?: string
}) {
  return (
    <span className='inline-flex items-center gap-2'>
      <span>{label ?? getShortcut(id).label}</span>
      <ShortcutKbd id={id} />
    </span>
  )
}
