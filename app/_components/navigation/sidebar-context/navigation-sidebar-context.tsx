'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useShortcut } from '@/app/_components/shortcuts/shortcuts-provider'
import { cn } from '@/lib/utils'
import { useMobileNav } from '../mobile-nav/mobile-nav-context'

const COLLAPSED_KEY = 'steel:context-sidebar-collapsed'

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

function writeCollapsed(value: boolean) {
  try {
    window.localStorage.setItem(COLLAPSED_KEY, value ? '1' : '0')
  } catch {
    // Blocked storage: the choice just is not remembered.
  }
}

/**
 * Module context navigation.
 *
 * - From `md` up it is the fixed-width rail next to the page. It never shrinks:
 *   the private shell gives its children `min-w-0`, and a rail that could
 *   shrink would get squeezed under a wide page and overlap it. `[` hides
 *   and shows it (remembered per browser).
 * - Below `md` the rail is hidden and the same children are portaled into the
 *   mobile drawer while it is open, so every module layout gets the mobile
 *   menu for free. Portals keep React context, so providers above the sidebar
 *   (e.g. Steel AI's) still reach its content inside the drawer.
 */
export function ContextSidebar({ children }: { children: ReactNode }) {
  const mobileNav = useMobileNav()
  const slot = mobileNav?.contextSlot ?? null
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => setCollapsed(readCollapsed()), [])

  useShortcut('nav.toggle-sidebar', () => {
    setCollapsed((value) => {
      writeCollapsed(!value)
      return !value
    })
  })

  return (
    <>
      <aside
        data-slot='context-sidebar'
        data-collapsed={collapsed || undefined}
        className={cn(
          'hidden h-full w-62.5 min-w-62.5 shrink-0 flex-col border-r border-border p-3',
          !collapsed && 'md:flex',
        )}
      >
        <div className='flex-1 space-y-4 overflow-y-auto'>{children}</div>
      </aside>
      {slot
        ? createPortal(<div className='space-y-4'>{children}</div>, slot)
        : null}
    </>
  )
}
