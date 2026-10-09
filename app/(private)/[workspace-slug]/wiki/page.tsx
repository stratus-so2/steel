import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { WikiEmptyState } from '@/app/_components/wiki/wiki-empty-state'
import { getWikiContext, getWikiPages } from '@/src/lib/wiki-context'
import { firstWikiPageId } from '@/src/lib/wiki-tree'

export const metadata: Metadata = {
  title: 'Wiki | Steel',
  description: 'Base de conhecimento do workspace.',
}

/**
 * The rail's "Wiki" link. It opens the first page straight away, so one
 * click lands on the editor; before, it stopped on a "pick a page" screen
 * with an empty tree and people clicked the link again.
 */
export default async function WikiPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': workspaceSlug } = await params
  const context = await getWikiContext(workspaceSlug)
  if (!context) notFound()

  const pages = await getWikiPages(context)
  const firstId = firstWikiPageId(pages ?? [])
  if (firstId) redirect(`/${workspaceSlug}/wiki/${firstId}`)

  return (
    <WikiEmptyState
      workspaceId={context.workspaceId}
      workspaceSlug={workspaceSlug}
    />
  )
}
