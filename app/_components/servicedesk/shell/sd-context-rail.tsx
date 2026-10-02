'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/** Routes that bring their own context rail, via their own layout. */
const OWN_RAIL = ['/settings', '/knowledge']

/**
 * Hides the module rail on the routes that bring their own.
 *
 * Two screens used to draw their own navigation *inside* the content, next to
 * the module rail: settings, with 24 buttons in a 240px rail, and the
 * knowledge base, with the article tree in a 256px `aside`. Two bars where the
 * rest of the app has one. Now each of those routes renders its rail from its
 * own layout and this one steps aside, so there is always exactly one.
 *
 * Why a client component: the layout is a server component and cannot read
 * `pathname`. It stays deliberately tiny and imports nothing heavy — the
 * alternative, passing every rail into the module layout as a prop, would pull
 * the settings registry (which statically imports all 24 tab screens) and the
 * article tree into the bundle of every ServiceDesk page.
 */
export function SdModuleRail({
  base,
  children,
}: {
  /** `/<slug>/servicedesk`. */
  base: string
  children: ReactNode
}) {
  const pathname = usePathname()
  const hidden = OWN_RAIL.some((segment) =>
    pathname.startsWith(`${base}${segment}`),
  )
  return hidden ? null : children
}
