'use client'

import { Sent02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { use } from 'react'
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

const RECIPIENT_STATUS_LABEL: Record<ChangelogRecipientStatusDTO, string> = {
  PENDING: 'Pendente',
  SENT: 'Enviado',
  FAILED: 'Falhou',
}

export default function AdminChangelogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const { data: changelog, isLoading } = useChangelog(id)
  const start = useStartChangelog()

  async function handleStart() {
    try {
      await start.mutateAsync(id)
      notify.success('Envio iniciado')
    } catch (error) {
      notify.error(error)
    }
  }

  if (isLoading || !changelog) {
    return <div className='w-full p-6 text-muted-foreground'>Carregando…</div>
  }

  return (
    <div className='w-full space-y-6 p-6'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='font-semibold text-lg'>{changelog.subject}</h1>
          <Badge variant='secondary' className='mt-1'>
            {STATUS_LABEL[changelog.status]}
          </Badge>
        </div>
        {changelog.status === 'DRAFT' && (
          <Button size='sm' onClick={handleStart} disabled={start.isPending}>
            <SteelIcon icon={Sent02Icon} strokeWidth={2} />
            {start.isPending ? 'Enviando...' : 'Enviar agora'}
          </Button>
        )}
      </div>

      <div>
        <h2 className='mb-2 font-medium text-sm'>
          Itens ({changelog.items.length})
        </h2>
        <div className='space-y-4'>
          {changelog.items.map((item) => (
            <div key={item.id} className='rounded-md border p-4'>
              <p className='font-medium text-sm'>{item.title}</p>
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className='my-2 max-h-40 rounded-md'
                />
              )}
              <p className='whitespace-pre-line text-muted-foreground text-sm'>
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className='mb-2 font-medium text-sm'>
          Destinatários ({changelog.recipients.length})
        </h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E-mail</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Enviado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changelog.recipients.map((recipient) => (
              <TableRow key={recipient.id}>
                <TableCell>{recipient.email}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      recipient.status === 'FAILED'
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {RECIPIENT_STATUS_LABEL[recipient.status]}
                  </Badge>
                </TableCell>
                <TableCell>
                  {recipient.sentAt
                    ? new Date(recipient.sentAt).toLocaleString('pt-BR')
                    : '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
