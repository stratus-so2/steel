import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAuthSession } from '@/src/lib/auth-session'
import { AdminChangelogService } from '@/src/services/admin-changelog.service'
import type { ChangelogStatusDTO } from '@/types/changelog'

export const metadata: Metadata = {
  title: 'Changelog | Admin | Steel',
  description: 'Envios de novidades e avisos para usuários da plataforma',
}

const STATUS_LABEL: Record<ChangelogStatusDTO, string> = {
  DRAFT: 'Rascunho',
  QUEUED: 'Na fila',
  RUNNING: 'Enviando',
  DONE: 'Concluído',
  FAILED: 'Falhou',
}

const STATUS_VARIANT: Record<
  ChangelogStatusDTO,
  'secondary' | 'default' | 'destructive'
> = {
  DRAFT: 'secondary',
  QUEUED: 'secondary',
  RUNNING: 'default',
  DONE: 'default',
  FAILED: 'destructive',
}

export default async function AdminChangelogPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminChangelogService.list(session.value.user.id)
  const changelogs = result.ok ? result.value : []

  return (
    <div className='w-full space-y-4 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-semibold text-lg'>Changelog</h1>
          <p className='text-muted-foreground text-sm'>
            {changelogs.length} envio(s) na plataforma
          </p>
        </div>
        <Link href='/admin/changelog/new'>
          <Button size='sm'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo changelog
          </Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assunto</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Destinatários</TableHead>
            <TableHead>Enviados</TableHead>
            <TableHead>Falhas</TableHead>
            <TableHead>Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {changelogs.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={6}
                className='text-center text-muted-foreground'
              >
                Nenhum changelog enviado ainda.
              </TableCell>
            </TableRow>
          ) : (
            changelogs.map((changelog) => (
              <TableRow key={changelog.id}>
                <TableCell>
                  <Link
                    href={`/admin/changelog/${changelog.id}`}
                    className='font-medium text-sm hover:underline'
                  >
                    {changelog.subject}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[changelog.status]}>
                    {STATUS_LABEL[changelog.status]}
                  </Badge>
                </TableCell>
                <TableCell>{changelog.recipientCount}</TableCell>
                <TableCell>{changelog.sentCount}</TableCell>
                <TableCell>{changelog.failedCount}</TableCell>
                <TableCell>
                  {new Date(changelog.createdAt).toLocaleDateString('pt-BR')}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
