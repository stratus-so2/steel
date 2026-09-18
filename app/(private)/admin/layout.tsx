import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  AdminMobileNav,
  AdminSidebarNav,
} from '@/app/_components/admin/shell/admin-nav'
import { hasPlatformAdminAccess } from '@/src/lib/platform-admin-guard'

// Todo o painel depende da sessão (e do gate de admin): navegar para ele
// bloqueia de propósito; o `loading.tsx` cobre a espera.
export const instant = false

export const metadata: Metadata = {
  title: 'Admin | Steel',
  description: 'Painel admin global da plataforma',
}

function Brand() {
  return (
    <Link href='/admin' className='flex items-center gap-2'>
      <span className='font-semibold text-sm tracking-tight'>Steel</span>
      <span className='rounded border border-border px-1.5 py-px font-mono text-[10px] text-muted-foreground uppercase tracking-wider'>
        admin
      </span>
    </Link>
  )
}

/**
 * Casca do painel admin: barra lateral fixa (≥ md) ou faixa de navegação
 * rolável (< md) + área de conteúdo com rolagem própria. `min-w-0` em toda a
 * cadeia flex impede que tabelas largas estourem a página — elas rolam
 * dentro do próprio container.
 */
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  if (!(await hasPlatformAdminAccess())) notFound()

  return (
    <div className='flex h-dvh w-full min-w-0 overflow-hidden bg-background text-foreground'>
      <aside className='hidden w-56 shrink-0 flex-col gap-5 border-border border-r bg-sidebar px-3 py-4 md:flex'>
        <div className='px-2'>
          <Brand />
        </div>
        <AdminSidebarNav />
      </aside>

      <div className='flex min-w-0 flex-1 flex-col'>
        <div className='space-y-2 border-border border-b bg-sidebar px-4 pt-3 pb-2 md:hidden'>
          <Brand />
          <AdminMobileNav />
        </div>
        <main className='min-h-0 min-w-0 flex-1 overflow-y-auto'>
          {children}
        </main>
      </div>
    </div>
  )
}
