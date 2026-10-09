import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { SITE_DESCRIPTION, SITE_TITLE } from '@/src/lib/seo/site'
import { WebShell } from './_components/web-shell'

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
}

export default function WebLayout({ children }: { children: ReactNode }) {
  return <WebShell>{children}</WebShell>
}
