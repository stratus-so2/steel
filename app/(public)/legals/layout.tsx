import type { ReactNode } from 'react'
import { WebShell } from '@/app/(web)/_components/web-shell'

/**
 * Terms, privacy, security, subprocessors and the trust center are part of
 * the public site: they get its header and footer. They stay in `(public)`
 * only because their URLs and metadata predate the `(web)` group.
 */
export default function LegalsLayout({ children }: { children: ReactNode }) {
  return <WebShell>{children}</WebShell>
}
