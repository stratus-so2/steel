import { UserMultipleIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhatsappContactsPage } from '@/app/_components/whatsapp/whatsapp-contacts-page'
import { SteelIcon } from '@/components/icon/icon'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Contatos | Steel',
  description: 'Contatos de WhatsApp do workspace',
}

export default async function ZapContactsPage({
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
          <HeaderBreadcrumbCrumb title='Contatos'>
            <SteelIcon
              icon={UserMultipleIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full p-6'>
        <WhatsappContactsPage workspaceId={membership.value.workspaceId} />
      </div>
    </div>
  )
}
