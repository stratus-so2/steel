'use client'

import {
  Alert02Icon,
  CalendarAdd01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  UserSwitchIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import { useSdAgents, useSdConfigList } from '@/src/hooks/use-sd-config'
import {
  useSdOnCallMutations,
  useSdOnCallOverrides,
  useSdOnCallSchedules,
  useSdOnCallTimeline,
} from '@/src/hooks/use-sd-oncall'
import type {
  CreateSdOnCallScheduleDTO,
  SdOnCallRotationInput,
} from '@/src/schemas/sd-oncall.schema'
import type { SdBusinessCalendarDTO } from '@/types/sd-config'
import type {
  SdOnCallLayerDTO,
  SdOnCallScheduleDTO,
  SdOnCallTimelineDTO,
} from '@/types/sd-oncall'
import { SdOnCallBadge } from '../ticket/sd-oncall-badge'
import { SdUserAvatar } from '../ticket/sd-ticket-badges'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SettingsSection,
  SimpleSelect,
  SortableList,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

/**
 * Aba "Plantão": escalas, camadas com o rodízio dos participantes (arrastar
 * para ordenar), as trocas pontuais e a linha do tempo das próximas duas
 * semanas. Fora do expediente o escalonamento chama quem está aqui, em vez
 * de depender da boa vontade do líder do time.
 */

export const SD_ONCALL_ROTATION_OPTIONS: {
  value: SdOnCallRotationInput
  label: string
}[] = [
  { value: 'DAILY', label: 'Diário — vira todo dia' },
  { value: 'WEEKLY', label: 'Semanal — vira toda semana' },
  { value: 'BIWEEKLY', label: 'Quinzenal — vira a cada 14 dias' },
]

const ROTATION_SHORT: Record<SdOnCallRotationInput, string> = {
  DAILY: 'Diário',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
}

export const SD_TIMEZONE_OPTIONS = [
  'America/Sao_Paulo',
  'America/Manaus',
  'America/Belem',
  'America/Cuiaba',
  'America/Fortaleza',
  'America/Rio_Branco',
  'America/Noronha',
  'UTC',
].map((value) => ({ value, label: value.replace('_', ' ') }))

/** `Date` → valor de um `<input type="datetime-local">` na hora local. */
export function toLocalInputValue(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Rótulo curto de um período na linha do tempo. */
export function formatSdOnCallRange(start: string, end: string): string {
  const format = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${format.format(new Date(start))} → ${format.format(new Date(end))}`
}

export function SdOnCallTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading } = useSdOnCallSchedules(workspaceId, {
    includeInactive: true,
  })
  const mutations = useSdOnCallMutations(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<SdOnCallScheduleDTO | 'new' | null>(
    null,
  )
  const schedules = data ?? []
  const selected =
    schedules.find((schedule) => schedule.id === selectedId) ??
    schedules[0] ??
    null

  return (
    <div className='flex flex-col gap-4'>
      <SettingsSection
        title='Escalas de plantão'
        description='Quem responde fora do horário comercial. O rodízio passa a vez na hora da virada, no fuso da escala; com um calendário de expediente a escala só vale fora dele.'
        actions={
          canEdit ? (
            <Button size='sm' onClick={() => setEditing('new')}>
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Nova escala
            </Button>
          ) : null
        }
      >
        {!isLoading && schedules.length === 0 ? (
          <EmptyState>
            Nenhuma escala de plantão. Crie uma para o time que atende fora do
            horário comercial.
          </EmptyState>
        ) : (
          <ul className='flex flex-col gap-1.5'>
            {schedules.map((schedule) => (
              <li key={schedule.id}>
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5',
                    schedule.id === selected?.id && 'border-primary/60',
                    !schedule.active && 'opacity-60',
                  )}
                >
                  <button
                    type='button'
                    onClick={() => setSelectedId(schedule.id)}
                    className='flex min-w-0 flex-1 flex-col items-start gap-1 text-left'
                  >
                    <span className='flex flex-wrap items-center gap-2'>
                      <span className='truncate font-medium text-sm'>
                        {schedule.name}
                      </span>
                      <Badge variant='outline'>
                        {ROTATION_SHORT[schedule.rotation]} ·{' '}
                        {schedule.handoffTime}
                      </Badge>
                      {schedule.department ? (
                        <Badge variant='secondary'>
                          {schedule.department.name}
                        </Badge>
                      ) : (
                        <Badge variant='secondary'>Todos os times</Badge>
                      )}
                      {!schedule.active ? (
                        <Badge variant='outline'>Inativa</Badge>
                      ) : null}
                    </span>
                    <span className='text-muted-foreground text-xs'>
                      {schedule.timezone} ·{' '}
                      {schedule.layers.length === 0
                        ? 'sem camadas'
                        : `${schedule.layers.length} camada(s)`}
                      {schedule.calendar
                        ? ` · fora do expediente de ${schedule.calendar.name}`
                        : ' · vale 24 h'}
                    </span>
                  </button>
                  <SdOnCallBadge
                    workspaceId={workspaceId}
                    departmentId={schedule.department?.id ?? null}
                  />
                  {canEdit ? (
                    <>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label={`Editar ${schedule.name}`}
                        onClick={() => setEditing(schedule)}
                      >
                        <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      </Button>
                      <ConfirmDeleteButton
                        title='Excluir escala de plantão'
                        description={`"${schedule.name}" deixará de valer. Para pausar sem perder o rodízio, desative a escala.`}
                        pending={mutations.remove.isPending}
                        onConfirm={() =>
                          mutations.remove.mutate(schedule.id, {
                            onError: (err) => notify.error(err),
                          })
                        }
                      />
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      {selected ? (
        <>
          <SdOnCallLayersSection schedule={selected} />
          <SdOnCallOverridesSection schedule={selected} />
          <SdOnCallTimelineSection schedule={selected} />
        </>
      ) : null}

      {editing ? (
        <SdOnCallScheduleDialog
          schedule={editing === 'new' ? null : editing}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            try {
              if (editing === 'new') {
                const created = await mutations.create.mutateAsync(payload)
                setSelectedId(created.id)
              } else {
                await mutations.update.mutateAsync({
                  scheduleId: editing.id,
                  data: payload,
                })
              }
              notify.success('Escala salva')
              setEditing(null)
            } catch (err) {
              notify.error(err)
            }
          }}
        />
      ) : null}
    </div>
  )
}

function SdOnCallLayersSection({
  schedule,
}: {
  schedule: SdOnCallScheduleDTO
}) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mutations = useSdOnCallMutations(workspaceId)
  const agents = useSdAgents(workspaceId)
  const [creating, setCreating] = useState(false)
  const [layerName, setLayerName] = useState('')

  const nextLevel = useMemo(
    () =>
      schedule.layers.reduce((max, layer) => Math.max(max, layer.level), 0) + 1,
    [schedule.layers],
  )

  async function addLayer() {
    if (!layerName.trim()) return notify.error('Informe o nome da camada')
    try {
      await mutations.addLayer.mutateAsync({
        scheduleId: schedule.id,
        data: { name: layerName.trim(), level: nextLevel },
      })
      setLayerName('')
      setCreating(false)
      notify.success('Camada criada')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <SettingsSection
      title={`Camadas de "${schedule.name}"`}
      description='A camada 1 é a primeira chamada; as seguintes são a retaguarda. Cada camada tem o seu rodízio — arraste para mudar a ordem da vez.'
      actions={
        canEdit ? (
          <Button size='sm' variant='outline' onClick={() => setCreating(true)}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova camada
          </Button>
        ) : null
      }
    >
      {schedule.layers.length === 0 ? (
        <EmptyState>
          Sem camadas, a escala não chama ninguém. Crie a camada 1 (primeira
          chamada).
        </EmptyState>
      ) : (
        <div className='flex flex-col gap-3'>
          {schedule.layers.map((layer) => (
            <SdOnCallLayerCard
              key={layer.id}
              scheduleId={schedule.id}
              layer={layer}
              agents={agents.data ?? []}
            />
          ))}
        </div>
      )}

      {creating ? (
        <Dialog
          open
          onOpenChange={(open) => (open ? null : setCreating(false))}
        >
          <DialogContent className='sm:max-w-md'>
            <DialogHeader>
              <DialogTitle>Nova camada (nível {nextLevel})</DialogTitle>
            </DialogHeader>
            <FieldBlock
              label='Nome'
              hint={
                nextLevel === 1
                  ? 'Ex.: Primeira chamada'
                  : 'Ex.: Retaguarda, Coordenação'
              }
            >
              <Input
                value={layerName}
                maxLength={120}
                autoFocus
                onChange={(e) => setLayerName(e.target.value)}
              />
            </FieldBlock>
            <DialogFooter>
              <Button
                variant='outline'
                size='sm'
                onClick={() => setCreating(false)}
              >
                Cancelar
              </Button>
              <Button
                size='sm'
                disabled={mutations.addLayer.isPending}
                onClick={addLayer}
              >
                Criar camada
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </SettingsSection>
  )
}

function SdOnCallLayerCard({
  scheduleId,
  layer,
  agents,
}: {
  scheduleId: string
  layer: SdOnCallLayerDTO
  agents: { id: string; name: string }[]
}) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mutations = useSdOnCallMutations(workspaceId)
  const current = layer.participants.map((participant) => participant.user.id)
  const available = agents.filter((agent) => !current.includes(agent.id))

  function save(userIds: string[]) {
    mutations.setParticipants.mutate(
      { scheduleId, layerId: layer.id, userIds },
      { onError: (err) => notify.error(err) },
    )
  }

  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border bg-background p-3'>
      <header className='flex flex-wrap items-center gap-2'>
        <Badge variant='outline'>Camada {layer.level}</Badge>
        <span className='flex-1 truncate font-medium text-sm'>
          {layer.name}
        </span>
        {canEdit ? (
          <ConfirmDeleteButton
            title='Excluir camada'
            description={`"${layer.name}" e os participantes dela saem da escala.`}
            pending={mutations.removeLayer.isPending}
            onConfirm={() =>
              mutations.removeLayer.mutate(
                { scheduleId, layerId: layer.id },
                { onError: (err) => notify.error(err) },
              )
            }
          />
        ) : null}
      </header>

      {layer.participants.length === 0 ? (
        <p className='text-muted-foreground text-xs'>
          Nenhum participante: nesta camada o escalonamento cai no destino
          normal da regra.
        </p>
      ) : (
        <SortableList
          items={layer.participants}
          disabled={!canEdit}
          onReorder={(orderedIds) =>
            save(
              orderedIds.map(
                (id) =>
                  layer.participants.find((p) => p.id === id)?.user.id ?? id,
              ),
            )
          }
          renderItem={(participant, handle) => (
            <div className='flex items-center gap-2 rounded-md border border-border/60 px-2 py-1.5'>
              {handle}
              <span className='text-muted-foreground text-xs tabular-nums'>
                {participant.position + 1}º
              </span>
              <SdUserAvatar user={participant.user} className='size-5' />
              <span className='min-w-0 flex-1 truncate text-sm'>
                {participant.user.name}
              </span>
              {canEdit ? (
                <Button
                  type='button'
                  variant='ghost'
                  size='icon-xs'
                  aria-label={`Remover ${participant.user.name}`}
                  onClick={() =>
                    save(current.filter((id) => id !== participant.user.id))
                  }
                >
                  ×
                </Button>
              ) : null}
            </div>
          )}
        />
      )}

      {canEdit ? (
        <div className='flex items-end gap-2'>
          <FieldBlock label='Adicionar ao rodízio' className='flex-1'>
            <SimpleSelect
              value={null}
              placeholder={
                available.length === 0
                  ? 'Todos os agentes já estão na camada'
                  : 'Escolha um agente'
              }
              options={available.map((agent) => ({
                value: agent.id,
                label: agent.name,
              }))}
              disabled={available.length === 0}
              onChange={(userId) => userId && save([...current, userId])}
            />
          </FieldBlock>
        </div>
      ) : null}
    </div>
  )
}

function SdOnCallOverridesSection({
  schedule,
}: {
  schedule: SdOnCallScheduleDTO
}) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mutations = useSdOnCallMutations(workspaceId)
  const agents = useSdAgents(workspaceId)
  const { data } = useSdOnCallOverrides(workspaceId, {
    scheduleId: schedule.id,
  })
  const [creating, setCreating] = useState(false)
  const overrides = data ?? []

  return (
    <SettingsSection
      title='Trocas de plantão'
      description='Cobertura pontual: quem responde nesta janela, no lugar do rodízio. Duas trocas na mesma camada e no mesmo período não são aceitas.'
      actions={
        canEdit ? (
          <Button size='sm' variant='outline' onClick={() => setCreating(true)}>
            <SteelIcon icon={UserSwitchIcon} strokeWidth={2} />
            Registrar troca
          </Button>
        ) : null
      }
    >
      {overrides.length === 0 ? (
        <EmptyState>Nenhuma troca registrada daqui para a frente.</EmptyState>
      ) : (
        <ul className='flex flex-col gap-1.5'>
          {overrides.map((override) => (
            <li
              key={override.id}
              className='flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2'
            >
              <SdUserAvatar user={override.user} className='size-5' />
              <span className='font-medium text-sm'>{override.user.name}</span>
              <Badge variant='outline'>
                {override.layerId
                  ? (schedule.layers.find(
                      (layer) => layer.id === override.layerId,
                    )?.name ?? 'Camada removida')
                  : 'Escala inteira'}
              </Badge>
              <span className='text-muted-foreground text-xs'>
                {formatSdOnCallRange(override.startsAt, override.endsAt)}
                {override.reason ? ` · ${override.reason}` : ''}
              </span>
              {canEdit ? (
                <ConfirmDeleteButton
                  title='Excluir troca'
                  description='A janela volta para o rodízio normal.'
                  pending={mutations.removeOverride.isPending}
                  onConfirm={() =>
                    mutations.removeOverride.mutate(override.id, {
                      onError: (err) => notify.error(err),
                    })
                  }
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {creating ? (
        <SdOnCallOverrideDialog
          schedule={schedule}
          agents={agents.data ?? []}
          saving={mutations.createOverride.isPending}
          onClose={() => setCreating(false)}
          onSave={async (payload) => {
            try {
              await mutations.createOverride.mutateAsync(payload)
              notify.success('Troca registrada')
              setCreating(false)
            } catch (err) {
              notify.error(err)
            }
          }}
        />
      ) : null}
    </SettingsSection>
  )
}

const SEGMENT_COLORS = [
  'bg-sky-500/70',
  'bg-violet-500/70',
  'bg-emerald-500/70',
  'bg-amber-500/70',
  'bg-rose-500/70',
  'bg-teal-500/70',
]

/** Cor estável por pessoa, para a barra ficar legível nos dois temas. */
export function sdOnCallSegmentColor(userId: string | null): string {
  if (!userId) return 'bg-muted'
  let hash = 0
  for (const char of userId) hash = (hash + char.charCodeAt(0)) % 997
  return SEGMENT_COLORS[hash % SEGMENT_COLORS.length]
}

export function SdOnCallTimelineBars({
  timeline,
}: {
  timeline: SdOnCallTimelineDTO
}) {
  const from = new Date(timeline.from).getTime()
  const to = new Date(timeline.to).getTime()
  const span = Math.max(to - from, 1)

  return (
    <div className='flex flex-col gap-3'>
      {timeline.layers.map((layer) => (
        <div key={layer.layerId} className='flex flex-col gap-1.5'>
          <span className='font-medium text-xs'>
            Camada {layer.level} · {layer.layerName}
          </span>
          <div className='flex h-8 w-full overflow-hidden rounded-md border border-border'>
            {layer.segments.map((segment) => {
              const width =
                ((new Date(segment.end).getTime() -
                  new Date(segment.start).getTime()) /
                  span) *
                100
              return (
                <div
                  key={`${layer.layerId}-${segment.start}`}
                  style={{ width: `${width}%` }}
                  title={`${segment.user?.name ?? 'Sem plantonista'} · ${formatSdOnCallRange(segment.start, segment.end)}${segment.source === 'override' ? ' (troca)' : ''}`}
                  className={cn(
                    'flex min-w-0 items-center justify-center border-border/60 border-r px-1 text-[10px] text-white/95 last:border-r-0',
                    sdOnCallSegmentColor(segment.userId),
                    segment.source === 'override' &&
                      'ring-1 ring-foreground/40 ring-inset',
                  )}
                >
                  <span className='truncate'>
                    {segment.user?.name.split(' ')[0] ?? '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <ul className='flex flex-col gap-0.5 text-muted-foreground text-xs'>
            {layer.segments.map((segment) => (
              <li key={`list-${layer.layerId}-${segment.start}`}>
                {formatSdOnCallRange(segment.start, segment.end)} ·{' '}
                {segment.user?.name ?? 'sem plantonista'}
                {segment.source === 'override' ? ' (troca)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function SdOnCallTimelineSection({
  schedule,
}: {
  schedule: SdOnCallScheduleDTO
}) {
  const { workspaceId } = useSdSettingsContext()
  const { data, isLoading } = useSdOnCallTimeline(workspaceId, schedule.id, {
    days: 14,
  })

  return (
    <SettingsSection
      title='Próximas duas semanas'
      description={
        schedule.calendar
          ? `Quem cobre cada período. A escala só vale fora do expediente de "${schedule.calendar.name}".`
          : 'Quem cobre cada período, 24 h por dia.'
      }
    >
      {isLoading ? (
        <EmptyState>Montando a linha do tempo…</EmptyState>
      ) : !data || data.layers.length === 0 ? (
        <EmptyState>
          Crie uma camada com participantes para ver a linha do tempo.
        </EmptyState>
      ) : (
        <SdOnCallTimelineBars timeline={data} />
      )}
    </SettingsSection>
  )
}

function SdOnCallScheduleDialog({
  schedule,
  saving,
  onClose,
  onSave,
}: {
  schedule: SdOnCallScheduleDTO | null
  saving: boolean
  onClose: () => void
  onSave: (payload: CreateSdOnCallScheduleDTO) => void
}) {
  const { workspaceId, config } = useSdSettingsContext()
  const calendars = useSdConfigList<SdBusinessCalendarDTO>(
    workspaceId,
    'calendars',
  )
  const [name, setName] = useState(schedule?.name ?? '')
  const [departmentId, setDepartmentId] = useState<string | null>(
    schedule?.department?.id ?? null,
  )
  const [timezone, setTimezone] = useState(
    schedule?.timezone ?? 'America/Sao_Paulo',
  )
  const [rotation, setRotation] = useState<SdOnCallRotationInput>(
    schedule?.rotation ?? 'WEEKLY',
  )
  const [rotationStart, setRotationStart] = useState(
    toLocalInputValue(schedule?.rotationStart ?? new Date()),
  )
  const [handoffTime, setHandoffTime] = useState(
    schedule?.handoffTime ?? '09:00',
  )
  const [calendarId, setCalendarId] = useState<string | null>(
    schedule?.calendar?.id ?? null,
  )
  const [active, setActive] = useState(schedule?.active ?? true)

  const departments = (config?.departments ?? []).flatMap((department) => [
    { value: department.id, label: department.name },
    ...department.children.map((child) => ({
      value: child.id,
      label: `${department.name} › ${child.name}`,
    })),
  ])

  function submit() {
    if (!name.trim()) return notify.error('Informe o nome da escala')
    const start = new Date(rotationStart)
    if (Number.isNaN(start.getTime())) {
      return notify.error('Informe o início do rodízio')
    }
    onSave({
      name: name.trim(),
      departmentId,
      timezone,
      rotation,
      rotationStart: start,
      handoffTime,
      calendarId,
      active,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {schedule ? 'Editar escala de plantão' : 'Nova escala de plantão'}
          </DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </FieldBlock>
          <div className='grid gap-3 md:grid-cols-2'>
            <FieldBlock
              label='Time'
              hint='Sem time, a escala cobre todos os departamentos como rede.'
            >
              <SimpleSelect
                value={departmentId}
                options={departments}
                allowEmpty
                emptyLabel='Todos os times'
                onChange={setDepartmentId}
              />
            </FieldBlock>
            <FieldBlock label='Fuso horário'>
              <SimpleSelect
                value={timezone}
                options={SD_TIMEZONE_OPTIONS}
                onChange={(value) => value && setTimezone(value)}
              />
            </FieldBlock>
            <FieldBlock label='Rodízio'>
              <SimpleSelect
                value={rotation}
                options={SD_ONCALL_ROTATION_OPTIONS}
                onChange={(value) => value && setRotation(value)}
              />
            </FieldBlock>
            <FieldBlock
              label='Hora da virada'
              hint='No fuso da escala, não no do servidor.'
            >
              <Input
                type='time'
                value={handoffTime}
                onChange={(e) => setHandoffTime(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              label='Início do rodízio'
              hint='O primeiro participante de cada camada cobre o período desta data.'
              className='md:col-span-2'
            >
              <Input
                type='datetime-local'
                value={rotationStart}
                onChange={(e) => setRotationStart(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock
              label='Calendário de expediente'
              hint='Com um calendário, a escala só vale fora do horário comercial.'
              className='md:col-span-2'
            >
              <SimpleSelect
                value={calendarId}
                options={(calendars.data ?? []).map((calendar) => ({
                  value: calendar.id,
                  label: calendar.name,
                }))}
                allowEmpty
                emptyLabel='Sem calendário — vale 24 h'
                onChange={setCalendarId}
              />
            </FieldBlock>
          </div>
          <ToggleRow
            label='Escala ativa'
            description='Desativada, o escalonamento volta a cair no líder do time.'
            checked={active}
            onCheckedChange={setActive}
          />
          <p className='flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-muted-foreground text-xs'>
            <SteelIcon
              icon={Alert02Icon}
              strokeWidth={2}
              className='mt-0.5 size-3.5 shrink-0'
            />
            Mexer no início do rodízio ou no tipo de rodízio recalcula quem
            cobre cada período — confira a linha do tempo depois de salvar.
          </p>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button size='sm' disabled={saving} onClick={submit}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SdOnCallOverrideDialog({
  schedule,
  agents,
  saving,
  onClose,
  onSave,
}: {
  schedule: SdOnCallScheduleDTO
  agents: { id: string; name: string }[]
  saving: boolean
  onClose: () => void
  onSave: (payload: {
    scheduleId: string
    layerId: string | null
    userId: string
    startsAt: Date
    endsAt: Date
    reason: string | null
  }) => void
}) {
  const [userId, setUserId] = useState<string | null>(null)
  const [layerId, setLayerId] = useState<string | null>(
    schedule.layers[0]?.id ?? null,
  )
  const [startsAt, setStartsAt] = useState(toLocalInputValue(new Date()))
  const [endsAt, setEndsAt] = useState(
    toLocalInputValue(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  )
  const [reason, setReason] = useState('')

  function submit() {
    if (!userId) return notify.error('Escolha quem vai cobrir o plantão')
    const start = new Date(startsAt)
    const end = new Date(endsAt)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return notify.error('Informe o período da troca')
    }
    if (end <= start) {
      return notify.error('O fim da troca precisa ser depois do início')
    }
    onSave({
      scheduleId: schedule.id,
      layerId,
      userId,
      startsAt: start,
      endsAt: end,
      reason: reason.trim() || null,
    })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Registrar troca de plantão</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-3'>
          <FieldBlock label='Quem cobre'>
            <SimpleSelect
              value={userId}
              options={agents.map((agent) => ({
                value: agent.id,
                label: agent.name,
              }))}
              onChange={setUserId}
            />
          </FieldBlock>
          <FieldBlock label='Camada'>
            <SimpleSelect
              value={layerId}
              options={schedule.layers.map((layer) => ({
                value: layer.id,
                label: `Camada ${layer.level} · ${layer.name}`,
              }))}
              allowEmpty
              emptyLabel='Escala inteira'
              onChange={setLayerId}
            />
          </FieldBlock>
          <div className='grid gap-3 md:grid-cols-2'>
            <FieldBlock label='Começa'>
              <Input
                type='datetime-local'
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Termina'>
              <Input
                type='datetime-local'
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
              />
            </FieldBlock>
          </div>
          <FieldBlock label='Motivo' hint='Opcional — aparece na lista.'>
            <Input
              value={reason}
              maxLength={500}
              placeholder='Consulta médica, viagem…'
              onChange={(e) => setReason(e.target.value)}
            />
          </FieldBlock>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button size='sm' disabled={saving} onClick={submit}>
            <SteelIcon icon={CalendarAdd01Icon} strokeWidth={2} />
            {saving ? 'Salvando...' : 'Registrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
