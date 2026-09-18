import type {
  AdminOperationStatus,
  BackupStatus,
  ComponentStatus,
  WorkspaceStatus,
} from '@prisma/client'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Primitivos visuais do painel admin — estilo denso (Axiom-like): bordas
 * finas, tipografia pequena, números tabulares, IDs em monoespaçada. Tudo
 * usa tokens do tema, com cores de status em pares claro/escuro.
 */

/** Bloco com título, ações e conteúdo; `flush` tira o padding (tabelas). */
export function AdminPanel({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
}: {
  title?: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
  className?: string
}) {
  return (
    <section
      className={cn(
        'min-w-0 overflow-hidden rounded-lg border border-border bg-card',
        className,
      )}
    >
      {(title || actions) && (
        <div className='flex flex-wrap items-center justify-between gap-2 border-border border-b px-4 py-2.5'>
          <div className='min-w-0'>
            {title && <h2 className='truncate font-medium text-sm'>{title}</h2>}
            {description && (
              <p className='text-muted-foreground text-xs'>{description}</p>
            )}
          </div>
          {actions && (
            <div className='flex shrink-0 flex-wrap items-center gap-1.5'>
              {actions}
            </div>
          )}
        </div>
      )}
      <div className={flush ? undefined : 'p-4'}>{children}</div>
    </section>
  )
}

export interface Trend {
  /** Diferença absoluta contra o período anterior. */
  delta: number
  label: string
}

/** Métrica compacta: rótulo, número grande tabular, tendência e dica. */
export function StatTile({
  label,
  value,
  hint,
  trend,
  tone = 'default',
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  trend?: Trend
  tone?: 'default' | 'warning' | 'danger'
}) {
  return (
    <div className='min-w-0 rounded-lg border border-border bg-card px-3.5 py-3'>
      <p className='truncate font-medium text-[11px] text-muted-foreground uppercase tracking-wider'>
        {label}
      </p>
      <p
        className={cn(
          'mt-1 truncate font-mono font-semibold text-2xl tabular-nums tracking-tight',
          tone === 'warning' && 'text-amber-600 dark:text-amber-400',
          tone === 'danger' && 'text-destructive',
        )}
      >
        {value}
      </p>
      <div className='mt-1 flex min-h-4 flex-wrap items-center gap-x-2 text-muted-foreground text-xs'>
        {trend && <TrendChip trend={trend} />}
        {hint && <span className='truncate'>{hint}</span>}
      </div>
    </div>
  )
}

function TrendChip({ trend }: { trend: Trend }) {
  const up = trend.delta > 0
  const flat = trend.delta === 0
  return (
    <span
      className={cn(
        'font-mono tabular-nums',
        up && 'text-emerald-600 dark:text-emerald-400',
        !up && !flat && 'text-amber-600 dark:text-amber-400',
      )}
      title={trend.label}
    >
      {flat ? '±0' : `${up ? '▲' : '▼'} ${Math.abs(trend.delta)}`}{' '}
      <span className='font-sans text-muted-foreground'>{trend.label}</span>
    </span>
  )
}

/** ID/slug monoespaçado que trunca sem quebrar o layout (título = valor). */
export function MonoId({
  value,
  className,
}: {
  value: string
  className?: string
}) {
  return (
    <span
      title={value}
      className={cn(
        'inline-block max-w-full truncate align-bottom font-mono text-[11px] text-muted-foreground',
        className,
      )}
    >
      {value}
    </span>
  )
}

type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'muted'

const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  bad: 'border-destructive/30 bg-destructive/10 text-destructive',
  info: 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-400',
  muted: 'border-border bg-muted text-muted-foreground',
}

/** Pílula de status com ponto — mesma linguagem em todas as tabelas. */
export function StatusPill({
  tone,
  children,
  pulse = false,
}: {
  tone: Tone
  children: ReactNode
  pulse?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 font-medium text-[11px]',
        TONE_CLASS[tone],
      )}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full bg-current',
          pulse && 'animate-pulse',
        )}
      />
      {children}
    </span>
  )
}

const WORKSPACE_STATUS: Record<WorkspaceStatus, [Tone, string]> = {
  ACTIVE: ['ok', 'Ativo'],
  SUSPENDED: ['warn', 'Suspenso'],
  DELETING: ['bad', 'Excluindo'],
}

