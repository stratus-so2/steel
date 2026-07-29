import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
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
  const workspaces = result.ok ? result.value : []

  return (
    <div className='w-full space-y-4 p-6'>
      <div>
        <h1 className='font-semibold text-lg'>Workspaces</h1>
        <p className='text-muted-foreground text-sm'>
          {workspaces.length} workspace(s) na plataforma
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Membros</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workspaces.map((workspace) => (
            <TableRow key={workspace.id}>
              <TableCell>
                <Link
                  href={`/admin/workspaces/${workspace.id}`}
                  className='font-medium text-sm hover:underline'
                >
                  {workspace.name}
                </Link>
                <p className='text-muted-foreground text-xs'>
                  {workspace.slug}
                </p>
              </TableCell>
              <TableCell>
                <Badge variant='secondary'>{workspace.activePlan}</Badge>
              </TableCell>
              <TableCell>{workspace.memberCount}</TableCell>
              <TableCell>
                {new Date(workspace.createdAt).toLocaleDateString('pt-BR')}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
