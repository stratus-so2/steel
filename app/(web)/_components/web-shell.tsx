import type { ReactNode } from 'react'
import { WebFooter } from './footer'
import { WebHeader } from './header/web-header'

interface WebShellProps {
  children: ReactNode
  /** The footer's closing marketing banner; off on informational pages. */
  showBanner?: boolean
}

/**
 * Frame of every public web page: the sticky site header on top, the footer
 * at the bottom. Layouts use it (never pages), so a page cannot end up with
 * two headers or two footers. Anchored sections land below the sticky header
 * (`h-16`, `md:h-[72px]`) instead of under it.
 */
export function WebShell({ children, showBanner = false }: WebShellProps) {
  return (
    <div
      data-web-shell=''
      className='flex min-h-dvh w-full flex-col [&_[id]]:scroll-mt-20 md:[&_[id]]:scroll-mt-24'
    >
      <WebHeader />
      <div className='w-full flex-1'>{children}</div>
      <WebFooter showBanner={showBanner} />
    </div>
  )
}
