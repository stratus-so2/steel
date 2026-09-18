'use client'

import {
  DatabaseRestoreIcon,
  Download04Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useState } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { notify } from '@/lib/notify'
import { useDownloadBackup, useRestoreBackup } from '@/src/hooks/use-admin'
import type { AdminBackupDTO } from '@/types/admin-workspace'
import {
  BackupStatusPill,
  DENSE_TABLE,
  formatBytes,
  formatDateTime,
  MonoId,
  StatusPill,
} from '../shell/admin-ui'
import { ConfirmActionDialog } from '../shell/confirm-action-dialog'

function Locations({ backup }: { backup: AdminBackupDTO }) {
  if (!backup.locations.local && !backup.locations.offsite) {
    return <span className='text-muted-foreground'>—</span>
  }
  return (
    <div className='flex gap-1'>
      {backup.locations.local && <StatusPill tone='muted'>MinIO</StatusPill>}
      {backup.locations.offsite && <StatusPill tone='info'>offsite</StatusPill>}
    </div>
  )
}

function WorkspaceCell({ backup }: { backup: AdminBackupDTO }) {
  if (backup.scope === 'FULL') {
    return <span className='text-muted-foreground'>Banco inteiro</span>
  }
  const label = backup.workspaceSlug ?? backup.workspaceId ?? '—'
  return (
    <div className='flex min-w-0 items-center gap-1.5'>
      {backup.workspaceExists && backup.workspaceId ? (
        <Link
          href={`/admin/workspaces/${backup.workspaceId}`}
          className='truncate font-mono hover:underline'
          title={label}
        >
          {label}
        </Link>
      ) : (
        <span className='truncate font-mono' title={label}>
          {label}
        </span>
      )}
      {!backup.workspaceExists && <StatusPill tone='bad'>excluído</StatusPill>}
    </div>
  )
}

/**
 * Tabela de backups com download (link assinado de 5 min) e restauração de
 * backups de workspace (job; confirmação digitando o slug). Backup completo
 * não restaura pelo painel — só pelo runbook.
 */
export function AdminBackupsTable({
  backups,
  showWorkspace = true,
}: {
  backups: AdminBackupDTO[]
  showWorkspace?: boolean
}) {
  const download = useDownloadBackup()
  const restore = useRestoreBackup()
  const [restoring, setRestoring] = useState<AdminBackupDTO | null>(null)

  async function handleDownload(id: string) {
    try {
      await download.mutateAsync(id)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <>
      <Table className={DENSE_TABLE}>
        <TableHeader>
          <TableRow>
            <TableHead>Início</TableHead>
            {showWorkspace && <TableHead>Escopo</TableHead>}
            <TableHead>Status</TableHead>
            <TableHead className='text-right'>Tamanho</TableHead>
            <TableHead>Local</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>ID</TableHead>
            <TableHead className='text-right'>
              <span className='sr-only'>Ações</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {backups.map((backup) => {
            const completed = backup.status === 'COMPLETED'
            const restorable = completed && backup.scope === 'WORKSPACE'
            return (
              <TableRow key={backup.id}>
                <TableCell className='font-mono'>
                  {formatDateTime(backup.startedAt)}
                </TableCell>
                {showWorkspace && (
                  <TableCell className='max-w-56'>
                    <WorkspaceCell backup={backup} />
                  </TableCell>
                )}
                <TableCell>
                  {backup.status === 'FAILED' && backup.errorMessage ? (
                    <Tooltip>
                      <TooltipTrigger render={<span />}>
                        <BackupStatusPill status={backup.status} />
                      </TooltipTrigger>
                      <TooltipContent className='max-w-xs'>
                        {backup.errorMessage}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <BackupStatusPill status={backup.status} />
                  )}
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {formatBytes(backup.sizeBytes)}
                </TableCell>
                <TableCell>
                  <Locations backup={backup} />
                </TableCell>
                <TableCell className='text-muted-foreground'>
                  {backup.triggeredBy === 'admin' ? 'Painel' : 'Agendado/CLI'}
                </TableCell>
                <TableCell className='max-w-32'>
                  <MonoId value={backup.id} />
                </TableCell>
                <TableCell className='text-right'>
                  <div className='flex justify-end gap-1'>
                    <Button
                      size='icon-xs'
                      variant='ghost'
                      disabled={!completed || download.isPending}
                      aria-label={`Baixar backup ${backup.id}`}
                      title='Baixar (arquivo cifrado)'
                      onClick={() => handleDownload(backup.id)}
                    >
                      <SteelIcon icon={Download04Icon} strokeWidth={2} />
                    </Button>
                    {backup.scope === 'WORKSPACE' && (
                      <Button
                        size='icon-xs'
                        variant='ghost'
                        disabled={!restorable}
                        aria-label={`Restaurar backup ${backup.id}`}
                        title='Restaurar este workspace'
                        onClick={() => setRestoring(backup)}
                      >
                        <SteelIcon icon={DatabaseRestoreIcon} strokeWidth={2} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      {restoring && (
        <ConfirmActionDialog
          open
          onOpenChange={(open) => !open && setRestoring(null)}
          title='Restaurar workspace'
          destructive
          requireSlug={restoring.workspaceSlug ?? undefined}
          pending={restore.isPending}
          pendingLabel='Enfileirando...'
          confirmLabel='Restaurar'
          description={
            <div className='space-y-2'>
              <p>
                Substitui <strong>todos</strong> os dados atuais do workspace
                pelo estado de {formatDateTime(restoring.startedAt)}. Antes, o
                worker tira um backup de segurança do estado atual.
              </p>
              <p>
                Arquivos (mídias, anexos) não fazem parte do backup e não são
                restaurados.
              </p>
            </div>
          }
          onConfirm={async (values) => {
            try {
              await restore.mutateAsync({ backupId: restoring.id, ...values })
              notify.success('Restauração enfileirada')
              setRestoring(null)
            } catch (error) {
              notify.error(error)
            }
          }}
        />
      )}
    </>
  )
}
