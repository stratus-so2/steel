'use client'

import type { SdKbArticleDTO } from '@/types/sd-kb-article'
import { SdKbArticleEditor } from './sd-kb-article-editor'
import { SdKbArticleView } from './sd-kb-article-view'

/** Escolhe entre o editor (agente com `sd-knowledge:EDIT`) e a leitura. */
export function SdKbArticleScreen({
  workspaceId,
  workspaceSlug,
  userId,
  userName,
  article,
  canEdit,
  canDelete,
}: {
  workspaceId: string
  workspaceSlug: string
  userId: string
  userName: string
  article: SdKbArticleDTO
  canEdit: boolean
  canDelete: boolean
}) {
  if (canEdit) {
    return (
      <SdKbArticleEditor
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        userId={userId}
        userName={userName}
        article={article}
        canDelete={canDelete}
      />
    )
  }
  return (
    <SdKbArticleView
      workspaceId={workspaceId}
      article={article}
      hrefForRelated={(a) => `/${workspaceSlug}/servicedesk/knowledge/${a.id}`}
    />
  )
}
