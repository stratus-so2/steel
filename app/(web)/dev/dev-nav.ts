import type {
  SidebarHome,
  SidebarSection,
} from '../docs/_components/docs-sidebar'

/**
 * Sidebar of the developer site (`/dev`). Guides (authentication and API
 * keys, webhooks, errors, rate limits, examples) are added here as they are
 * written; the API reference itself is `/dev/api`.
 */
export const DEV_HOME: SidebarHome = {
  href: '/dev',
  label: 'Visão geral',
}

export const DEV_NAV: SidebarSection[] = [
  {
    slug: 'referencia',
    label: 'Referência',
    pages: [{ href: '/dev/api', title: 'Referência da API' }],
  },
]