export function WorkspaceStatusPill({ status }: { status: WorkspaceStatus }) {
  const [tone, label] = WORKSPACE_STATUS[status]
  return (
    <StatusPill tone={tone} pulse={status === 'DELETING'}>
      {label}
    </StatusPill>
  )
}

const BACKUP_STATUS: Record<BackupStatus, [Tone, string]> = {
  RUNNING: ['info', 'Em andamento'],
  COMPLETED: ['ok', 'Concluído'],
  FAILED: ['bad', 'Falhou'],
}

export function BackupStatusPill({ status }: { status: BackupStatus }) {
  const [tone, label] = BACKUP_STATUS[status]
  return (
    <StatusPill tone={tone} pulse={status === 'RUNNING'}>
      {label}
    </StatusPill>
  )
}

const OPERATION_STATUS: Record<AdminOperationStatus, [Tone, string]> = {
  QUEUED: ['muted', 'Na fila'],
  RUNNING: ['info', 'Executando'],
  COMPLETED: ['ok', 'Concluída'],
  FAILED: ['bad', 'Falhou'],
}

export function OperationStatusPill({
  status,
}: {
  status: AdminOperationStatus
}) {
  const [tone, label] = OPERATION_STATUS[status]
  return (
    <StatusPill tone={tone} pulse={status === 'RUNNING'}>
      {label}
    </StatusPill>
  )
}

const COMPONENT_STATUS: Record<ComponentStatus, [Tone, string]> = {
  OPERATIONAL: ['ok', 'Operacional'],
  DEGRADED: ['warn', 'Degradado'],
  PARTIAL_OUTAGE: ['warn', 'Falha parcial'],
  MAJOR_OUTAGE: ['bad', 'Fora do ar'],
  MAINTENANCE: ['info', 'Manutenção'],
}

export function ComponentStatusPill({ status }: { status: ComponentStatus }) {
  const [tone, label] = COMPONENT_STATUS[status]
  return <StatusPill tone={tone}>{label}</StatusPill>
}

/** Estado vazio dentro de um painel/tabela. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className='flex flex-col items-center justify-center gap-1 px-4 py-10 text-center'>
      <p className='font-medium text-sm'>{title}</p>
      {description && (
        <p className='max-w-sm text-muted-foreground text-xs'>{description}</p>
      )}
      {action && <div className='pt-2'>{action}</div>}
    </div>
  )
}

/** Falha ao carregar um bloco — o resto da página continua de pé. */
export function ErrorState({
  message = 'Não foi possível carregar estes dados.',
  action,
}: {
  message?: string
  action?: ReactNode
}) {
  return (
    <div
      role='alert'
      className='flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-destructive text-sm'
    >
      <span>{message}</span>
      {action}
    </div>
  )
}

/** Linhas cinzas no formato de uma tabela enquanto carrega. */
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div
      role='status'
      aria-busy='true'
      aria-label='Carregando'
      className='divide-y'
    >
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className='flex items-center gap-3 px-4 py-2.5'>
          <div className='h-3 w-1/3 animate-pulse rounded bg-muted' />
          <div className='h-3 w-1/5 animate-pulse rounded bg-muted' />
          <div className='ml-auto h-3 w-16 animate-pulse rounded bg-muted' />
        </div>
      ))}
    </div>
  )
}

/** Classes da tabela densa (aplicar no `<Table>` do design system). */
export const DENSE_TABLE =
  'text-xs [&_td]:px-4 [&_td]:py-2 [&_th]:h-8 [&_th]:px-4 [&_th]:font-medium [&_th]:text-[11px] [&_th]:text-muted-foreground [&_th]:uppercase [&_th]:tracking-wider'

const numberFormat = new Intl.NumberFormat('pt-BR')
export const formatNumber = (n: number) => numberFormat.format(n)

const brlFormat = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
export const formatBrl = (cents: number) => brlFormat.format(cents / 100)

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`
}

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'America/Sao_Paulo',
})

export const formatDateTime = (iso: string | null) =>
  iso ? dateTimeFormat.format(new Date(iso)) : '—'
export const formatDate = (iso: string | null) =>
  iso ? dateFormat.format(new Date(iso)) : '—'

/** "há 5 min", "há 3 h", "há 2 d" — para colunas de atividade. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(
    0,
    Math.round((now - new Date(iso).getTime()) / 1000),
  )
  if (seconds < 60) return 'agora'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.round(minutes / 60)
  if (hours < 48) return `há ${hours} h`
  return `há ${Math.round(hours / 24)} d`
}
