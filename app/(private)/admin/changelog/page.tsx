import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import {
  AdminPanel,
  DENSE_TABLE,
  EmptyState,
  ErrorState,
  formatDate,
  StatusPill,
} from '@/app/_components/admin/shell/admin-ui'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
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

const STATUS_TONE: Record<ChangelogStatusDTO, 'muted' | 'info' | 'ok' | 'bad'> =
  {
    DRAFT: 'muted',
    QUEUED: 'muted',
    RUNNING: 'info',
    DONE: 'ok',
    FAILED: 'bad',
  }

export default async function AdminChangelogPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminChangelogService.list(session.value.user.id)
  const changelogs = result.ok ? result.value : []

  return (
    <AdminPage>
      <AdminPageHeader
        title='Changelog'
        crumbs={[{ label: 'Changelog' }]}
        description={
          result.ok ? `${changelogs.length} envio(s) na plataforma` : undefined
        }
        actions={
          <Button
            size='sm'
            nativeButton={false}
            render={<Link href='/admin/changelog/new' />}
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo changelog
          </Button>
        }
      />

      {!result.ok ? (
        <ErrorState message='Não foi possível carregar os changelogs.' />
      ) : (
        <AdminPanel flush>
          {changelogs.length === 0 ? (
            <EmptyState
              title='Nenhum changelog enviado ainda'
              description='Crie um rascunho, revise os itens e envie para os destinatários.'
            />
          ) : (
            <Table className={DENSE_TABLE}>
              <TableHeader>
                <TableRow>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className='text-right'>Destinatários</TableHead>
                  <TableHead className='text-right'>Enviados</TableHead>
                  <TableHead className='text-right'>Falhas</TableHead>
                  <TableHead>Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changelogs.map((changelog) => (
                  <TableRow key={changelog.id}>
                    <TableCell className='max-w-96'>
                      <Link
                        href={`/admin/changelog/${changelog.id}`}
                        className='block truncate font-medium text-sm hover:underline'
                        title={changelog.subject}
                      >
                        {changelog.subject}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={STATUS_TONE[changelog.status]}>
                        {STATUS_LABEL[changelog.status]}
                      </StatusPill>
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {changelog.recipientCount}
                    </TableCell>
                    <TableCell className='text-right font-mono tabular-nums'>
                      {changelog.sentCount}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'text-right font-mono tabular-nums',
                        changelog.failedCount > 0
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      )}
                    >
                      {changelog.failedCount}
                    </TableCell>
                    <TableCell className='font-mono text-muted-foreground'>
                      {formatDate(changelog.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </AdminPanel>
      )}
    </AdminPage>
  )
}
