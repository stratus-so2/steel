'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

/**
 * Picks which context rail a ServiceDesk route shows.
 *
 * Two screens used to draw their own navigation *inside* the content, next to
 * the module rail: settings, with 24 buttons in a 240px rail, and the
 * knowledge base, with the article tree in a 256px `aside`. Two bars where
 * the rest of the app has one. Here the route decides what the single rail
 * shows — settings, knowledge base or the module menu — and the content keeps
 * the full width.
 *
 * The layout is a server component and cannot read `pathname`, so the choice
 * happens on the client and each alternative arrives as a prop already
 * rendered on the server.
 */
export function SdContextRail({
  base,
  settingsNav,
  knowledgeNav,
  children,
}: {
  /** `/<slug>/servicedesk`. */
  base: string
  settingsNav: ReactNode
  knowledgeNav: ReactNode
  /** The module menu — the default. */
  children: ReactNode
}) {
  const pathname = usePathname()
  if (pathname.startsWith(`${base}/settings`)) return settingsNav
  if (pathname.startsWith(`${base}/knowledge`)) return knowledgeNav
  return children
}
