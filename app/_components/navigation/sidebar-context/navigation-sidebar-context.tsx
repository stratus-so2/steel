'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useMobileNav } from '../mobile-nav/mobile-nav-context'

/**
 * Module context navigation.
 *
 * - From `md` up it is the fixed-width rail next to the page. It never shrinks:
 *   the private shell gives its children `min-w-0`, and a rail that could
 *   shrink would get squeezed under a wide page and overlap it.
 * - Below `md` the rail is hidden and the same children are portaled into the
 *   mobile drawer while it is open, so every module layout gets the mobile
 *   menu for free. Portals keep React context, so providers above the sidebar
 *   (e.g. Steel AI's) still reach its content inside the drawer.
 */
export function ContextSidebar({ children }: { children: ReactNode }) {
  const mobileNav = useMobileNav()
  const slot = mobileNav?.contextSlot ?? null

  return (
    <>
      <aside
        data-slot='context-sidebar'
        className='hidden h-full w-62.5 min-w-62.5 shrink-0 flex-col border-r border-border p-3 md:flex'
      >
        <div className='flex-1 space-y-4 overflow-y-auto'>{children}</div>
      </aside>
      {slot
        ? createPortal(<div className='space-y-4'>{children}</div>, slot)
        : null}
    </>
  )
}
