import { BookOpen01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-crumb'
import { HeaderBreadcrumbList } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SdKbCreateButton } from '@/app/_components/servicedesk/knowledge/sd-kb-create-button'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'
import { SdKbTree } from '@/app/_components/servicedesk/knowledge/sd-kb-tree'
import { SteelIcon } from '@/components/icon/icon'

/**
 * Casca da base de conhecimento (como o layout da Wiki do Nexo), mas dentro
 * do contexto do ServiceDesk: a árvore de artigos fica numa coluna
 * secundária da página, ao lado do conteúdo.
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
    <div className='flex h-full w-full min-h-0 flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Base de conhecimento'>
            <SteelIcon
              icon={BookOpen01Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
        {viewer.canCreate && (
          <SdKbCreateButton
            workspaceId={viewer.workspaceId}
            workspaceSlug={slug}
          />
        )}
      </HeaderInternalNavigation>
      <div className='flex min-h-0 flex-1'>
        <aside className='hidden w-64 shrink-0 overflow-y-auto border-r p-2 md:block'>
          <SdKbTree
            workspaceId={viewer.workspaceId}
            workspaceSlug={slug}
            canEdit={viewer.canEdit}
            canCreate={viewer.canCreate}
            canDelete={viewer.canDelete}
          />
        </aside>
        <main className='min-h-0 min-w-0 flex-1 overflow-y-auto'>
          {children}
        </main>
      </div>
    </div>
  )
}
