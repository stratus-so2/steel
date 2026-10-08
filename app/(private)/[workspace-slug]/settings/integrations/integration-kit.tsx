'use client'

import { Alert02Icon, Copy01Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import type {
  WorkspaceIntegrationDTO,
  WorkspaceIntegrationProviderDTO,
} from '@/types/workspace-integration'

/**
 * Small building blocks of Ajustes > Integrações: status badge, copyable
 * URL, labelled field, a plain select and the date format.
 */

/**
 * Dates are shown in the product time zone (the one of the worker crons),
 * never the browser's, so the page renders the same everywhere.
 */
const DATE_TIME = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
})

export function formatIntegrationDate(iso: string | null): string | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : DATE_TIME.format(date)
}

export function IntegrationStatusBadge({
  provider,
}: {
  provider: WorkspaceIntegrationProviderDTO
}) {
  if (!provider.available) {
    return <Badge variant='secondary'>Indisponível</Badge>
  }
  const connection = provider.connection
  if (!connection) return <Badge variant='outline'>Não conectado</Badge>
  if (connection.status === 'ERROR') {
    return (
      <Badge variant='destructive' className='gap-1'>
        <SteelIcon icon={Alert02Icon} strokeWidth={2} className='size-3' />
        Com erro
      </Badge>
    )
  }
  return <Badge variant='default'>Conectado</Badge>
}

/** Last event / last test lines of a connection. */
export function ConnectionActivity({
  connection,
}: {
  connection: WorkspaceIntegrationDTO
}) {
  const lastEvent = formatIntegrationDate(connection.lastEventAt)
  const lastCheck = formatIntegrationDate(connection.lastCheckedAt)
  return (
    <dl className='grid gap-1 text-xs text-muted-foreground sm:grid-cols-2'>
      <div className='min-w-0'>
        <dt className='inline'>Último evento: </dt>
        <dd className='inline break-words text-foreground'>
          {lastEvent
            ? `${lastEvent}${connection.lastEventType ? ` · ${connection.lastEventType}` : ''}`
            : 'nenhum ainda'}
        </dd>
      </div>
      <div className='min-w-0'>
        <dt className='inline'>Último teste: </dt>
        <dd className='inline text-foreground'>{lastCheck ?? 'nunca'}</dd>
      </div>
    </dl>
  )
}

export function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id?: string
  label: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <Label htmlFor={id} className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
      {hint ? (
        <span className='text-[11px] text-muted-foreground'>{hint}</span>
      ) : null}
    </div>
  )
}

export function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <Field label={label}>
      <div className='flex min-w-0 items-center gap-2'>
        <Input
          readOnly
          value={value}
          aria-label={label}
          className='min-w-0 font-mono text-xs'
        />
        <Button
          type='button'
          variant='outline'
          size='icon'
          aria-label={`Copiar ${label}`}
          onClick={() => {
            void navigator.clipboard?.writeText(value)
            notify.success('Copiado')
          }}
        >
          <SteelIcon icon={Copy01Icon} strokeWidth={2} />
        </Button>
      </div>
    </Field>
  )
}

/** Plain select with labels (`null` = nothing chosen). */
export function PlainSelect({
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  disabled,
  ariaLabel,
}: {
  value: string | null
  onChange: (value: string | null) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
  ariaLabel: string
}) {
  return (
    <Select
      items={options}
      value={value}
      onValueChange={(next) => onChange(next == null ? null : String(next))}
      disabled={disabled}
    >
      <SelectTrigger className='w-full min-w-0' aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
