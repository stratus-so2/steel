'use client'

import { DatabaseSync01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import {
  useAdminBackups,
  useAdminWorkspaceAudit,
  useTriggerBackup,
} from '@/src/hooks/use-admin'
import { AdminBackupsTable } from '../backups/admin-backups-table'
import { AuditActionLabel } from '../shell/admin-labels'
import {
  AdminPanel,
  EmptyState,
  ErrorState,
  formatDateTime,
  TableSkeleton,
} from '../shell/admin-ui'

/** Backups só deste workspace, com "backup agora". */
export function WorkspaceBackupsSection({
  workspaceId,
  disabled = false,
}: {
  workspaceId: string
  disabled?: boolean
}) {
  const { data, isLoading, isError } = useAdminBackups({ workspaceId })
  const trigger = useTriggerBackup()

  async function handleBackup() {
    try {
      await trigger.mutateAsync({ scope: 'WORKSPACE', workspaceId })
      notify.success('Backup do workspace enfileirado')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <AdminPanel
      title='Backups deste workspace'
      description='JSON cifrado com os dados do workspace (sem arquivos)'
      flush
      actions={
        <Button
          size='sm'
          variant='outline'
          disabled={disabled || trigger.isPending}
          onClick={handleBackup}
        >
          <SteelIcon icon={DatabaseSync01Icon} strokeWidth={2} />
          {trigger.isPending ? 'Enfileirando...' : 'Backup agora'}
        </Button>
      }
    >
      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : isError || !data ? (
        <div className='p-4'>
          <ErrorState message='Não foi possível carregar os backups.' />
        </div>
      ) : data.backups.length === 0 ? (
        <EmptyState
          title='Nenhum backup deste workspace'
          description='Faça um antes de operações arriscadas — a exclusão faz um automaticamente.'
        />
      ) : (
        <AdminBackupsTable backups={data.backups} showWorkspace={false} />
      )}
    </AdminPanel>
  )
}

/** Trilha do admin global sobre este workspace. */
export function WorkspaceAuditSection({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data, isLoading, isError } = useAdminWorkspaceAudit(workspaceId)

  return (
    <AdminPanel title='Histórico do admin' flush>
      {isLoading ? (
        <TableSkeleton rows={3} />
      ) : isError || !data ? (
        <div className='p-4'>
          <ErrorState message='Não foi possível carregar o histórico.' />
        </div>
      ) : data.length === 0 ? (
        <EmptyState title='Nenhuma ação do admin neste workspace' />
      ) : (
        <ul className='divide-y'>
          {data.map((entry) => (
            <li
              key={entry.id}
              className='grid gap-x-3 gap-y-0.5 px-4 py-2 text-xs sm:grid-cols-[9rem_1fr]'
            >
              <span className='font-mono text-muted-foreground'>
                {formatDateTime(entry.createdAt)}
              </span>
              <div className='min-w-0'>
                <p className='truncate'>
                  <AuditActionLabel
                    action={entry.action}
                    failed={entry.failed}
                  />{' '}
                  <span className='text-muted-foreground'>
                    por {entry.actorEmail}
                  </span>
                </p>
                {entry.reason && (
                  <p className='wrap-break-word text-muted-foreground'>
                    “{entry.reason}”
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  )
}
