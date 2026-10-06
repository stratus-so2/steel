'use client'

import { AiBrain01Icon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

/** "Agentes" entry of the Steel AI context sidebar. */
export function SteelAgentsNavLink({ slug }: { slug: string }) {
  const pathname = usePathname()
  const href = `/${slug}/ai/agents`
  const active = pathname === href || pathname.startsWith(`${href}/`)
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
        active && 'bg-secondary font-medium',
      )}
    >
      <SteelIcon icon={AiBrain01Icon} strokeWidth={2} className='size-4' />
      Agentes
    </Link>
  )
}
