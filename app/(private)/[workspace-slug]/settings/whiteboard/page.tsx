import { WhiteboardIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhiteboardSettingsSection } from '@/app/_components/settings/whiteboard-settings-section'
import { SteelIcon } from '@/components/icon/icon'
import { H3 } from '@/components/typography/heading/h3'
import { Muted } from '@/components/typography/text/muted'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Quadro-branco | Ajustes | Steel',
  description: 'Ligue ou desligue o Quadro-branco do workspace',
}

export default async function SettingsWhiteboardPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='w-full overflow-y-auto'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Quadro-branco'>
            <SteelIcon
              icon={WhiteboardIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full max-w-3xl space-y-6 p-6'>
        <div>
          <H3>Quadro-branco</H3>
          <Muted>
            Quadros do Excalidraw para o workspace, com histórico de versões.
          </Muted>
        </div>
        <WhiteboardSettingsSection workspaceId={membership.value.workspaceId} />
      </div>
    </div>
  )
}
