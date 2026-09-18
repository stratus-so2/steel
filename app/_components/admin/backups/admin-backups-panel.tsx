'use client'

import { DatabaseSync01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type BackupFilters,
  useAdminBackups,
  useTriggerBackup,
} from '@/src/hooks/use-admin'
import type { AdminWorkspaceSummaryDTO } from '@/types/admin-workspace'
import {
  AdminPanel,
  EmptyState,
  ErrorState,
  StatusPill,
  TableSkeleton,
} from '../shell/admin-ui'
import { AdminBackupsTable } from './admin-backups-table'

const SCOPES: { value: BackupFilters['scope'] | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'FULL', label: 'Completos' },
  { value: 'WORKSPACE', label: 'Por workspace' },
]

function TriggerDialog({
  open,
  onOpenChange,
  workspaces,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspaces: AdminWorkspaceSummaryDTO[]
}) {
  const trigger = useTriggerBackup()
  const [target, setTarget] = useState<string>('FULL')
  const selected = workspaces.find((ws) => ws.id === target)

  async function handleConfirm() {
    try {
      await trigger.mutateAsync(
        target === 'FULL'
          ? { scope: 'FULL' }
          : { scope: 'WORKSPACE', workspaceId: target },
      )
      notify.success('Backup enfileirado — acompanhe na lista')
      onOpenChange(false)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Fazer backup agora</DialogTitle>
          <DialogDescription>
            O worker processa um backup por vez. O completo usa{' '}
            <code className='font-mono text-xs'>pg_dump</code> do banco inteiro
            e depois ganha cópia offsite (se configurada).
          </DialogDescription>
        </DialogHeader>
        <Select
          value={target}
          onValueChange={(value) => setTarget(String(value))}
        >
          <SelectTrigger className='w-full'>
            <span className='truncate'>
              {target === 'FULL'
                ? 'Banco inteiro (completo)'
                : `Workspace: ${selected?.name ?? target}`}
            </span>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false} className='max-h-72'>
            <SelectItem value='FULL'>Banco inteiro (completo)</SelectItem>
            {workspaces
              .filter((ws) => ws.status !== 'DELETING')
              .map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <span className='truncate'>{ws.name}</span>
                  <span className='ml-2 font-mono text-muted-foreground text-xs'>
                    {ws.slug}
                  </span>
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={trigger.isPending}>
            {trigger.isPending ? 'Enfileirando...' : 'Fazer backup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Página de backups: filtros, disparo manual, lista com download/restore. */
export function AdminBackupsPanel({
  workspaces,
}: {
  workspaces: AdminWorkspaceSummaryDTO[]
}) {
  const [scope, setScope] = useState<(typeof SCOPES)[number]['value']>('ALL')
  const [triggerOpen, setTriggerOpen] = useState(false)
  const filters: BackupFilters = scope === 'ALL' ? {} : { scope }
  const { data, isLoading, isError, refetch } = useAdminBackups(filters)

  return (
    <div className='space-y-4'>
      {data && !data.offsiteConfigured && (
        <div
          role='status'
          className='rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 text-xs dark:text-amber-300'
        >
          Cópia offsite <strong>não configurada</strong>: os backups existem só
          no MinIO deste servidor. Veja “Configurar a cópia offsite” no runbook
          de restore.
        </div>
      )}

      <AdminPanel
        flush
        title={
          <div
            role='tablist'
            aria-label='Filtrar por escopo'
            className='-my-1 flex flex-wrap gap-1'
          >
            {SCOPES.map((item) => (
              <button
                key={item.value}
                type='button'
                role='tab'
                aria-selected={scope === item.value}
                onClick={() => setScope(item.value)}
                className={cn(
                  'h-7 rounded-md px-2 font-normal text-xs',
                  scope === item.value
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        }
        actions={
          <>
            {data?.offsiteConfigured && (
              <StatusPill tone='ok'>offsite ativo</StatusPill>
            )}
            <Button size='sm' onClick={() => setTriggerOpen(true)}>
              <SteelIcon icon={DatabaseSync01Icon} strokeWidth={2} />
              Fazer backup
            </Button>
          </>
        }
      >
        {isLoading ? (
          <TableSkeleton />
        ) : isError || !data ? (
          <div className='p-4'>
            <ErrorState
              message='Não foi possível carregar os backups.'
              action={
                <Button size='xs' variant='outline' onClick={() => refetch()}>
                  Tentar de novo
                </Button>
              }
            />
          </div>
        ) : data.backups.length === 0 ? (
          <EmptyState
            title='Nenhum backup'
            description='O backup completo roda todo dia às 03:15; backups de workspace são sob demanda.'
          />
        ) : (
          <AdminBackupsTable backups={data.backups} />
        )}
      </AdminPanel>

      <TriggerDialog
        open={triggerOpen}
        onOpenChange={setTriggerOpen}
        workspaces={workspaces}
      />
    </div>
  )
}
