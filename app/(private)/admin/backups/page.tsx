import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminBackupsPanel } from '@/app/_components/admin/backups/admin-backups-panel'
import { AdminOperationsList } from '@/app/_components/admin/backups/admin-operations-list'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { getAuthSession } from '@/src/lib/auth-session'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'

// Página de sessão (admin): bloqueia de propósito; `loading.tsx` cobre.
export const instant = false

export const metadata: Metadata = {
  title: 'Backups | Admin | Steel',
  description: 'Backups completos e por workspace, download e restauração',
}

export default async function AdminBackupsPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  // Só para o seletor de "backup de workspace"; a lista vem por API.
  const workspaces = await AdminWorkspaceService.listWorkspaces(
    session.value.user.id,
  )

  return (
    <AdminPage>
      <AdminPageHeader
        title='Backups'
        crumbs={[{ label: 'Backups' }]}
        description='Completo diário (03:15) + sob demanda. Arquivos cifrados com CONNECTION_SECRETS, retenção de 90 dias.'
      />
      <AdminBackupsPanel workspaces={workspaces.ok ? workspaces.value : []} />
      <AdminOperationsList />
    </AdminPage>
  )
}
