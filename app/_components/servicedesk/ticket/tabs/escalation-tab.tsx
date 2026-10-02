'use client'

import {
  ArrowRight01Icon,
  ArrowUpDoubleIcon,
  Building03Icon,
  UserIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfig } from '@/src/hooks/use-sd-config'
import {
  useEscalateSdTicket,
  useSdTicketEscalations,
} from '@/src/hooks/use-sd-tickets'
import type { SdAgentDTO, SdDepartmentTreeDTO } from '@/types/sd-config'
import { SdOptionSelect } from '../sd-option-select'
import { SdUserAvatar } from '../sd-ticket-badges'
import { SD_TONE, SD_TONE_TEXT, sdFormatDateTime } from '../sd-ticket-meta'
import { sdDepartmentOptions } from '../sd-ticket-options'
import type { SdTicketTabProps } from './types'

type Kind = 'FUNCTIONAL' | 'HIERARCHICAL'

function departmentName(
  tree: SdDepartmentTreeDTO[],
  id: string | null,
): string | null {
  if (!id) return null
  for (const root of tree) {
    if (root.id === id) return root.name
    const child = root.children.find((c) => c.id === id)
    if (child) return child.name
  }
  return null
}

/**
 * Candidatos do escalonamento: funcional = membros do departamento de
 * destino; hierárquico = líderes (do departamento atual ou de qualquer um).
 */
export function sdEscalationCandidates(
  agents: SdAgentDTO[],
  kind: Kind,
  departmentId: string | null,
): SdAgentDTO[] {
  if (kind === 'FUNCTIONAL') {
    if (!departmentId) return []
    return agents.filter((a) =>
      a.departments.some((d) => d.departmentId === departmentId),
    )
  }
  const leads = agents.filter((a) =>
    a.departments.some(
      (d) => d.isLead && (!departmentId || d.departmentId === departmentId),
    ),
  )
  return leads.length > 0
    ? leads
    : agents.filter((a) => a.departments.some((d) => d.isLead))
}

/**
 * Escalonamento: histórico (manual e automático) e formulário para
 * escalonar — funcional (outro departamento) ou hierárquico (líder /
 * nível +1), com responsável opcional e motivo.
 */
