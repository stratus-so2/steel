import {
  Alert02Icon,
  AlertDiamondIcon,
  ArrowDataTransferHorizontalIcon,
  BookOpen01Icon,
  Bug01Icon,
  Building03Icon,
  ContactBookIcon,
  CustomerService01Icon,
  DashboardSquare01Icon,
  Home01Icon,
  ServerStack01Icon,
  Settings02Icon,
  Ticket01Icon,
  TicketStarIcon,
  UserAccountIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavItem,
} from '@/app/_components/navigation/sidebar-context'
import { loadSdDirectoryContext } from '@/app/_components/servicedesk/directory/sd-directory-context'
import { SdKbContextNav } from '@/app/_components/servicedesk/knowledge/sd-kb-context-nav'
import { getSdKbViewer } from '@/app/_components/servicedesk/knowledge/sd-kb-server-context'
import { SdSettingsNav } from '@/app/_components/servicedesk/settings/sd-settings-nav'
import { SdContextRail } from '@/app/_components/servicedesk/shell/sd-context-rail'
import { hasModuleAccess } from '@/src/lib/module-access-guard'

export default async function ServiceDeskLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  if (!(await hasModuleAccess(slug, 'SERVICE_DESK'))) notFound()
  // Agente × solicitante (sem departamento): o menu do solicitante só tem
  // o portal e a base de conhecimento.
  const ctx = await loadSdDirectoryContext(slug)
  if (!ctx) notFound()
  const base = `/${slug}/servicedesk`

  // Alternative rails: settings and the knowledge base replace the module
  // menu instead of drawing a second bar inside the page. `getSdKbViewer` is
  // `cache()`d — the knowledge layout calls the very same one.
  const kb = await getSdKbViewer(slug)
  const settingsNav = <SdSettingsNav base={base} />
  const knowledgeNav = kb ? (
    <SdKbContextNav
      workspaceId={kb.workspaceId}
      slug={slug}
      canEdit={kb.canEdit}
      canCreate={kb.canCreate}
      canDelete={kb.canDelete}
    />
  ) : null

  if (!ctx.isAgent) {
    return (
      <>
        <SdContextRail
          base={base}
          settingsNav={settingsNav}
          knowledgeNav={knowledgeNav}
        >
          <ContextSidebar>
            <ContextHeader title='ServiceDesk' />
            <NavGroup>
              <NavItem href={`${base}/portal`} icon={CustomerService01Icon}>
                Portal do solicitante
              </NavItem>
              <NavItem href={`${base}/knowledge`} icon={BookOpen01Icon}>
                Base de conhecimento
              </NavItem>
            </NavGroup>
          </ContextSidebar>
        </SdContextRail>
        {children}
      </>
    )
  }

  return (
    <>
      <SdContextRail
        base={base}
        settingsNav={settingsNav}
        knowledgeNav={knowledgeNav}
      >
        <ContextSidebar>
          <ContextHeader title='ServiceDesk' />
          <NavGroup>
            <NavItem href={base} icon={Home01Icon}>
              Início
            </NavItem>
            <NavItem href={`${base}/portal`} icon={CustomerService01Icon}>
              Portal do solicitante
            </NavItem>
          </NavGroup>
          <NavGroup>
            <NavItem href={`${base}/tickets`} icon={Ticket01Icon}>
              Todos os chamados
            </NavItem>
            <NavItem href={`${base}/incidents`} icon={Alert02Icon}>
              Incidentes
            </NavItem>
            <NavItem href={`${base}/requests`} icon={TicketStarIcon}>
              Requisições
            </NavItem>
            <NavItem
              href={`${base}/changes`}
              icon={ArrowDataTransferHorizontalIcon}
            >
              Mudanças
            </NavItem>
            <NavItem href={`${base}/problems`} icon={Bug01Icon}>
              Problemas
            </NavItem>
            <NavItem href={`${base}/risk`} icon={AlertDiamondIcon}>
              Análise de risco
            </NavItem>
          </NavGroup>
          <NavGroup>
            <NavItem href={`${base}/customers`} icon={UserAccountIcon}>
              Clientes
            </NavItem>
            <NavItem href={`${base}/companies`} icon={Building03Icon}>
              Empresas
            </NavItem>
            <NavItem href={`${base}/contacts`} icon={ContactBookIcon}>
              Contatos
            </NavItem>
            <NavItem href={`${base}/config-items`} icon={ServerStack01Icon}>
              Itens de configuração
            </NavItem>
          </NavGroup>
          <NavGroup>
            <NavItem href={`${base}/knowledge`} icon={BookOpen01Icon}>
              Base de conhecimento
            </NavItem>
            <NavItem href={`${base}/dashboards`} icon={DashboardSquare01Icon}>
              Painéis
            </NavItem>
          </NavGroup>
          <NavGroup>
            <NavItem href={`${base}/settings`} icon={Settings02Icon}>
              Configurações
            </NavItem>
          </NavGroup>
        </ContextSidebar>
      </SdContextRail>
      {children}
    </>
  )
}
