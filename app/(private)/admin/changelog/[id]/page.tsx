'use client'

import { Sent02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { use } from 'react'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import {
  AdminPanel,
  DENSE_TABLE,
  EmptyState,
  ErrorState,
  formatDateTime,
  StatTile,
  StatusPill,
  TableSkeleton,
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
import { notify } from '@/lib/notify'
import { useChangelog, useStartChangelog } from '@/src/hooks/use-changelog'
import type {
  ChangelogRecipientStatusDTO,
  ChangelogStatusDTO,
} from '@/types/changelog'

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

const RECIPIENT_STATUS: Record<
  ChangelogRecipientStatusDTO,
  ['muted' | 'ok' | 'bad', string]
> = {
  PENDING: ['muted', 'Pendente'],
  SENT: ['ok', 'Enviado'],
  FAILED: ['bad', 'Falhou'],
}

const CRUMBS = [{ label: 'Changelog', href: '/admin/changelog' }]

export default function AdminChangelogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: changelog, isLoading, isError } = useChangelog(id)
  const start = useStartChangelog()

  async function handleStart() {
    try {
      await start.mutateAsync(id)
      notify.success('Envio iniciado')
    } catch (error) {
      notify.error(error)
    }
  }

  if (isLoading) {
    return (
      <AdminPage>
        <AdminPageHeader
          title='Carregando…'
          crumbs={[...CRUMBS, { label: '…' }]}
        />
        <div className='rounded-lg border border-border'>
          <TableSkeleton rows={4} />
        </div>
      </AdminPage>
    )
  }

  if (isError || !changelog) {
    return (
      <AdminPage>
        <AdminPageHeader
          title='Changelog'
          crumbs={[...CRUMBS, { label: 'Não encontrado' }]}
        />
        <ErrorState message='Não foi possível carregar este changelog.' />
      </AdminPage>
    )
  }

  const sent = changelog.recipients.filter((r) => r.status === 'SENT').length
  const failed = changelog.recipients.filter(
    (r) => r.status === 'FAILED',
  ).length

  return (
    <AdminPage>
      <AdminPageHeader
        title={changelog.subject}
        crumbs={[...CRUMBS, { label: changelog.subject }]}
        meta={
          <StatusPill
            tone={STATUS_TONE[changelog.status]}
            pulse={changelog.status === 'RUNNING'}
          >
            {STATUS_LABEL[changelog.status]}
          </StatusPill>
        }
        actions={
          changelog.status === 'DRAFT' && (
            <Button size='sm' onClick={handleStart} disabled={start.isPending}>
              <SteelIcon icon={Sent02Icon} strokeWidth={2} />
              {start.isPending ? 'Enviando...' : 'Enviar agora'}
            </Button>
          )
        }
      />

      <div className='grid grid-cols-3 gap-3'>
        <StatTile label='Destinatários' value={changelog.recipients.length} />
        <StatTile label='Enviados' value={sent} />
        <StatTile
          label='Falhas'
          value={failed}
          tone={failed > 0 ? 'danger' : 'default'}
        />
      </div>

      <AdminPanel title={`Itens (${changelog.items.length})`}>
        <div className='space-y-3'>
          {changelog.items.map((item) => (
            <article
              key={item.id}
              className='min-w-0 space-y-2 rounded-md border border-border p-3'
            >
              <p className='wrap-break-word font-medium text-sm'>
                {item.title}
              </p>
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className='max-h-40 max-w-full rounded-md object-contain'
                />
              )}
              <p className='wrap-break-word whitespace-pre-line text-muted-foreground text-sm'>
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel
        title={`Destinatários (${changelog.recipients.length})`}
        flush
      >
        {changelog.recipients.length === 0 ? (
          <EmptyState title='Sem destinatários' />
        ) : (
          <Table className={DENSE_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>E-mail</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Enviado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {changelog.recipients.map((recipient) => {
                const [tone, label] = RECIPIENT_STATUS[recipient.status]
                return (
                  <TableRow key={recipient.id}>
                    <TableCell className='max-w-80 truncate font-mono'>
                      {recipient.email}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={tone}>{label}</StatusPill>
                    </TableCell>
                    <TableCell className='font-mono text-muted-foreground'>
                      {formatDateTime(recipient.sentAt)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </AdminPanel>
    </AdminPage>
  )
}
