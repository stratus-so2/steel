'use client'

import { createContext, type ReactNode, useContext } from 'react'

export interface WhiteboardSession {
  workspaceId: string
  workspaceSlug: string
  userId: string
  /** Not a VIEWER: creates and edits boards. */
  canEdit: boolean
  /** OWNER/ADMIN: archives any board. */
  isPrivileged: boolean
}

const Ctx = createContext<WhiteboardSession | null>(null)

/** Who is looking at the whiteboard area; resolved once by its layout. */
export function WhiteboardSessionProvider({
  value,
  children,
}: {
  value: WhiteboardSession
  children: ReactNode
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWhiteboardSession(): WhiteboardSession {
  const session = useContext(Ctx)
  if (!session) throw new Error('WhiteboardSessionProvider is missing')
  return session
}

/** localStorage key of the last board opened in a workspace. */
export function lastBoardKey(workspaceId: string) {
  return `steel:whiteboard:last:${workspaceId}`
}

export function readLastBoard(workspaceId: string): string | null {
  try {
    return window.localStorage.getItem(lastBoardKey(workspaceId))
  } catch {
    return null
  }
}

export function writeLastBoard(workspaceId: string, boardId: string | null) {
  try {
    if (boardId) window.localStorage.setItem(lastBoardKey(workspaceId), boardId)
    else window.localStorage.removeItem(lastBoardKey(workspaceId))
  } catch {
    // Private mode / blocked storage: the list is the fallback.
  }
}
