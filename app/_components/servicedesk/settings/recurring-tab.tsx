'use client'

import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  HistoryIcon,
  PencilEdit02Icon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  SdConfigItemPicker,
  SdCustomerPicker,
} from '@/app/_components/servicedesk/pickers'
import {
  formatSdOccurrence,
  SD_RUN_STATUS_LABEL,
  SD_RUN_STATUS_TONE,
  sdScheduleOf,
} from '@/app/_components/servicedesk/recurring/sd-recurring-bits'
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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents } from '@/src/hooks/use-sd-config'
import {
  useCreateSdRecurringTicket,
  useDeleteSdRecurringTicket,
  useRunSdRecurringTicketNow,
  useSdRecurringRuns,
  useSdRecurringTickets,
  useUpdateSdRecurringTicket,
} from '@/src/hooks/use-sd-recurring-tickets'
import {
  describeSdRecurrence,
  nextSdOccurrences,
  SD_WEEKDAY_LABELS,
  type SdRecurrenceSchedule,
  sdRecurrenceProblem,
} from '@/src/lib/servicedesk/recurrence'
import type { CreateSdRecurringTicketDTO } from '@/src/schemas/sd-recurring-ticket.schema'
import type { SdTicketTypeDTO } from '@/types/sd-config'
import type { SdRecurringTicketDTO } from '@/types/sd-recurring-ticket'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  NumberInput,
  SD_TICKET_TYPE_LABEL,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Recorrentes": rotinas periódicas (manutenção preventiva) que abrem
 * chamado sozinhas. A lista mostra a próxima execução; o editor pré-visualiza
 * as próximas ocorrências com a **mesma lib** que o worker usa
 * (`src/lib/servicedesk/recurrence.ts`), então o que a tela promete é o que
 * acontece.
 */

const FREQUENCY_OPTIONS = [
  { value: 'DAILY' as const, label: 'Diária' },
  { value: 'WEEKLY' as const, label: 'Semanal' },
  { value: 'MONTHLY' as const, label: 'Mensal' },
  { value: 'YEARLY' as const, label: 'Anual' },
]

const TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Fortaleza',
  'America/Cuiaba',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
].map((value) => ({ value, label: value }))

/* ------------------------------- Lista ---------------------------------- */

