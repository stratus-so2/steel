import {
  ArrowLeft01Icon,
  BinocularsIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CrmCompetitorAnalysis } from '@/app/_components/crm/crm-competitor-analysis'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Análise do concorrente | CRM | Steel',
  description:
    'Comparação de posts, formatos e horários com a sua conta e ideias de publicação',
}

export default async function CrmCompetitorAnalysisPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; competitorId: string }>
}) {
  const { 'workspace-slug': slug, competitorId } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='flex h-full w-full min-h-0 flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Análise do concorrente'>
            <SteelIcon
              icon={BinocularsIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-6'>
        <div className='mx-auto w-full max-w-6xl'>
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            render={
              <Link href={`/${slug}/crm/social/competitors`}>
                <SteelIcon icon={ArrowLeft01Icon} size={14} />
                Concorrentes
              </Link>
            }
          />
        </div>
        <CrmCompetitorAnalysis
          workspaceId={membership.value.workspaceId}
          competitorId={competitorId}
        />
      </div>
    </div>
  )
}
