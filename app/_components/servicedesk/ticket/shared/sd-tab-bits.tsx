'use client'

import type { ReactNode } from 'react'
import { useSdAgents } from '@/src/hooks/use-sd-config'
import { SimpleSelect } from '../../settings/sd-settings-kit'

/** Aviso das abas que são só de agentes (portal não as exibe). */
export function SdAgentOnlyNotice({ children }: { children?: ReactNode }) {
  return (
    <p className='p-4 text-muted-foreground text-sm'>
      {children ?? 'Esta aba é restrita aos agentes do ServiceDesk.'}
    </p>
  )
}

/** Seletor de agente (responsável/técnico). `''` = ninguém. */
export function SdAgentSelect({
  workspaceId,
  value,
  onChange,
  placeholder = 'Selecione',
  emptyLabel = 'Ninguém',
  disabled,
}: {
  workspaceId: string
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  emptyLabel?: string
  disabled?: boolean
}) {
  const agents = useSdAgents(workspaceId)
  const options = (agents.data ?? [])
    .filter((a) => a.isAgent)
    .map((a) => ({ value: a.id, label: a.name }))
  return (
    <SimpleSelect
      value={value}
      onChange={onChange}
      options={options}
      allowEmpty
      emptyLabel={emptyLabel}
      placeholder={placeholder}
      disabled={disabled}
    />
  )
}

export function SdSummaryCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className='flex flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2.5'>
      <span className='text-muted-foreground text-xs'>{label}</span>
      <span className='font-semibold text-lg tabular-nums'>{value}</span>
      {hint ? (
        <span className='text-[11px] text-muted-foreground'>{hint}</span>
      ) : null}
    </div>
  )
}
