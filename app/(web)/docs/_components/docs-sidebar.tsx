'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export interface SidebarSection {
  slug: string
  label: string
  pages: { href: string; title: string }[]
}

export interface SidebarHome {
  href: string
  label: string
}

export const DOCS_HOME: SidebarHome = {
  href: '/docs',
  label: 'Visão geral do manual',
}

interface DocsSidebarProps {
  nav: SidebarSection[]
  /** The site's landing link above the sections. */
  home?: SidebarHome
  /** Called after a link is followed (the mobile sheet closes itself). */
  onNavigate?: () => void
}

export function DocsSidebar({
  nav,
  home = DOCS_HOME,
  onNavigate,
}: DocsSidebarProps) {
  const pathname = usePathname()

  return (
    <nav aria-label='Seções da documentação' className='flex flex-col gap-6'>
      <Link
        href={home.href}
        onClick={onNavigate}
        aria-current={pathname === home.href ? 'page' : undefined}
        className={cn(
          'text-sm font-medium transition-colors hover:text-primary',
          pathname === home.href ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {home.label}
      </Link>
      {nav.map((section) => (
        <div key={section.slug} className='flex flex-col gap-2'>
          <span className='text-sm font-medium text-primary'>
            {section.label}
          </span>
          <ul className='flex flex-col border-l border-border'>
            {section.pages.map((page) => {
              const active = pathname === page.href
              return (
                <li key={page.href}>
                  <Link
                    href={page.href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      '-ml-px block border-l py-1 pl-3 text-sm transition-colors',
                      active
                        ? 'border-primary font-medium text-primary'
                        : 'border-transparent text-muted-foreground hover:border-muted-foreground hover:text-primary',
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
