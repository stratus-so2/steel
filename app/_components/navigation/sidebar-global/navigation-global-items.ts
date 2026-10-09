import {
  AiMagicIcon,
  BookOpen01Icon,
  Settings02Icon,
  Ticket01Icon,
  UserGroupIcon,
  WhatsappBusinessIcon,
  WhiteboardIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { SteelIcon } from '@/components/icon/icon'

type IconType = Parameters<typeof SteelIcon>[0]['icon']

export type GlobalNavItem = {
  href: string
  label: string
  icon: IconType
  /** Draws a divider before this item (modules vs. workspace tools). */
  separated?: boolean
  /** Registry id of its "go to" shortcut (`G → S`), shown in the tooltip. */
  shortcut?: string
}

/**
 * The workspace-wide destinations, shared by the desktop rail and the mobile
 * drawer so both always list the same modules in the same order.
 */
export function globalNavItems(
  slug: string,
  {
    wikiEnabled = false,
    whiteboardEnabled = false,
  }: { wikiEnabled?: boolean; whiteboardEnabled?: boolean } = {},
): GlobalNavItem[] {
  const base = `/${slug}`
  return [
    {
      href: `${base}/servicedesk`,
      label: 'ServiceDesk',
      icon: Ticket01Icon,
      shortcut: 'nav.servicedesk',
    },
    {
      href: `${base}/crm`,
      label: 'CRM',
      icon: UserGroupIcon,
      shortcut: 'nav.crm',
    },
    {
      href: `${base}/zap`,
      label: 'Comunicação',
      icon: WhatsappBusinessIcon,
      shortcut: 'nav.zap',
    },
    // Only once an OWNER/ADMIN turns it on in Ajustes > Wiki.
    ...(wikiEnabled
      ? [
          {
            href: `${base}/wiki`,
            label: 'Wiki',
            icon: BookOpen01Icon,
            separated: true,
            shortcut: 'nav.wiki',
          },
        ]
      : []),
    // Right below the Wiki; on by default, off in Ajustes > Quadro-branco.
    ...(whiteboardEnabled
      ? [
          {
            href: `${base}/whiteboard`,
            label: 'Quadro-branco',
            icon: WhiteboardIcon,
            separated: !wikiEnabled,
            shortcut: 'nav.whiteboard',
          },
        ]
      : []),
    {
      href: `${base}/ai`,
      label: 'Steel AI',
      icon: AiMagicIcon,
      separated: !wikiEnabled && !whiteboardEnabled,
      shortcut: 'nav.ai',
    },
    {
      href: `${base}/settings`,
      label: 'Ajustes',
      icon: Settings02Icon,
      shortcut: 'nav.settings',
    },
  ]
}

/** A module entry is active on its own route and on everything under it. */
export function isGlobalNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
