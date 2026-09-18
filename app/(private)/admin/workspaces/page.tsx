import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { ErrorState } from '@/app/_components/admin/shell/admin-ui'
import { AdminWorkspacesTable } from '@/app/_components/admin/workspaces/admin-workspaces-table'
import { getAuthSession } from '@/src/lib/auth-session'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'

export const metadata: Metadata = {
  title: 'Workspaces | Admin | Steel',
  description: 'Todos os workspaces da plataforma',
}

export default async function AdminWorkspacesPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminWorkspaceService.listWorkspaces(
    session.value.user.id,
  )

  return (
    <AdminPage>
      <AdminPageHeader
        title='Workspaces'
        crumbs={[{ label: 'Workspaces' }]}
        description={
          result.ok
            ? `${result.value.length} workspace(s) na plataforma`
            : undefined
        }
      />
      {result.ok ? (
        <AdminWorkspacesTable workspaces={result.value} />
      ) : (
        <ErrorState message='Não foi possível carregar os workspaces.' />
      )}
    </AdminPage>
  )
}
