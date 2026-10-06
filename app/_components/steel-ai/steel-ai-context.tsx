'use client'

import { createContext, type ReactNode, useContext } from 'react'

export interface SteelAiWorkspace {
  workspaceId: string
  slug: string
  /** First name of the signed-in user, for the greeting. */
  firstName: string
}

const SteelAiContext = createContext<SteelAiWorkspace | null>(null)

export function SteelAiProvider({
  value,
  children,
}: {
  value: SteelAiWorkspace
  children: ReactNode
}) {
  return (
    <SteelAiContext.Provider value={value}>{children}</SteelAiContext.Provider>
  )
}

export function useSteelAiWorkspace(): SteelAiWorkspace {
  const value = useContext(SteelAiContext)
  if (!value) throw new Error('useSteelAiWorkspace outside SteelAiProvider')
  return value
}
