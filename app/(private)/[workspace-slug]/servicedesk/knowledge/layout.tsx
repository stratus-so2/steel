import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { SdKbContextNav } from '@/app/_components/servicedesk/knowledge/sd-kb-context-nav'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'

/**
 * Knowledge base shell: the access gate, the context rail holding the article
 * tree, and a full-height column for the page.
 *
 * The tree used to be a 256px `aside` inside the page, beside the module rail;
 * it now sits in the rail itself, the shape Nexo's Wiki uses, and
 * `SdModuleRail` steps aside for this route so there is exactly one rail. The
 * header belongs to each page — the article one needs the document name in its
 * breadcrumb, which a layout cannot know.
 */
export default async function SdKnowledgeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdKbViewer(slug)
  if (!viewer) notFound()

  return (
    <>
      <SdKbContextNav
        workspaceId={viewer.workspaceId}
        slug={slug}
        canEdit={viewer.canEdit}
        canCreate={viewer.canCreate}
        canDelete={viewer.canDelete}
      />
      <div className='flex h-full min-h-0 w-full flex-col'>{children}</div>
    </>
  )
}
