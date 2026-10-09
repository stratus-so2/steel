import type { ReactNode } from 'react'
import { getDevNav, getDevSearchIndex } from '@/src/lib/dev/pages'
import { DocsShell } from '../docs/_components/docs-shell'
import { DEV_HOME } from './dev-nav'

export default async function DevLayout({ children }: { children: ReactNode }) {
  const [nav, index] = await Promise.all([getDevNav(), getDevSearchIndex()])

  return (
    <DocsShell
      nav={nav}
      index={index}
      home={DEV_HOME}
      title='Desenvolvedores'
      description='Integração com a API do Steel'
    >
      {children}
    </DocsShell>
  )
}
