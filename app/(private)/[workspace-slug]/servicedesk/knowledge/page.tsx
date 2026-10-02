import { BookOpen01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-crumb'
import { HeaderBreadcrumbList } from '@/app/_components/header/breadcrumb-page/header-breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SdKbCreateButton } from '@/app/_components/servicedesk/knowledge/sd-kb-create-button'
import { SdKbHome } from '@/app/_components/servicedesk/knowledge/sd-kb-home'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'
import { SteelIcon } from '@/components/icon/icon'

export const metadata: Metadata = {
  title: 'Base de conhecimento | ServiceDesk | Steel',
  description: 'Artigos e soluções da base de conhecimento do ServiceDesk.',
}

export default async function SdKnowledgePage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const viewer = await getSdKbViewer(slug)
  if (!viewer) notFound()

  return (
    <>
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
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <SdKbHome
          workspaceId={viewer.workspaceId}
          workspaceSlug={slug}
          isAgent={viewer.isAgent}
        />
      </div>
    </>
  )
}
