import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AdminModuleAccessPanel } from '@/app/_components/admin/admin-module-access-panel'
import { CrmMembersSection } from '@/app/_components/settings/crm-members-section'
import { CrmProfilesSection } from '@/app/_components/settings/crm-profiles-section'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getAuthSession } from '@/src/lib/auth-session'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'

export const metadata: Metadata = {
  title: 'Workspace | Admin | Steel',
  description: 'Membros, perfis e módulos de um workspace',
}

const ADMIN_BASE_PATH = '/api/admin/workspaces'

export default async function AdminWorkspaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminWorkspaceService.getWorkspace(
    session.value.user.id,
    id,
  )
  if (!result.ok) notFound()

  const workspace = result.value

  return (
    <div className='w-full space-y-6 p-6'>
      <div>
        <h1 className='font-semibold text-lg'>{workspace.name}</h1>
        <p className='text-muted-foreground text-sm'>{workspace.slug}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Módulos liberados</CardTitle>
        </CardHeader>
        <CardContent>
          <AdminModuleAccessPanel workspaceId={workspace.id} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
        </CardHeader>
        <CardContent>
          <CrmMembersSection
            workspaceId={workspace.id}
            basePath={ADMIN_BASE_PATH}
          />
        </CardContent>
      </Card>

      <CrmProfilesSection
        workspaceId={workspace.id}
        basePath={ADMIN_BASE_PATH}
      />
    </div>
  )
}
