'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

type MobileNavValue = {
  /**
   * DOM node inside the open mobile drawer where the current module's
   * `ContextSidebar` portals its content. `null` while the drawer is closed.
   */
  contextSlot: HTMLElement | null
  setContextSlot: (el: HTMLElement | null) => void
}

const MobileNavContext = createContext<MobileNavValue | null>(null)

/**
 * Wraps the private shell so the header's drawer and whatever module layout
 * renders a `ContextSidebar` can meet. Module layouts do nothing special: the
 * sidebar finds the slot through this context.
 */
export function MobileNavProvider({ children }: { children: ReactNode }) {
  const [contextSlot, setContextSlot] = useState<HTMLElement | null>(null)
  return (
    <MobileNavContext.Provider value={{ contextSlot, setContextSlot }}>
      {children}
    </MobileNavContext.Provider>
  )
}

/** `null` outside the private shell (public pages, isolated tests). */
export function useMobileNav(): MobileNavValue | null {
  return useContext(MobileNavContext)
}
