'use client'

import type { SdKbArticleDTO } from '@/types/sd-kb-article'
import { SdKbArticleEditor } from './sd-kb-article-editor'
import { SdKbArticleHeader } from './sd-kb-article-header'
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
  // Reading: the same standard header as the editor, without its actions.
  return (
    <div className='flex h-full min-h-0 flex-col'>
      <SdKbArticleHeader workspaceSlug={workspaceSlug} title={article.title} />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <SdKbArticleView
          workspaceId={workspaceId}
          article={article}
          hrefForRelated={(a) =>
            `/${workspaceSlug}/servicedesk/knowledge/${a.id}`
          }
        />
      </div>
    </div>
  )
}
