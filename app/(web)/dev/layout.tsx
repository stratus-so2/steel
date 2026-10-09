import type { ReactNode } from 'react'
import { DocsShell } from '../docs/_components/docs-shell'
import { DEV_HOME, DEV_NAV } from './dev-nav'

export default function DevLayout({ children }: { children: ReactNode }) {
  return (
    <DocsShell
      nav={DEV_NAV}
      index={[]}
      home={DEV_HOME}
      title='Desenvolvedores'
      description='Integração com a API do Steel'
    >
      {children}
    </DocsShell>
  )
}
