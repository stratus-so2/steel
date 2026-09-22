'use client'

import * as React from 'react'

/**
 * Contexto do editor Plate da KB (port de `use-wiki-editor-context` do Nexo):
 * os componentes de comentário, menção e upload leem workspace/artigo daqui.
 */
export interface KbEditorContextValue {
  workspaceId: string
  articleId: string
  userId: string
  userName: string
}

const KbEditorContext = React.createContext<KbEditorContextValue | null>(null)

export function KbEditorProvider({
  workspaceId,
  articleId,
  userId,
  userName,
  children,
}: React.PropsWithChildren<KbEditorContextValue>) {
  const value = React.useMemo(
    () => ({ workspaceId, articleId, userId, userName }),
    [workspaceId, articleId, userId, userName],
  )
  return (
    <KbEditorContext.Provider value={value}>
      {children}
    </KbEditorContext.Provider>
  )
}

export function useKbEditorContext(): KbEditorContextValue {
  const ctx = React.useContext(KbEditorContext)
  if (!ctx) {
    throw new Error(
      'useKbEditorContext deve ser usado dentro de KbEditorProvider',
    )
  }
  return ctx
}
