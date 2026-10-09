import type { ReactNode } from 'react'
import type { DocsSearchable } from '@/src/lib/docs/search'
import { WebFooter } from '../../_components/footer'
import { DocsMobileNav } from './docs-mobile-nav'
import { DocsSearch } from './docs-search'
import {
  DocsSidebar,
  type SidebarHome,
  type SidebarSection,
} from './docs-sidebar'

interface DocsShellProps {
  nav: SidebarSection[]
  /** Search entries; the search box is hidden when empty. */
  index: DocsSearchable[]
  home?: SidebarHome
  /** Sheet title on mobile. */
  title?: string
  description?: string
  children: ReactNode
}

/**
 * Two-column documentation frame shared by the user manual (`/docs`) and the
 * developer site (`/dev`): sticky sidebar on desktop, a sheet below `lg`.
 */
export function DocsShell({
  nav,
  index,
  home,
  title,
  description,
  children,
}: DocsShellProps) {
  return (
    <>
      <div className='mx-auto w-full px-4 sm:px-8 xl:max-w-336 xl:px-11 2xl:max-w-384'>
        <div className='flex w-full gap-10 lg:border-x lg:border-border'>
          <aside
            aria-label={title ?? 'Documentação'}
            className='sticky top-16 hidden h-[calc(100dvh-4rem)] w-64 md:top-[72px] md:h-[calc(100dvh-72px)] shrink-0 flex-col gap-6 overflow-y-auto border-r border-border py-8 pr-4 pl-4 lg:flex'
          >
            {index.length > 0 && <DocsSearch index={index} />}
            <DocsSidebar nav={nav} home={home} />
          </aside>
          <div className='flex min-w-0 flex-1 flex-col'>
            <div className='sticky top-16 z-30 flex items-center md:top-[72px] border-b border-border bg-background py-3 lg:hidden'>
              <DocsMobileNav
                nav={nav}
                index={index}
                home={home}
                title={title}
                description={description}
              />
            </div>
            {children}
          </div>
        </div>
      </div>
      <WebFooter showBanner={false} />
    </>
  )
}