export function SdTicketEscalationTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const config = useSdConfig(workspaceId)
  const agents = useSdAgents(workspaceId)
  const history = useSdTicketEscalations(workspaceId, ticket.id)
  const escalate = useEscalateSdTicket(workspaceId, ticket.id)
  const [kind, setKind] = useState<Kind>('FUNCTIONAL')
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const departments = config.data?.departments ?? []
  const candidates = sdEscalationCandidates(
    agents.data ?? [],
    kind,
    kind === 'FUNCTIONAL' ? departmentId : (ticket.department?.id ?? null),
  )
  const agentName = (id: string | null) =>
    id ? (agents.data?.find((a) => a.id === id)?.name ?? null) : null

  function submit() {
    setError(null)
    if (kind === 'FUNCTIONAL' && !departmentId) {
      setError('Escolha o departamento de destino.')
      return
    }
    if (!reason.trim()) {
      setError('Informe o motivo do escalonamento.')
      return
    }
    escalate.mutate(
      {
        kind,
        reason: reason.trim(),
        ...(kind === 'FUNCTIONAL' && departmentId
          ? { toDepartmentId: departmentId }
          : {}),
        ...(userId ? { toUserId: userId } : {}),
      },
      {
        onSuccess: ({ ticket: updated }) => {
          notify.success(
            `Chamado escalonado para o nível ${updated.escalationLevel}.`,
          )
          setReason('')
          setUserId(null)
          setDepartmentId(null)
        },
        onError: (e) => setError(e.message),
      },
    )
  }

  const items = history.data ?? []

  return (
    <div className='grid gap-6 p-4 lg:grid-cols-[minmax(0,1fr)_20rem]'>
      <section className='flex flex-col gap-3'>
        <div className='flex items-center gap-2'>
          <h3 className='font-semibold text-sm'>Histórico</h3>
          <span
            className={cn('rounded-md px-1.5 font-medium text-xs', SD_TONE.orange)}
          >
            Nível atual: N{ticket.escalationLevel}
          </span>
        </div>
        {history.isLoading ? (
          <Skeleton className='h-20 w-full' />
        ) : items.length === 0 ? (
          <p className='rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm'>
            Este chamado ainda não foi escalonado.
          </p>
        ) : (
          <ol className='flex flex-col gap-2'>
            {items.map((e) => {
              const fromDept = departmentName(departments, e.fromDepartmentId)
              const toDept = departmentName(departments, e.toDepartmentId)
              return (
                <li
                  key={e.id}
                  className='flex flex-col gap-2 rounded-lg border bg-card/60 p-3'
                >
                  <div className='flex flex-wrap items-center gap-2 text-sm'>
                    <span
                      className={cn(
                        'rounded-md px-1.5 py-0.5 font-medium text-xs',
                        KIND_TONE[e.kind],
                      )}
                    >
                      {e.kind === 'HIERARCHICAL' ? 'Hierárquico' : 'Funcional'}
                    </span>
                    <span className='inline-flex items-center gap-1 font-mono text-xs'>
                      N{e.fromLevel}
                      <SteelIcon
                        icon={ArrowRight01Icon}
                        strokeWidth={2}
                        className='size-3'
                      />
                      N{e.toLevel}
                    </span>
                    {e.automatic ? (
                      <span
                        className={cn(
                          'rounded-md px-1.5 py-0.5 text-xs',
                          SD_TONE.amber,
                        )}
                      >
                        Automático
                      </span>
                    ) : null}
                    <span className='ml-auto text-muted-foreground text-xs tabular-nums'>
                      {sdFormatDateTime(e.createdAt)}
                    </span>
                  </div>
                  {fromDept || toDept || e.toAssigneeId ? (
                    <div className='flex flex-wrap items-center gap-2 text-muted-foreground text-xs'>
                      {fromDept || toDept ? (
                        <span className='inline-flex items-center gap-1'>
                          <SteelIcon
                            icon={Building03Icon}
                            strokeWidth={2}
                            className='size-3'
                          />
                          {fromDept ?? '—'} → {toDept ?? fromDept ?? '—'}
                        </span>
                      ) : null}
                      {e.toAssigneeId ? (
                        <span className='inline-flex items-center gap-1'>
                          <SteelIcon
                            icon={UserIcon}
                            strokeWidth={2}
                            className='size-3'
                          />
                          {agentName(e.toAssigneeId) ?? 'Responsável'}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <p className='text-sm'>{e.reason}</p>
                  {e.createdBy ? (
                    <span className='flex items-center gap-1.5 text-muted-foreground text-xs'>
                      <SdUserAvatar user={e.createdBy} className='size-4' />
                      {e.createdBy.name}
                    </span>
                  ) : null}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {mode === 'agent' ? (
        <form
          className='flex h-fit flex-col gap-3 rounded-xl border bg-card/60 p-4'
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <h3 className='flex items-center gap-2 font-semibold text-sm'>
            <SteelIcon
              icon={ArrowUpDoubleIcon}
              strokeWidth={2}
              className={cn('size-4', SD_TONE_TEXT.orange)}
            />
            Escalonar chamado
          </h3>
          <fieldset
            aria-label='Tipo de escalonamento'
            className='grid grid-cols-2 gap-1 rounded-lg bg-muted p-1'
          >
            {(['FUNCTIONAL', 'HIERARCHICAL'] as const).map((k) => (
              <button
                key={k}
                type='button'
                aria-pressed={kind === k}
                onClick={() => {
                  setKind(k)
                  setUserId(null)
                }}
                className={cn(
                  'rounded-md px-2 py-1 text-xs',
                  kind === k
                    ? 'bg-background font-medium shadow-sm'
                    : 'text-muted-foreground',
                )}
              >
                {k === 'FUNCTIONAL' ? 'Funcional' : 'Hierárquico'}
              </button>
            ))}
          </fieldset>
          <p className='text-muted-foreground text-xs'>
            {kind === 'FUNCTIONAL'
              ? 'Transfere para outro departamento (ou especialista).'
              : 'Sobe um nível: líder do time ou gestor.'}
          </p>
          {kind === 'FUNCTIONAL' ? (
            <div className='flex flex-col gap-1.5'>
              <Label htmlFor='sd-esc-dept' className='text-xs'>
                Departamento de destino
              </Label>
              <SdOptionSelect
                id='sd-esc-dept'
                aria-label='Departamento de destino'
                value={departmentId}
                onChange={(v) => {
                  setDepartmentId(v)
                  setUserId(null)
                }}
                options={sdDepartmentOptions(departments).filter(
                  (o) => o.value !== ticket.department?.id,
                )}
              />
            </div>
          ) : null}
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-esc-user' className='text-xs'>
              {kind === 'FUNCTIONAL' ? 'Responsável (opcional)' : 'Líder'}
            </Label>
            <SdOptionSelect
              id='sd-esc-user'
              aria-label='Responsável do escalonamento'
              value={userId}
              onChange={setUserId}
              placeholder={
                kind === 'FUNCTIONAL' && !departmentId
                  ? 'Escolha o departamento'
                  : 'Automático'
              }
              noneLabel='Automático'
              options={candidates.map((a) => ({ value: a.id, label: a.name }))}
            />
          </div>
          <div className='flex flex-col gap-1.5'>
            <Label htmlFor='sd-esc-reason' className='text-xs'>
              Motivo
            </Label>
            <Textarea
              id='sd-esc-reason'
              rows={3}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='Por que escalonar? Ex.: requer acesso ao firewall.'
            />
          </div>
          {error ? (
            <p className='text-destructive text-xs' role='alert'>
              {error}
            </p>
          ) : null}
          <Button type='submit' disabled={escalate.isPending}>
            {escalate.isPending ? 'Escalonando…' : 'Escalonar'}
          </Button>
        </form>
      ) : null}
    </div>
  )
}
