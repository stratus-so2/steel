'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'

type ModuleKind = 'SERVICE_DESK' | 'CRM' | 'COMMUNICATION'

export type WorkspaceCommand = {
  /** Registry id: the keys come from there. */
  id: string
  label: string
  href: string
  /** Hidden while the module is off. */
  module?: ModuleKind
  wiki?: boolean
}

/** Navigation and "create" commands, shared by the shortcuts and Ctrl+K. */
export function workspaceCommands(slug: string): WorkspaceCommand[] {
  const base = `/${slug}`
  return [
    { id: 'nav.home', label: 'Ir para a Início', href: base },
    {
      id: 'nav.inbox',
      label: 'Ir para a Caixa de entrada',
      href: `${base}/inbox`,
    },
    {
      id: 'nav.servicedesk',
      label: 'Ir para o ServiceDesk',
      href: `${base}/servicedesk`,
      module: 'SERVICE_DESK',
    },
    {
      id: 'nav.crm',
      label: 'Ir para o CRM',
      href: `${base}/crm`,
      module: 'CRM',
    },
    {
      id: 'nav.zap',
      label: 'Ir para a Comunicação',
      href: `${base}/zap`,
      module: 'COMMUNICATION',
    },
    { id: 'nav.ai', label: 'Ir para o Steel AI', href: `${base}/ai` },
    {
      id: 'nav.wiki',
      label: 'Ir para a Wiki',
      href: `${base}/wiki`,
      wiki: true,
    },
    {
      id: 'nav.settings',
      label: 'Ir para os Ajustes do workspace',
      href: `${base}/settings`,
    },
    {
      id: 'create.ticket',
      label: 'Novo chamado',
      href: `${base}/servicedesk/tickets?new=1`,
      module: 'SERVICE_DESK',
    },
    {
      id: 'create.lead',
      label: 'Novo lead',
      href: `${base}/crm/leads?new=1`,
      module: 'CRM',
    },
    {
      id: 'create.opportunity',
      label: 'Nova oportunidade',
      href: `${base}/crm/opportunities?new=1`,
      module: 'CRM',
    },
    {
      id: 'create.person',
      label: 'Nova pessoa',
      href: `${base}/crm/people?new=1`,
      module: 'CRM',
    },
    {
      id: 'create.company',
      label: 'Nova empresa',
      href: `${base}/crm/companies?new=1`,
      module: 'CRM',
    },
    {
      id: 'create.crm-task',
      label: 'Nova tarefa do CRM',
      href: `${base}/crm/tasks?new=1`,
      module: 'CRM',
    },
    {
      id: 'create.conversation',
      label: 'Nova conversa de WhatsApp',
      href: `${base}/zap?new=1`,
      module: 'COMMUNICATION',
    },
    {
      id: 'create.ai-chat',
      label: 'Novo chat no Steel AI',
      href: `${base}/ai`,
    },
  ]
}

/** Commands available with these modules on. */
export function availableCommands(
  slug: string,
  modules: readonly string[],
  wikiEnabled: boolean,
): WorkspaceCommand[] {
  return workspaceCommands(slug).filter(
    (command) =>
      (!command.module || modules.includes(command.module)) &&
      (!command.wiki || wikiEnabled),
  )
}

/**
 * Same page with another query string (`?new=1`): the page reads it on
 * mount, so a full navigation is what actually opens the form.
 */
export function useCommandNavigate() {
  const router = useRouter()
  const pathname = usePathname()
  return useCallback(
    (href: string) => {
      const target = new URL(href, window.location.origin)
      if (target.pathname === pathname && target.search) {
        window.location.assign(href)
      } else {
        router.push(href)
      }
    },
    [router, pathname],
  )
}