export function SdRecurringTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading, error } = useSdRecurringTickets(workspaceId, {
    includeInactive: true,
  })
  const update = useUpdateSdRecurringTicket(workspaceId)
  const remove = useDeleteSdRecurringTicket(workspaceId)
  const runNow = useRunSdRecurringTicketNow(workspaceId)
  const [editing, setEditing] = useState<
    { mode: 'create' } | { mode: 'edit'; rule: SdRecurringTicketDTO } | null
  >(null)
  const [history, setHistory] = useState<SdRecurringTicketDTO | null>(null)
  const rules = data ?? []

  return (
    <SettingsSection
      title='Rotinas recorrentes'
      description='Chamados que o sistema abre sozinho de tempo em tempo (limpeza, backup, vistoria, revisão de link). O worker verifica a cada 5 minutos e nunca abre a mesma ocorrência duas vezes.'
      actions={
        canEdit ? (
          <Button size='sm' onClick={() => setEditing({ mode: 'create' })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova rotina
          </Button>
        ) : null
      }
    >
      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && rules.length === 0 ? (
        <EmptyState>
          Nenhuma rotina cadastrada. Crie uma para parar de depender de alguém
          lembrar de abrir o chamado.
        </EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
              <tr>
                <th className='px-3 py-2 font-medium'>Rotina</th>
                <th className='px-3 py-2 font-medium'>Agenda</th>
                <th className='px-3 py-2 font-medium'>Próxima execução</th>
                <th className='px-3 py-2 font-medium'>Ativa</th>
                <th className='w-32 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={cn(
                    'border-t border-border',
                    !rule.active && 'opacity-60',
                  )}
                >
                  <td className='max-w-64 px-3 py-2'>
                    <div className='truncate font-medium'>{rule.name}</div>
                    <div className='truncate text-xs text-muted-foreground'>
                      {SD_TICKET_TYPE_LABEL[rule.ticketType]}
                      {rule.configItem ? ` · ${rule.configItem.name}` : ''}
                      {rule.customer ? ` · ${rule.customer.name}` : ''}
                    </div>
                  </td>
                  <td className='px-3 py-2 text-xs text-muted-foreground'>
                    {describeSdRecurrence(sdScheduleOf(rule))}
                  </td>
                  <td className='px-3 py-2 text-xs'>
                    {rule.nextRunAt ? (
                      <span className='flex items-center gap-1.5'>
                        <SteelIcon
                          icon={Clock01Icon}
                          strokeWidth={2}
                          className='size-3.5 text-muted-foreground'
                        />
                        {formatSdOccurrence(rule.nextRunAt)}
                      </span>
                    ) : (
                      <span className='text-muted-foreground'>
                        {rule.active ? 'Vigência encerrada' : 'Pausada'}
                      </span>
                    )}
                  </td>
                  <td className='px-3 py-2'>
                    <Switch
                      checked={rule.active}
                      disabled={!canEdit}
                      aria-label={rule.active ? 'Pausar' : 'Retomar'}
                      onCheckedChange={(active) =>
                        update.mutate(
                          { id: rule.id, data: { active } },
                          {
                            onError: (err) => notify.error(err),
                            onSuccess: () =>
                              notify.success(
                                active ? 'Rotina retomada' : 'Rotina pausada',
                              ),
                          },
                        )
                      }
                    />
                  </td>
                  <td className='px-3 py-2'>
                    <div className='flex justify-end gap-1'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label={`Histórico de ${rule.name}`}
                        onClick={() => setHistory(rule)}
                      >
                        <SteelIcon icon={HistoryIcon} strokeWidth={2} />
                      </Button>
                      {canEdit ? (
                        <>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`Gerar agora ${rule.name}`}
                            disabled={runNow.isPending}
                            onClick={() =>
                              runNow.mutate(rule.id, {
                                onError: (err) => notify.error(err),
                                onSuccess: (run) =>
                                  run.status === 'CREATED'
                                    ? notify.success('Chamado gerado')
                                    : notify.error(
                                        run.reason ??
                                          'A ocorrência não gerou chamado',
                                      ),
                              })
                            }
                          >
                            <SteelIcon icon={PlayIcon} strokeWidth={2} />
                          </Button>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`Editar ${rule.name}`}
                            onClick={() => setEditing({ mode: 'edit', rule })}
                          >
                            <SteelIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                            />
                          </Button>
                          <ConfirmDeleteButton
                            title='Excluir rotina'
                            description={`"${rule.name}" para de abrir chamados. Os chamados já abertos continuam lá. Para só interromper, pause a rotina.`}
                            pending={remove.isPending}
                            onConfirm={() =>
                              remove.mutate(rule.id, {
                                onError: (err) => notify.error(err),
                              })
                            }
                          />
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <SdRecurringDialog
          workspaceId={workspaceId}
          rule={editing.mode === 'edit' ? editing.rule : null}
          onClose={() => setEditing(null)}
        />
      ) : null}

      {history ? (
        <SdRecurringHistoryDialog
          workspaceId={workspaceId}
          rule={history}
          onClose={() => setHistory(null)}
        />
      ) : null}
    </SettingsSection>
  )
}

/* ------------------------------- Editor --------------------------------- */

