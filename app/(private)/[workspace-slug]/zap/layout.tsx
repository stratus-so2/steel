import {
  Chatting01Icon,
  FlashIcon,
  Megaphone01Icon,
  Settings02Icon,
  Shapes01Icon,
  UserGroupIcon,
  UserMultipleIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavItem,
} from '@/app/_components/navigation/sidebar-context'

export default async function ZapLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const base = `/${slug}/zap`

  return (
    <>
      <ContextSidebar>
        <ContextHeader title='WhatsApp' />
        <NavGroup>
          <NavItem href={base} icon={Chatting01Icon}>
            Conversas
          </NavItem>
          <NavItem href={`${base}/grupos`} icon={UserGroupIcon}>
            Grupos
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/contatos`} icon={UserMultipleIcon}>
            Contatos
          </NavItem>
          <NavItem href={`${base}/templates`} icon={Shapes01Icon}>
            Templates
          </NavItem>
          <NavItem href={`${base}/mensagens-rapidas`} icon={FlashIcon}>
            Mensagens rápidas
          </NavItem>
          <NavItem href={`${base}/transmissoes`} icon={Megaphone01Icon}>
            Transmissões
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/configuracoes`} icon={Settings02Icon}>
            Configurações
          </NavItem>
        </NavGroup>
      </ContextSidebar>
      {children}
    </>
  )
}
