import { Settings02Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WhatsappSettingsAi } from '@/app/_components/whatsapp/settings/whatsapp-settings-ai'
import { WhatsappSettingsBroadcasts } from '@/app/_components/whatsapp/settings/whatsapp-settings-broadcasts'
import { WhatsappSettingsConnections } from '@/app/_components/whatsapp/settings/whatsapp-settings-connections'
import { WhatsappSettingsContacts } from '@/app/_components/whatsapp/settings/whatsapp-settings-contacts'
import { WhatsappSettingsQuickReplies } from '@/app/_components/whatsapp/settings/whatsapp-settings-quick-replies'
import { WhatsappSettingsTemplates } from '@/app/_components/whatsapp/settings/whatsapp-settings-templates'
import { SteelIcon } from '@/components/icon/icon'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Configurações do WhatsApp | Steel',
  description:
    'Conexões, contatos, mensagens rápidas, templates e IA do WhatsApp',
}

export default async function ZapSettingsPage({
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

  const workspaceId = membership.value.workspaceId

  return (
    <div className='w-full overflow-y-auto'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Configurações do WhatsApp'>
            <SteelIcon
              icon={Settings02Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full p-6'>
        <Tabs defaultValue='connections'>
          <TabsList>
            <TabsTrigger value='connections'>Conexões</TabsTrigger>
            <TabsTrigger value='contacts'>Contatos</TabsTrigger>
            <TabsTrigger value='quick-replies'>Mensagem rápida</TabsTrigger>
            <TabsTrigger value='templates'>Templates</TabsTrigger>
            <TabsTrigger value='broadcasts'>Transmissão</TabsTrigger>
            <TabsTrigger value='ai'>IA</TabsTrigger>
          </TabsList>
          <TabsContent value='connections' className='pt-4'>
            <WhatsappSettingsConnections workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value='contacts' className='pt-4'>
            <WhatsappSettingsContacts workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value='quick-replies' className='pt-4'>
            <WhatsappSettingsQuickReplies workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value='templates' className='pt-4'>
            <WhatsappSettingsTemplates workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value='broadcasts' className='pt-4'>
            <WhatsappSettingsBroadcasts workspaceId={workspaceId} />
          </TabsContent>
          <TabsContent value='ai' className='pt-4'>
            <WhatsappSettingsAi workspaceId={workspaceId} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
