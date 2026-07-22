import { Shapes01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhatsappSettingsTemplates } from '@/app/_components/whatsapp/settings/whatsapp-settings-templates'
import { SteelIcon } from '@/components/icon/icon'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Templates | Steel',
  description: 'Templates de mensagem aprovados pela Meta',
}

export default async function ZapTemplatesPage({
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
          <HeaderBreadcrumbCrumb title='Templates'>
            <SteelIcon
              icon={Shapes01Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full p-6'>
        <WhatsappSettingsTemplates workspaceId={membership.value.workspaceId} />
      </div>
    </div>
  )
}
