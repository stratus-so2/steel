import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SdKbArticleScreen } from '@/app/_components/servicedesk/knowledge/sd-kb-article-screen'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'
import { SdKbArticleService } from '@/src/services/sd-kb-article.service'

export const metadata: Metadata = {
  title: 'Artigo | Base de conhecimento | Steel',
  description: 'Artigo da base de conhecimento do ServiceDesk.',
}

export default async function SdKnowledgeArticlePage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; articleId: string }>
}) {
  const { 'workspace-slug': slug, articleId } = await params
  const viewer = await getSdKbViewer(slug)
  if (!viewer) notFound()

  const article = await SdKbArticleService.getById(
    viewer.userId,
    viewer.workspaceId,
    articleId,
  )
  if (!article.ok) notFound()

  return (
    <SdKbArticleScreen
      workspaceId={viewer.workspaceId}
      workspaceSlug={slug}
      userId={viewer.userId}
      userName={viewer.userName}
      article={article.value}
      canEdit={viewer.canEdit}
      canDelete={viewer.canDelete}
    />
  )
}