/** `yyyy-MM-ddTHH:mm` para o `datetime-local`, no fuso do navegador. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function todayLocalInput(): string {
  return toLocalInput(new Date().toISOString())
}

export function SdRecurringDialog({
  workspaceId,
  rule,
  onClose,
}: {
  workspaceId: string
  rule: SdRecurringTicketDTO | null
  onClose: () => void
}) {
  const { config } = useSdSettingsContext()
  const create = useCreateSdRecurringTicket(workspaceId)
  const update = useUpdateSdRecurringTicket(workspaceId)
  const agents = useSdAgents(workspaceId)

  const [name, setName] = useState(rule?.name ?? '')
  const [description, setDescription] = useState(rule?.description ?? '')
  const [ticketType, setTicketType] = useState<SdTicketTypeDTO>(
    rule?.ticketType ?? 'SERVICE_REQUEST',
  )
  const [templateId, setTemplateId] = useState(rule?.templateId ?? null)
  const [customerId, setCustomerId] = useState(rule?.customerId ?? null)
  const [customerLabel, setCustomerLabel] = useState(
    rule?.customer?.name ?? null,
  )
  const [configItemId, setConfigItemId] = useState(rule?.configItemId ?? null)
  const [configItemLabel, setConfigItemLabel] = useState(
    rule?.configItem?.name ?? null,
  )
  const [departmentId, setDepartmentId] = useState(rule?.departmentId ?? null)
  const [assigneeId, setAssigneeId] = useState(rule?.assigneeId ?? null)
  const [frequency, setFrequency] = useState(rule?.frequency ?? 'MONTHLY')
  const [interval, setInterval] = useState<number | null>(rule?.interval ?? 1)
  const [byWeekday, setByWeekday] = useState<number[]>(rule?.byWeekday ?? [])
  const [byMonthday, setByMonthday] = useState<number | null>(
    rule?.byMonthday ?? null,
  )
  const [atTime, setAtTime] = useState(rule?.atTime ?? '08:00')
  const [timezone, setTimezone] = useState(
    rule?.timezone ?? 'America/Sao_Paulo',
  )
  const [startsAt, setStartsAt] = useState(
    rule ? toLocalInput(rule.startsAt) : todayLocalInput(),
  )
  const [endsAt, setEndsAt] = useState(toLocalInput(rule?.endsAt ?? null))
  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number | null>(
    rule?.leadTimeMinutes ?? 0,
  )
  const [skipIfOpen, setSkipIfOpen] = useState(rule?.skipIfOpen ?? true)

  const templates = (config?.templates ?? []).filter(
    (template) => template.ticketType === ticketType,
  )
  const departments = (config?.departments ?? []).flatMap((department) => [
    { value: department.id, label: department.name },
    ...department.children.map((child) => ({
      value: child.id,
      label: `${department.name} › ${child.name}`,
    })),
  ])
  const agentOptions = (agents.data ?? [])
    .filter((agent) => agent.isAgent)
    .map((agent) => ({ value: agent.id, label: agent.name }))

  const schedule = useMemo<SdRecurrenceSchedule>(
    () => ({
      frequency,
      interval: interval ?? 1,
      byWeekday,
      byMonthday,
      atTime,
      timezone,
      startsAt: new Date(startsAt || Date.now()),
      endsAt: endsAt ? new Date(endsAt) : null,
      leadTimeMinutes: leadTimeMinutes ?? 0,
    }),
    [
      frequency,
      interval,
      byWeekday,
      byMonthday,
      atTime,
      timezone,
      startsAt,
      endsAt,
      leadTimeMinutes,
    ],
  )

  const problem = startsAt ? sdRecurrenceProblem(schedule) : 'Informe o início'
  const preview = problem
    ? []
    : nextSdOccurrences(schedule, new Date(), 5).map((occurrence) =>
        formatSdOccurrence(occurrence.scheduledFor.toISOString(), timezone),
      )
  const saving = create.isPending || update.isPending

  async function save() {
    const payload: CreateSdRecurringTicketDTO = {
      name: name.trim(),
      description: description.trim() || null,
      ticketType,
      templateId,
      defaults: rule?.defaults ?? {},
      customerId,
      configItemId,
      departmentId,
      assigneeId,
      frequency,
      interval: interval ?? 1,
      byWeekday,
      byMonthday,
      atTime,
      timezone,
      startsAt: new Date(startsAt),
      endsAt: endsAt ? new Date(endsAt) : null,
      leadTimeMinutes: leadTimeMinutes ?? 0,
      skipIfOpen,
      active: rule?.active ?? true,
    }
    try {
      if (rule) {
        const { defaults: _defaults, active: _active, ...data } = payload
        await update.mutateAsync({ id: rule.id, data })
        notify.success('Rotina salva')
      } else {
        await create.mutateAsync(payload)
        notify.success('Rotina criada')
      }
      onClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{rule ? 'Editar rotina' : 'Nova rotina'}</DialogTitle>
          <DialogDescription>
            A agenda vale no fuso escolhido — não no fuso do servidor nem no do
            seu navegador.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              placeholder='Vistoria mensal do nobreak'
              autoFocus
            />
          </FieldBlock>

          <FieldBlock
            label='Descrição'
            hint='Vai para a descrição do chamado gerado, quando o modelo não traz uma.'
          >
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </FieldBlock>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Tipo de chamado'>
              <SimpleSelect
                value={ticketType}
                onChange={(value) => {
                  setTicketType((value ?? 'SERVICE_REQUEST') as SdTicketTypeDTO)
                  setTemplateId(null)
                }}
                options={SD_TICKET_TYPE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
              />
            </FieldBlock>
            <FieldBlock
              label='Modelo de chamado'
              hint='Opcional: preenche categoria, prioridade e checklist.'
            >
              <SimpleSelect
                value={templateId}
                onChange={setTemplateId}
                allowEmpty
                emptyLabel='Sem modelo'
                options={templates.map((template) => ({
                  value: template.id,
                  label: template.name,
                }))}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Cliente'>
              <SdCustomerPicker
                workspaceId={workspaceId}
                value={customerId}
                selectedLabel={customerLabel}
                allowCreate={false}
                onChange={(option) => {
                  setCustomerId(option?.id ?? null)
                  setCustomerLabel(option?.label ?? null)
                }}
              />
            </FieldBlock>
            <FieldBlock label='Item de configuração'>
              <SdConfigItemPicker
                workspaceId={workspaceId}
                value={configItemId}
                selectedLabel={configItemLabel}
                allowCreate={false}
                onChange={(option) => {
                  setConfigItemId(option?.id ?? null)
                  setConfigItemLabel(option?.label ?? null)
                }}
              />
            </FieldBlock>
            <FieldBlock label='Departamento'>
              <SimpleSelect
                value={departmentId}
                onChange={setDepartmentId}
                allowEmpty
                emptyLabel='Pelo catálogo/padrão'
                options={departments}
              />
            </FieldBlock>
            <FieldBlock label='Responsável'>
              <SimpleSelect
                value={assigneeId}
                onChange={setAssigneeId}
                allowEmpty
                emptyLabel='Sem responsável'
                options={agentOptions}
              />
            </FieldBlock>
          </div>

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FieldBlock label='Frequência'>
              <SimpleSelect
                value={frequency}
                onChange={(value) => setFrequency(value ?? 'MONTHLY')}
                options={FREQUENCY_OPTIONS}
              />
            </FieldBlock>
            <FieldBlock label='A cada' hint='Dias, semanas, meses ou anos.'>
              <NumberInput
                value={interval}
                onCommit={setInterval}
                min={1}
                max={366}
              />
            </FieldBlock>
            <FieldBlock label='Horário' hint='Hora local do fuso escolhido.'>
              <Input
                type='time'
                value={atTime}
                onChange={(e) => setAtTime(e.target.value)}
              />
            </FieldBlock>
          </div>

          {frequency === 'DAILY' || frequency === 'WEEKLY' ? (
            <FieldBlock
              label='Dias da semana'
              hint={
                frequency === 'WEEKLY'
                  ? 'Vazio = o dia da semana do início.'
                  : 'Vazio = todos os dias.'
              }
            >
              <div className='flex flex-wrap gap-1.5'>
                {SD_WEEKDAY_LABELS.map((label, day) => {
                  const active = byWeekday.includes(day)
                  return (
                    <button
                      key={label}
                      type='button'
                      aria-pressed={active}
                      onClick={() =>
                        setByWeekday(
                          active
                            ? byWeekday.filter((d) => d !== day)
                            : [...byWeekday, day],
                        )
                      }
                      className={cn(
                        'rounded-full border px-2.5 py-0.5 text-xs capitalize transition',
                        active
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </FieldBlock>
          ) : (
            <FieldBlock
              label='Dia do mês'
              hint='Vazio = o dia do início. 31 cai no último dia de meses curtos.'
            >
              <NumberInput
                value={byMonthday}
                onCommit={setByMonthday}
                min={1}
                max={31}
                className='max-w-32'
              />
            </FieldBlock>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Fuso horário'>
              <SimpleSelect
                value={timezone}
                onChange={(value) => setTimezone(value ?? 'America/Sao_Paulo')}
                options={TIMEZONE_OPTIONS}
              />
            </FieldBlock>
            <FieldBlock
              label='Antecedência (minutos)'
              hint='Abre o chamado antes da hora da rotina.'
            >
              <NumberInput
                value={leadTimeMinutes}
                onCommit={setLeadTimeMinutes}
                min={0}
                max={43_200}
              />
            </FieldBlock>
            <FieldBlock label='Início da vigência'>
              <Input
                type='datetime-local'
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Fim da vigência' hint='Vazio = sem fim.'>
              <Input
                type='datetime-local'
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </FieldBlock>
          </div>

          <ToggleRow
            label='Não abrir se a anterior estiver aberta'
            description='Evita acumular chamados da mesma rotina: a ocorrência é registrada como pulada.'
            checked={skipIfOpen}
            onCheckedChange={setSkipIfOpen}
          />

          <div className='rounded-lg border border-border bg-muted/40 p-3'>
            <h4 className='flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider'>
              <SteelIcon icon={Clock01Icon} strokeWidth={2} />
              Pré-visualização
            </h4>
            {problem ? (
              <p className='mt-2 flex items-start gap-1.5 text-sm text-destructive'>
                <SteelIcon
                  icon={AlertCircleIcon}
                  strokeWidth={2}
                  className='mt-0.5 shrink-0'
                />
                {problem}
              </p>
            ) : (
              <>
                <p className='mt-2 text-sm'>
                  {describeSdRecurrence(schedule)}. As {preview.length} próximas
                  ocorrências serão:
                </p>
                <ul className='mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground'>
                  {preview.map((occurrence) => (
                    <li key={occurrence} className='tabular-nums'>
                      {occurrence}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!name.trim() || Boolean(problem) || saving}
            onClick={save}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------ Histórico -------------------------------- */

