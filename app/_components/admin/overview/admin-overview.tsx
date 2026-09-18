import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { AdminOverviewDTO } from '@/types/admin-workspace'
import { AuditActionLabel } from '../shell/admin-labels'
import {
  AdminPanel,
  BackupStatusPill,
  ComponentStatusPill,
  DENSE_TABLE,
  EmptyState,
  ErrorState,
  formatBrl,
  formatBytes,
  formatDateTime,
  formatNumber,
  formatRelative,
  MonoId,
  OperationStatusPill,
  StatTile,
} from '../shell/admin-ui'

const OPERATION_KIND: Record<string, string> = {
  WORKSPACE_DELETE: 'Exclusão',
  WORKSPACE_RESTORE: 'Restauração',
}

function QueuesPanel({ queues }: { queues: AdminOverviewDTO['queues'] }) {
  return (
    <AdminPanel
      title='Filas (BullMQ)'
      description='Contadores ao vivo do Redis · cache de 15 s'
      flush
      className='lg:col-span-2'
    >
      {queues === null ? (
        <div className='p-4'>
          <ErrorState message='O Redis das filas não respondeu. Verifique o steel-redis e o worker.' />
        </div>
      ) : (
        <Table className={DENSE_TABLE}>
          <TableHeader>
            <TableRow>
              <TableHead>Fila</TableHead>
              <TableHead className='text-right'>Aguardando</TableHead>
              <TableHead className='text-right'>Ativos</TableHead>
              <TableHead className='text-right'>Agendados</TableHead>
              <TableHead className='text-right'>Falhas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queues.map((queue) => (
              <TableRow key={queue.name}>
                <TableCell className='font-mono'>{queue.name}</TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {formatNumber(queue.waiting)}
                </TableCell>
                <TableCell className='text-right font-mono tabular-nums'>
                  {formatNumber(queue.active)}
                </TableCell>
                <TableCell className='text-right font-mono text-muted-foreground tabular-nums'>
                  {formatNumber(queue.delayed)}
                </TableCell>
                <TableCell
                  className={cn(
                    'text-right font-mono tabular-nums',
                    queue.failed > 0
                      ? 'text-destructive'
                      : 'text-muted-foreground',
                  )}
                >
                  {formatNumber(queue.failed)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </AdminPanel>
  )
}

function StatusPanel({ status }: { status: AdminOverviewDTO['status'] }) {
  return (
    <AdminPanel
      title='Status da plataforma'
      description='Última coleta de cada componente'
      actions={
        <Link
          href='/status'
          className='text-muted-foreground text-xs hover:text-foreground'
        >
          /status →
        </Link>
      }
      flush
    >
      {status.length === 0 ? (
        <EmptyState
          title='Sem coletas ainda'
          description='O worker grava os probes a cada 1–5 min.'
        />
      ) : (
        <ul className='divide-y'>
          {status.map((row) => (
            <li
              key={row.componentKey}
              className='flex items-center justify-between gap-2 px-4 py-2'
            >
              <div className='min-w-0'>
                <p className='truncate text-xs'>{row.name}</p>
                <p className='font-mono text-[11px] text-muted-foreground'>
                  {row.latencyMs} ms · {formatRelative(row.checkedAt)}
                </p>
              </div>
              <ComponentStatusPill status={row.status} />
            </li>
          ))}
        </ul>
      )}
    </AdminPanel>
  )
}

export function AdminOverview({ data }: { data: AdminOverviewDTO }) {
  const failedJobs =
    data.queues?.reduce((sum, queue) => sum + queue.failed, 0) ?? null

  return (
    <div className='space-y-4'>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6'>
        <StatTile
          label='Workspaces ativos'
          value={formatNumber(data.workspaces.active)}
          hint={`de ${formatNumber(data.workspaces.total)}`}
          trend={{
            delta:
              data.workspaces.createdLast30d - data.workspaces.createdPrev30d,
            label: 'novos vs. 30d ant.',
          }}
        />
        <StatTile
          label='Suspensos'
          value={formatNumber(data.workspaces.suspended)}
          tone={data.workspaces.suspended > 0 ? 'warning' : 'default'}
          hint={
            data.workspaces.deleting > 0
              ? `${data.workspaces.deleting} em exclusão`
              : 'bloqueados pelo admin'
          }
        />
        <StatTile
          label='Em trial'
          value={formatNumber(data.workspaces.trial)}
          hint='trial vigente'
        />
        <StatTile
          label='Usuários'
          value={formatNumber(data.users.total)}
          trend={{
            delta: data.users.createdLast7d - data.users.createdPrev7d,
            label: `${data.users.createdLast7d} em 7d`,
          }}
        />
        <StatTile
          label='MRR'
          value={formatBrl(data.mrr.cents)}
          hint={`${formatNumber(data.mrr.payingWorkspaces)} pagante(s)`}
        />
        <StatTile
          label='Jobs com falha'
          value={failedJobs === null ? '—' : formatNumber(failedJobs)}
          tone={failedJobs ? 'danger' : 'default'}
          hint={failedJobs === null ? 'Redis indisponível' : 'todas as filas'}
        />
      </div>

      {data.operations.some(
        (op) => op.status === 'QUEUED' || op.status === 'RUNNING',
      ) && (
        <AdminPanel title='Operações em andamento' flush>
          <ul className='divide-y'>
            {data.operations
              .filter((op) => op.status === 'QUEUED' || op.status === 'RUNNING')
              .map((op) => (
                <li
                  key={op.id}
                  className='flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs'
                >
                  <span className='min-w-0 truncate'>
                    {OPERATION_KIND[op.kind]} de{' '}
                    <Link
                      href={`/admin/workspaces/${op.workspaceId}`}
                      className='font-mono hover:underline'
                    >
                      {op.workspaceSlug}
                    </Link>{' '}
                    · passo <span className='font-mono'>{op.step}</span>
                  </span>
                  <OperationStatusPill status={op.status} />
                </li>
              ))}
          </ul>
        </AdminPanel>
      )}

      <div className='grid gap-4 lg:grid-cols-3'>
        <StatusPanel status={data.status} />
        <QueuesPanel queues={data.queues} />
      </div>

      <div className='grid gap-4 lg:grid-cols-2'>
        <AdminPanel title='Cadastros recentes' flush>
          {data.recentSignups.length === 0 ? (
            <EmptyState title='Nenhum usuário ainda' />
          ) : (
            <ul className='divide-y'>
              {data.recentSignups.map((user) => (
                <li
                  key={user.id}
                  className='flex items-center justify-between gap-3 px-4 py-2'
                >
                  <div className='min-w-0'>
                    <p className='truncate text-xs'>{user.name}</p>
                    <p className='truncate font-mono text-[11px] text-muted-foreground'>
                      {user.email}
                    </p>
                  </div>
                  <span
                    className='shrink-0 font-mono text-[11px] text-muted-foreground'
                    title={formatDateTime(user.createdAt)}
                  >
                    {formatRelative(user.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>

        <AdminPanel title='Ações recentes do admin' flush>
          {data.recentActions.length === 0 ? (
            <EmptyState
              title='Nenhuma ação registrada'
              description='Suspensões, exclusões, backups e mudanças de módulo aparecem aqui.'
            />
          ) : (
            <ul className='divide-y'>
              {data.recentActions.map((entry) => (
                <li key={entry.id} className='space-y-0.5 px-4 py-2'>
                  <div className='flex items-center justify-between gap-2'>
                    <p className='min-w-0 truncate text-xs'>
                      <AuditActionLabel
                        action={entry.action}
                        failed={entry.failed}
                      />
                      {entry.targetLabel && (
                        <>
                          {' · '}
                          {entry.targetType === 'workspace' &&
                          entry.targetId ? (
                            <Link
                              href={`/admin/workspaces/${entry.targetId}`}
                              className='font-mono hover:underline'
                            >
                              {entry.targetLabel}
                            </Link>
                          ) : (
                            <span className='font-mono'>
                              {entry.targetLabel}
                            </span>
                          )}
                        </>
                      )}
                    </p>
                    <span className='shrink-0 font-mono text-[11px] text-muted-foreground'>
                      {formatRelative(entry.createdAt)}
                    </span>
                  </div>
                  <p className='truncate text-[11px] text-muted-foreground'>
                    {entry.actorEmail}
                    {entry.reason ? ` — ${entry.reason}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title='Últimos backups'
        actions={
          <Link
            href='/admin/backups'
            className='text-muted-foreground text-xs hover:text-foreground'
          >
            Ver todos →
          </Link>
        }
        flush
      >
        {data.recentBackups.length === 0 ? (
          <EmptyState
            title='Nenhum backup registrado'
            description='O backup completo roda todo dia às 03:15.'
          />
        ) : (
          <Table className={DENSE_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>Backup</TableHead>
                <TableHead>Escopo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className='text-right'>Tamanho</TableHead>
                <TableHead>Início</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentBackups.map((backup) => (
                <TableRow key={backup.id}>
                  <TableCell className='max-w-40'>
                    <MonoId value={backup.id} />
                  </TableCell>
                  <TableCell>
                    {backup.scope === 'FULL' ? (
                      'Completo'
                    ) : (
                      <span className='font-mono'>
                        {backup.workspaceSlug ?? backup.workspaceId}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <BackupStatusPill status={backup.status} />
                  </TableCell>
                  <TableCell className='text-right font-mono tabular-nums'>
                    {formatBytes(backup.sizeBytes)}
                  </TableCell>
                  <TableCell className='font-mono text-muted-foreground'>
                    {formatDateTime(backup.startedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminPanel>
    </div>
  )
}
