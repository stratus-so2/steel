import { Building03Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'
import {
  ContextHeader,
  ContextSidebar,
  NavGroup,
  NavItem,
} from '@/app/_components/navigation/sidebar-context'
import { hasPlatformAdminAccess } from '@/src/lib/platform-admin-guard'

export const metadata: Metadata = {
  title: 'Admin | Steel',
  description: 'Painel admin global da plataforma',
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  if (!(await hasPlatformAdminAccess())) notFound()

  return (
    <>
      <ContextSidebar>
        <ContextHeader title='Admin' />
        <NavGroup>
          <NavItem href='/admin/workspaces' icon={Building03Icon}>
            Workspaces
          </NavItem>
        </NavGroup>
      </ContextSidebar>
      {children}
    </>
  )
}
