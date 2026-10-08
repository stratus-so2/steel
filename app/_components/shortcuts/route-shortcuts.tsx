'use client'

import { useShortcut } from './shortcuts-provider'
import { useCommandNavigate } from './workspace-commands'

export type RouteShortcut = {
  /** Registry id (`sd.go-tickets`, `crm.go-leads`…). */
  id: string
  href: string
}

function Route({ route }: { route: RouteShortcut }) {
  const go = useCommandNavigate()
  useShortcut(route.id, () => go(route.href))
  return null
}

/**
 * "Go to" sequences of a module (`G → T`, `G → L`…), mounted by the
 * module layout — a server component can pass the routes as plain data.
 */
export function RouteShortcuts({ routes }: { routes: RouteShortcut[] }) {
  return (
    <>
      {routes.map((route) => (
        <Route key={route.id} route={route} />
      ))}
    </>
  )
}
