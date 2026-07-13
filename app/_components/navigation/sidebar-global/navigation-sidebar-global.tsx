'use client'

import {
  Settings02Icon,
  Ticket01Icon,
  UserGroupIcon,
  WhatsappBusinessIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { usePathname } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { GlobalButtonNavigation } from './navigation-sidebar-global-button'

export function GlobalSidebarNavigation({ slug }: { slug: string }) {
  const base = `/${slug}`
  const pathname = usePathname()

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className=' h-screen px-2 py-3'>
      <div className='h-fit flex flex-col justify-between gap-3'>
        <GlobalButtonNavigation
          linkNavigation={`${base}/servicedesk`}
          description='ServiceDesk'
          active={isActive(`${base}/servicedesk`)}
        >
          <SteelIcon icon={Ticket01Icon} className='size-5' />
        </GlobalButtonNavigation>
        <GlobalButtonNavigation
          linkNavigation={`${base}/crm`}
          description='CRM'
          active={isActive(`${base}/crm`)}
        >
          <SteelIcon icon={UserGroupIcon} className='size-5' />
        </GlobalButtonNavigation>
        <GlobalButtonNavigation
          linkNavigation={`${base}/zap`}
          description='Comunicação'
          active={isActive(`${base}/zap`)}
        >
          <SteelIcon icon={WhatsappBusinessIcon} className='size-5' />
        </GlobalButtonNavigation>
        <div className='w-full h-px bg-secondary' />
        <GlobalButtonNavigation
          linkNavigation={`${base}/settings`}
          description='Ajustes'
          active={isActive(`${base}/settings`)}
        >
          <SteelIcon icon={Settings02Icon} className='size-5' />
        </GlobalButtonNavigation>
      </div>
    </div>
  )
}
