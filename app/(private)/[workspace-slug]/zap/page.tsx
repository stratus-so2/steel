import {
  Settings02Icon,
  WhatsappBusinessIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhatsappPageClient } from '@/app/_components/whatsapp/whatsapp-page-client'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'WhatsApp | Steel',
  description: 'Envie e receba mensagens de WhatsApp direto do Steel',
}

export default async function ZapPage({
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
    <div className='flex h-full w-full flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='WhatsApp'>
            <SteelIcon
              icon={WhatsappBusinessIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
        <Button
          variant='ghost'
          size='icon-sm'
          nativeButton={false}
          render={
            <Link href={`/${slug}/zap/configuracoes`}>
              <SteelIcon icon={Settings02Icon} size={18} />
            </Link>
          }
        />
      </HeaderInternalNavigation>
      <div className='min-h-0 flex-1'>
        <WhatsappPageClient workspaceId={membership.value.workspaceId} />
      </div>
    </div>
  )
}
