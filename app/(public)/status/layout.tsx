import type { ReactNode } from 'react'
import { WebShell } from '@/app/(web)/_components/web-shell'

/**
 * The status pages live in `(public)` but read as part of the public site,
 * like Nexo's `/status` under `(web)`: same header on top, footer without the
 * marketing banner at the bottom. The pages drop their own gutter from `md` up
 * (`md:px-0`), so the side gutter at those widths comes from here.
 */
export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <WebShell>
      <main className='pt-6 pb-16 md:px-8'>{children}</main>
    </WebShell>
  )
}