export function SdRecurringHistoryDialog({
  workspaceId,
  rule,
  onClose,
  slug: slugProp,
}: {
  workspaceId: string
  rule: SdRecurringTicketDTO
  onClose: () => void
  slug?: string
}) {
  const params = useParams<{ 'workspace-slug'?: string }>()
  const slug = slugProp ?? params?.['workspace-slug'] ?? ''
  const { data, isLoading, error } = useSdRecurringRuns(workspaceId, rule.id)
  const runs = data ?? []

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>Ocorrências de {rule.name}</DialogTitle>
          <DialogDescription>
            {describeSdRecurrence(sdScheduleOf(rule))} · fuso {rule.timezone}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <EmptyState>{error.message}</EmptyState>
        ) : !isLoading && runs.length === 0 ? (
          <EmptyState>
            Esta rotina ainda não rodou. A próxima execução está marcada para{' '}
            {rule.nextRunAt ? formatSdOccurrence(rule.nextRunAt) : '—'}.
          </EmptyState>
        ) : (
          <ul className='flex flex-col divide-y divide-border'>
            {runs.map((run) => (
              <li
                key={run.id}
                className='flex items-start justify-between gap-3 py-2'
              >
                <div className='min-w-0'>
                  <div className='flex items-center gap-2 text-sm'>
                    <span className='tabular-nums'>
                      {formatSdOccurrence(run.scheduledFor, rule.timezone)}
                    </span>
                    <span
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[11px]',
                        SD_RUN_STATUS_TONE[run.status],
                      )}
                    >
                      {SD_RUN_STATUS_LABEL[run.status]}
                    </span>
                  </div>
                  {run.reason ? (
                    <p className='mt-0.5 text-xs text-muted-foreground'>
                      {run.reason}
                    </p>
                  ) : null}
                </div>
                {run.ticket && slug ? (
                  <Link
                    href={`/${slug}/servicedesk/tickets/${run.ticket.number}`}
                    className='flex shrink-0 items-center gap-1 text-sm text-primary hover:underline'
                  >
                    <SteelIcon
                      icon={CheckmarkCircle02Icon}
                      strokeWidth={2}
                      className='size-3.5'
                    />
                    #{run.ticket.number}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
