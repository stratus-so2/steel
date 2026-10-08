'use client'

import { useShortcut, useShortcuts } from './shortcuts-provider'

export type RouteShortcut = {
  /** Registry id (`sd.go-tickets`, `crm.go-leads`…). */
  id: string
  href: string
}

function Route({ route }: { route: RouteShortcut }) {
  // The shell's navigate (app router); no router hook here, so a module
  // layout renders the same without the workspace shell around it.
  const navigate = useShortcuts()?.navigate
  useShortcut(route.id, () => navigate?.(route.href))
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
