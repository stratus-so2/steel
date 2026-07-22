import { Megaphone01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhatsappSettingsBroadcasts } from '@/app/_components/whatsapp/settings/whatsapp-settings-broadcasts'
import { SteelIcon } from '@/components/icon/icon'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Transmissões | Steel',
  description: 'Listas de transmissão de WhatsApp',
}

export default async function ZapBroadcastsPage({
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
          <HeaderBreadcrumbCrumb title='Transmissões'>
            <SteelIcon
              icon={Megaphone01Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full p-6'>
        <WhatsappSettingsBroadcasts
          workspaceId={membership.value.workspaceId}
        />
      </div>
    </div>
  )
}
