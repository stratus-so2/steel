import {
  AiMagicIcon,
  Settings02Icon,
  Ticket01Icon,
  UserGroupIcon,
  WhatsappBusinessIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { SteelIcon } from '@/components/icon/icon'

type IconType = Parameters<typeof SteelIcon>[0]['icon']

export type GlobalNavItem = {
  href: string
  label: string
  icon: IconType
  /** Draws a divider before this item (modules vs. workspace tools). */
  separated?: boolean
}

/**
 * The workspace-wide destinations, shared by the desktop rail and the mobile
 * drawer so both always list the same modules in the same order.
 */
export function globalNavItems(slug: string): GlobalNavItem[] {
  const base = `/${slug}`
  return [
    { href: `${base}/servicedesk`, label: 'ServiceDesk', icon: Ticket01Icon },
    { href: `${base}/crm`, label: 'CRM', icon: UserGroupIcon },
    { href: `${base}/zap`, label: 'Comunicação', icon: WhatsappBusinessIcon },
    {
      href: `${base}/ai`,
      label: 'Steel AI',
      icon: AiMagicIcon,
      separated: true,
    },
    { href: `${base}/settings`, label: 'Ajustes', icon: Settings02Icon },
  ]
}

/** A module entry is active on its own route and on everything under it. */
export function isGlobalNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
