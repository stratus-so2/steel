import type { IconSvgElement } from '@hugeicons/react'
import {
  Agreement02Icon,
  Book02Icon,
  CustomerSupportIcon,
  DatabaseIcon,
  Mail02Icon,
  PresentationLineChart02Icon,
  SparklesIcon,
  Target01Icon,
  UserGroupIcon,
  WhatsappIcon,
  WorkflowSquare01Icon,
} from '@hugeicons-pro/core-solid-rounded'

export interface WebNavLink {
  label: string
  href: string
}

export interface WebNavItem extends WebNavLink {
  description: string
  icon: IconSvgElement
}

/**
 * Single source of the public site's navigation, shared by the web header
 * (desktop bar + mobile menu) and the footer. Keep it to the essentials:
 * every entry is a page a visitor looks for before signing up, and no entry
 * may point at `#`.
 */
export const webNav = {
  /** The four modules (Produto menu, first column). */
  product: [
    {
      label: 'ServiceDesk',
      href: '/product/servicedesk',
      description: 'Chamados ITIL 4 com SLA, CMDB e portal',
      icon: CustomerSupportIcon,
    },
    {
      label: 'CRM',
      href: '/product/crm',
      description: 'Leads, pipelines, propostas e forecast',
      icon: Agreement02Icon,
    },
    {
      label: 'Comunicação',
      href: '/product/comunicacao',
      description: 'WhatsApp Business com inbox e disparos',
      icon: WhatsappIcon,
    },
    {
      label: 'Steel AI',
      href: '/product/steel-ai',
      description: 'Assistente de IA que age com sua confirmação',
      icon: SparklesIcon,
    },
  ] satisfies WebNavItem[],
  /** Feature pages (Produto menu, "Capacidades de Recursos"). */
  features: [
    {
      label: 'Portal do solicitante',
      href: '/features/portal-do-solicitante',
      description: 'Abertura e acompanhamento de chamados pelo cliente',
      icon: UserGroupIcon,
    },
    {
      label: 'SLA e OLA',
      href: '/features/sla',
      description: 'Prazos sobre calendários úteis, com escalonamento',
      icon: Target01Icon,
    },
    {
      label: 'Base de conhecimento',
      href: '/features/base-de-conhecimento',
      description: 'Artigos com KCS, revisão e métrica de reuso',
      icon: Book02Icon,
    },
    {
      label: 'CMDB',
      href: '/features/cmdb',
      description: 'Itens de configuração ligados aos chamados',
      icon: DatabaseIcon,
    },
    {
      label: 'Dashboards e modo TV',
      href: '/features/dashboards',
      description: 'Filas, SLA e resultados visíveis para o time',
      icon: PresentationLineChart02Icon,
    },
    {
      label: 'Campanhas e landing pages',
      href: '/features/campanhas',
      description: 'E-mail, formulários e páginas de captura',
      icon: Mail02Icon,
    },
    {
      label: 'Workflows e Aprovações',
      href: '/features/workflows',
      description: 'Automações por regra e aprovações por e-mail',
      icon: WorkflowSquare01Icon,
    },
  ] satisfies WebNavItem[],
  /** Plain links next to "Produto" in the bar, in this order. */
  main: [
    { label: 'Preços', href: '/pricing' },
    { label: 'Docs', href: '/docs' },
    { label: 'Changelog', href: '/changelog' },
  ] satisfies WebNavLink[],
  signIn: { label: 'Entrar', href: '/sign-in' } satisfies WebNavLink,
  /** The one primary call to action of the public site. */
  cta: {
    label: 'Fale com vendas',
    href: '/talk-to-sales',
  } satisfies WebNavLink,
}

/**
 * Routes linked from the header or footer whose pages a later slice creates
 * (the developer docs at `/dev`). The route-existence test reports them as
 * "coming" instead of failing; remove a prefix here once its pages land.
 */
export const COMING_ROUTE_PREFIXES = ['/dev'] as const

/** A nav entry is active on its own page and on any page below it. */
export function isWebNavActive(pathname: string | null, href: string) {
  if (!pathname) return false
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** The Produto menu is active on any module or feature page. */
export function isProductActive(pathname: string | null) {
  return [...webNav.product, ...webNav.features].some((item) =>
    isWebNavActive(pathname, item.href),
  )
}
