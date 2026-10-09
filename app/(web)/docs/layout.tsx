import type { ReactNode } from 'react'
import { getDocsNav, getDocsSearchIndex } from '@/src/lib/docs/pages'
import { DocsShell } from './_components/docs-shell'

export default async function DocsLayout({
  children,
}: {
  children: ReactNode
}) {
  const [nav, index] = await Promise.all([getDocsNav(), getDocsSearchIndex()])

  return (
    <DocsShell nav={nav} index={index}>
      {children}
    </DocsShell>
  )
}
