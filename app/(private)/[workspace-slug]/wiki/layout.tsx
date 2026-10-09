import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
} from '@/app/_components/navigation/sidebar-context'
import { WikiCreatePageButton } from '@/app/_components/wiki/wiki-create-page-button'
import { WikiSidebarTree } from '@/app/_components/wiki/wiki-sidebar-tree'
import { getWikiContext, getWikiPages } from '@/src/lib/wiki-context'

export default async function WikiLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': workspaceSlug } = await params
  const context = await getWikiContext(workspaceSlug)
  if (!context) notFound()
  // Rendered with the layout so the page tree is there on the first paint —
  // an empty sidebar on arrival read as "the click did not work".
  const pages = await getWikiPages(context)

  return (
    <>
      <ContextSidebar>
        <ContextHeader
          title='Wiki'
          primaryAction={
            <WikiCreatePageButton
              workspaceId={context.workspaceId}
              workspaceSlug={workspaceSlug}
            />
          }
        />
        <WikiSidebarTree
          workspaceId={context.workspaceId}
          workspaceSlug={workspaceSlug}
          initialPages={pages}
        />
      </ContextSidebar>
      <div className='flex h-full min-h-0 min-w-0 flex-1 flex-col'>
        {children}
      </div>
    </>
  )
}
