import type { ReactNode } from 'react'
import { WebFooter } from '@/app/(web)/_components/footer'
import { WebHeader } from '@/app/(web)/_components/header/web-header'

/**
 * The status pages live in `(public)` but read as part of the public site,
 * like Nexo's `/status` under `(web)`: same header on top, footer without the
 * marketing banner at the bottom.
 */
export default function StatusLayout({ children }: { children: ReactNode }) {
  return (
    <div className='w-full'>
      <WebHeader />
      <main className='pt-6 pb-16'>{children}</main>
      <WebFooter showBanner={false} />
    </div>
  )
}
