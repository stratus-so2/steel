import {
  AiChat01Icon,
  BrowserIcon,
  Building03Icon,
  Calendar01Icon,
  ChartHistogramIcon,
  CheckListIcon,
  DocumentValidationIcon,
  FunnelIcon,
  Key01Icon,
  Mail01Icon,
  MailSend01Icon,
  PackageIcon,
  Share08Icon,
  StickyNote01Icon,
  TargetDollarIcon,
  TaskDone01Icon,
  UserGroup02Icon,
  UserMultipleIcon,
  UserSearch01Icon,
  WorkflowCircle01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavItem,
} from '@/app/_components/navigation/sidebar-context'

export default async function CrmLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const base = `/${slug}/crm`

  return (
    <>
      <ContextSidebar>
        <ContextHeader title='CRM' />
        <NavGroup>
          <NavItem href={`${base}/leads`} icon={UserSearch01Icon}>
            Leads
          </NavItem>
          <NavItem href={`${base}/opportunities`} icon={TargetDollarIcon}>
            Oportunidades
          </NavItem>
          <NavItem href={`${base}/companies`} icon={Building03Icon}>
            Empresas
          </NavItem>
          <NavItem href={`${base}/people`} icon={UserMultipleIcon}>
            Pessoas
          </NavItem>
          <NavItem href={`${base}/pipelines`} icon={FunnelIcon}>
            Pipelines
          </NavItem>
          <NavItem href={`${base}/products`} icon={PackageIcon}>
            Produtos
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/tasks`} icon={TaskDone01Icon}>
            Tarefas
          </NavItem>
          <NavItem href={`${base}/notes`} icon={StickyNote01Icon}>
            Notas
          </NavItem>
          <NavItem href={`${base}/proposals`} icon={DocumentValidationIcon}>
            Documentos
          </NavItem>
          <NavItem href={`${base}/custom-fields`} icon={CheckListIcon}>
            Campos customizados
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/email-templates`} icon={Mail01Icon}>
            Templates de e-mail
          </NavItem>
          <NavItem href={`${base}/email-campaigns`} icon={MailSend01Icon}>
            Campanhas de e-mail
          </NavItem>
          <NavItem href={`${base}/mailing-lists`} icon={UserGroup02Icon}>
            Listas de e-mail
          </NavItem>
          <NavItem href={`${base}/landing-pages`} icon={BrowserIcon}>
            Landing pages
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/workflows`} icon={WorkflowCircle01Icon}>
            Workflows
          </NavItem>
          <NavItem href={`${base}/social`} icon={Share08Icon}>
            Redes sociais
          </NavItem>
          <NavItem href={`${base}/email-sync`} icon={Calendar01Icon}>
            E-mail e agenda
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/reports`} icon={ChartHistogramIcon}>
            Relatórios
          </NavItem>
          <NavItem href={`${base}/ai`} icon={AiChat01Icon}>
            Assistente IA
          </NavItem>
        </NavGroup>
        <NavGroup>
          <NavItem href={`${base}/integration-keys`} icon={Key01Icon}>
            Chaves de API
          </NavItem>
        </NavGroup>
      </ContextSidebar>
      {children}
    </>
  )
}
