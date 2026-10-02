'use client'

import {
  ArrowRight01Icon,
  Building03Icon,
  CheckmarkBadge01Icon,
  Flag01Icon,
  PauseIcon,
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useMemo, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSaveSdPhaseTransitions,
  useSdConfigList,
  useSdConfigMutations,
  useSdPhaseTransitions,
} from '@/src/hooks/use-sd-config'
import {
  type CreateSdPhaseDTO,
  SD_PHASE_REQUIRED_FIELDS,
  type UpdateSdPhaseDTO,
} from '@/src/schemas/sd-phase.schema'
import type {
  SdPhaseCategoryDTO,
  SdPhaseDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'
import { SdSeedPhasesButton } from './sd-seed-phases-button'
import {
  ColorDot,
  ColorInput,
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  NumberInput,
  SD_PHASE_CATEGORY_OPTIONS,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  SortableList,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

const FIELD_LABELS: Record<(typeof SD_PHASE_REQUIRED_FIELDS)[number], string> =
  {
    description: 'Descrição',
    impactId: 'Impacto',
    urgencyId: 'Urgência',
    priorityId: 'Prioridade',
    severityId: 'Severidade',
    categoryId: 'Categoria',
    subcategoryId: 'Subcategoria',
    serviceId: 'Serviço',
    classificationId: 'Classificação',
    solutionClassificationId: 'Classificação da solução',
    solution: 'Solução',
    customerId: 'Cliente',
    companyId: 'Empresa',
    contactId: 'Contato',
    configItemId: 'Item de configuração',
    departmentId: 'Departamento',
    assigneeId: 'Responsável',
    changeType: 'Tipo de mudança',
    changeRisk: 'Risco da mudança',
    plannedStartAt: 'Início planejado',
    plannedEndAt: 'Fim planejado',
    implementationPlan: 'Plano de implementação',
    rollbackPlan: 'Plano de rollback',
    testPlan: 'Plano de testes',
    rootCause: 'Causa raiz',
    workaround: 'Contorno',
  }

const CATEGORY_LABEL = Object.fromEntries(
  SD_PHASE_CATEGORY_OPTIONS.map((o) => [o.value, o.label]),
) as Record<SdPhaseCategoryDTO, string>

type Cell = { allowedDepartmentIds: string[] }
type Matrix = Record<string, Cell>
const cellKey = (from: string, to: string) => `${from}>${to}`

export function SdFlowsTab() {
  const [ticketType, setTicketType] = useState<SdTicketTypeDTO>('INCIDENT')
  const { workspaceId } = useSdSettingsContext()
  const { data, isLoading } = useSdConfigList<SdPhaseDTO>(
    workspaceId,
    'phases',
    { ticketType, includeInactive: true },
  )
  const phases = useMemo(
    () => [...(data ?? [])].sort((a, b) => a.position - b.position),
    [data],
  )

  return (
    <div className='flex flex-col gap-5'>
      <div
        role='tablist'
        aria-label='Tipo de chamado'
        className='inline-flex w-fit flex-wrap gap-1 rounded-lg bg-muted p-1'
      >
        {SD_TICKET_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type='button'
            role='tab'
            aria-selected={ticketType === option.value}
            onClick={() => setTicketType(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              ticketType === option.value
                ? 'bg-background font-medium text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <FlowPreview phases={phases.filter((p) => p.active)} />
      <PhasesSection
        ticketType={ticketType}
        phases={phases}
        loading={isLoading}
      />
      <TransitionsSection
        key={ticketType}
        ticketType={ticketType}
        phases={phases}
      />
    </div>
  )
}

function FlowPreview({ phases }: { phases: SdPhaseDTO[] }) {
  if (phases.length === 0) return null
  return (
    <div className='flex items-center gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-4'>
      {phases.map((phase, index) => (
        <div key={phase.id} className='flex shrink-0 items-center gap-1.5'>
          <div
            className='flex flex-col gap-1 rounded-lg border px-3 py-2'
            style={{
              borderColor: phase.color ?? undefined,
              backgroundColor: phase.color ? `${phase.color}14` : undefined,
            }}
          >
            <span className='flex items-center gap-1.5 text-xs font-medium'>
              <ColorDot color={phase.color} />
              {phase.name}
              <span className='text-muted-foreground'>
                {phase.completionPercent}%
              </span>
            </span>
            <span className='flex flex-wrap gap-1'>
              <Badge variant='outline' className='h-4 text-[10px]'>
                {CATEGORY_LABEL[phase.category]}
              </Badge>
              {phase.isInitial ? (
                <Badge className='h-4 text-[10px]'>inicial</Badge>
              ) : null}
              {phase.pausesSla ? (
                <Badge variant='secondary' className='h-4 text-[10px]'>
                  pausa SLA
                </Badge>
              ) : null}
              {phase.requiresApproval ? (
                <Badge variant='secondary' className='h-4 text-[10px]'>
                  aprovação
                </Badge>
              ) : null}
            </span>
          </div>
          {index < phases.length - 1 ? (
            <SteelIcon
              icon={ArrowRight01Icon}
              strokeWidth={2}
              className='text-muted-foreground'
            />
          ) : null}
        </div>
      ))}
    </div>
  )
}

function PhasesSection({
  ticketType,
  phases,
  loading,
}: {
  ticketType: SdTicketTypeDTO
  phases: SdPhaseDTO[]
  loading: boolean
}) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mutations = useSdConfigMutations<
    SdPhaseDTO,
    CreateSdPhaseDTO,
    UpdateSdPhaseDTO
  >(workspaceId, 'phases')
  const [editing, setEditing] = useState<SdPhaseDTO | 'new' | null>(null)

  async function toggleActive(phase: SdPhaseDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: phase.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <SettingsSection
      title='Fases'
      description='Arraste para mudar a ordem das colunas do kanban. A fase inicial recebe os chamados novos deste tipo.'
      actions={
        canEdit ? (
          <div className='flex items-center gap-2'>
            {phases.length > 0 ? (
              <SdSeedPhasesButton
                workspaceId={workspaceId}
                ticketType={ticketType}
                variant='outline'
              />
            ) : null}
            <Button size='sm' onClick={() => setEditing('new')}>
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Nova fase
            </Button>
          </div>
        ) : null
      }
    >
      {!loading && phases.length === 0 ? (
        <EmptyState>
          <span className='flex flex-col items-center gap-3'>
            <span>
              Nenhuma fase cadastrada para este tipo — o kanban deste quadro
              fica sem coluna e sem chamado.
            </span>
            {canEdit ? (
              <SdSeedPhasesButton
                workspaceId={workspaceId}
                ticketType={ticketType}
              />
            ) : null}
          </span>
        </EmptyState>
      ) : (
        <SortableList
          items={phases}
          disabled={!canEdit}
          onReorder={(orderedIds) =>
            mutations.reorder.mutate(
              { ticketType, orderedIds },
              { onError: (err) => notify.error(err) },
            )
          }
          renderItem={(phase, handle) => (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2',
                !phase.active && 'opacity-60',
              )}
            >
              {handle}
              <ColorDot color={phase.color} />
              <div className='flex min-w-0 flex-1 flex-col gap-1'>
                <span className='flex items-center gap-2 truncate text-sm font-medium'>
                  {phase.name}
                  <Badge variant='outline'>
                    {CATEGORY_LABEL[phase.category]}
                  </Badge>
                </span>
                <div className='flex items-center gap-2'>
                  <div className='h-1.5 w-24 overflow-hidden rounded-full bg-muted'>
                    <div
                      className='h-full rounded-full'
                      style={{
                        width: `${phase.completionPercent}%`,
                        backgroundColor: phase.color ?? 'var(--primary)',
                      }}
                    />
                  </div>
                  <span className='text-xs text-muted-foreground'>
                    {phase.completionPercent}%
                  </span>
                </div>
              </div>
              <div className='hidden items-center gap-1.5 text-muted-foreground sm:flex'>
                {phase.isInitial ? (
                  <span title='Fase inicial'>
                    <SteelIcon icon={Flag01Icon} strokeWidth={2} />
                  </span>
                ) : null}
                {phase.pausesSla ? (
                  <span title='Pausa o SLA'>
                    <SteelIcon icon={PauseIcon} strokeWidth={2} />
                  </span>
                ) : null}
                {phase.requiresApproval ? (
                  <span title='Exige aprovação'>
                    <SteelIcon icon={CheckmarkBadge01Icon} strokeWidth={2} />
                  </span>
                ) : null}
                {phase.requiredFields.length > 0 ? (
                  <Badge variant='secondary'>
                    {phase.requiredFields.length} obrig.
                  </Badge>
                ) : null}
                {phase.wipLimit > 0 ? (
                  <Badge variant='outline'>WIP {phase.wipLimit}</Badge>
                ) : null}
              </div>
              <Switch
                checked={phase.active}
                disabled={!canEdit}
                onCheckedChange={(value) => toggleActive(phase, value)}
                aria-label={phase.active ? 'Desativar' : 'Ativar'}
              />
              {canEdit ? (
                <>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label={`Editar ${phase.name}`}
                    onClick={() => setEditing(phase)}
                  >
                    <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                  </Button>
                  <ConfirmDeleteButton
                    title='Excluir fase'
                    description={`"${phase.name}" será excluída. Fases com chamados ou a fase inicial não podem ser excluídas — desative-as.`}
                    pending={mutations.remove.isPending}
                    onConfirm={() =>
                      mutations.remove.mutate(phase.id, {
                        onError: (err) => notify.error(err),
                      })
                    }
                  />
                </>
              ) : null}
            </div>
          )}
        />
      )}

      {editing ? (
        <PhaseDialog
          phase={editing === 'new' ? null : editing}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            try {
              if (editing === 'new') {
                await mutations.create.mutateAsync({ ...data, ticketType })
                notify.success('Fase criada')
              } else {
                await mutations.update.mutateAsync({ id: editing.id, data })
                notify.success('Fase salva')
              }
              setEditing(null)
            } catch (err) {
              notify.error(err)
            }
          }}
        />
      ) : null}
    </SettingsSection>
  )
}

type PhaseForm = Omit<CreateSdPhaseDTO, 'ticketType'>

function PhaseDialog({
  phase,
  saving,
  onClose,
  onSave,
}: {
  phase: SdPhaseDTO | null
  saving: boolean
  onClose: () => void
  onSave: (data: PhaseForm) => void
}) {
  const { config } = useSdSettingsContext()
  const [form, setForm] = useState<PhaseForm>({
    name: phase?.name ?? '',
    description: phase?.description ?? null,
    color: phase?.color ?? '#6366f1',
    category: phase?.category ?? 'IN_PROGRESS',
    completionPercent: phase?.completionPercent ?? 0,
    isInitial: phase?.isInitial ?? false,
    pausesSla: phase?.pausesSla ?? false,
    requiresApproval: phase?.requiresApproval ?? false,
    requiredFields: (phase?.requiredFields ??
      []) as PhaseForm['requiredFields'],
    wipLimit: phase?.wipLimit ?? 0,
    active: phase?.active ?? true,
  })
  const set = <K extends keyof PhaseForm>(key: K, value: PhaseForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const fieldOptions = useMemo(
    () => [
      ...SD_PHASE_REQUIRED_FIELDS.map((value) => ({
        value: value as string,
        label: FIELD_LABELS[value],
      })),
      ...(config?.customFields ?? [])
        .filter((f) => f.entity === 'TICKET')
        .map((f) => ({ value: `customFields.${f.key}`, label: f.label })),
    ],
    [config?.customFields],
  )

  function toggleField(value: string) {
    const current = form.requiredFields as string[]
    set(
      'requiredFields',
      (current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]) as PhaseForm['requiredFields'],
    )
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{phase ? 'Editar fase' : 'Nova fase'}</DialogTitle>
        </DialogHeader>
        <div className='grid gap-4 sm:grid-cols-2'>
          <FieldBlock label='Nome'>
            <Input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              maxLength={120}
            />
          </FieldBlock>
          <FieldBlock
            label='Semântica'
            hint={
              SD_PHASE_CATEGORY_OPTIONS.find((o) => o.value === form.category)
                ?.hint
            }
          >
            <SimpleSelect
              value={form.category}
              onChange={(value) => value && set('category', value)}
              options={SD_PHASE_CATEGORY_OPTIONS.map((o) => ({
                value: o.value,
                label: o.label,
              }))}
            />
          </FieldBlock>
          <FieldBlock label='Descrição' className='sm:col-span-2'>
            <Textarea
              rows={2}
              value={form.description ?? ''}
              onChange={(e) => set('description', e.target.value || null)}
            />
          </FieldBlock>
          <FieldBlock label='Cor' className='sm:col-span-2'>
            <ColorInput value={form.color} onChange={(c) => set('color', c)} />
          </FieldBlock>
          <FieldBlock label='% de conclusão'>
            <div className='flex items-center gap-3'>
              <NumberInput
                value={form.completionPercent}
                min={0}
                max={100}
                suffix='%'
                className='w-24'
                onCommit={(v) => set('completionPercent', v ?? 0)}
              />
              <div className='h-2 flex-1 overflow-hidden rounded-full bg-muted'>
                <div
                  className='h-full rounded-full transition-all'
                  style={{
                    width: `${form.completionPercent}%`,
                    backgroundColor: form.color ?? undefined,
                  }}
                />
              </div>
            </div>
          </FieldBlock>
          <FieldBlock label='Limite WIP' hint='0 = sem limite'>
            <NumberInput
              value={form.wipLimit}
              min={0}
              max={10000}
              onCommit={(v) => set('wipLimit', v ?? 0)}
            />
          </FieldBlock>
          <div className='flex flex-col sm:col-span-2'>
            <ToggleRow
              label='Fase inicial'
              description='Chamados novos deste tipo entram aqui (desmarca a atual).'
              checked={form.isInitial}
              onCheckedChange={(v) => set('isInitial', v)}
            />
            <ToggleRow
              label='Pausa o SLA'
              description='O relógio para enquanto o chamado está nesta fase.'
              checked={form.pausesSla}
              onCheckedChange={(v) => set('pausesSla', v)}
            />
            <ToggleRow
              label='Exige aprovação'
              description='Só entra com uma aprovação concedida.'
              checked={form.requiresApproval}
              onCheckedChange={(v) => set('requiresApproval', v)}
            />
            <ToggleRow
              label='Ativa'
              checked={form.active}
              onCheckedChange={(v) => set('active', v)}
            />
          </div>
          <FieldBlock
            label='Campos obrigatórios para entrar'
            className='sm:col-span-2'
          >
            <div className='flex flex-wrap gap-1.5'>
              {fieldOptions.map((option) => {
                const active = (form.requiredFields as string[]).includes(
                  option.value,
                )
                return (
                  <button
                    key={option.value}
                    type='button'
                    aria-pressed={active}
                    onClick={() => toggleField(option.value)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-xs transition',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </FieldBlock>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!form.name.trim() || saving}
            onClick={() => onSave({ ...form, name: form.name.trim() })}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransitionsSection({
  ticketType,
  phases,
}: {
  ticketType: SdTicketTypeDTO
  phases: SdPhaseDTO[]
}) {
  const { workspaceId, canEdit, config } = useSdSettingsContext()
  const { data } = useSdPhaseTransitions(workspaceId, ticketType)
  const save = useSaveSdPhaseTransitions(workspaceId, ticketType)
  const [matrix, setMatrix] = useState<Matrix>({})
  const [dirty, setDirty] = useState(false)

  const loaded = useMemo(() => {
    const out: Matrix = {}
    for (const t of data ?? []) {
      out[cellKey(t.fromPhaseId, t.toPhaseId)] = {
        allowedDepartmentIds: t.allowedDepartmentIds,
      }
    }
    return out
  }, [data])

  useEffect(() => {
    setMatrix(loaded)
    setDirty(false)
  }, [loaded])

  const departments = useMemo(
    () =>
      (config?.departments ?? []).flatMap((d) => [
        { id: d.id, name: d.name },
        ...d.children.map((c) => ({ id: c.id, name: `${d.name} › ${c.name}` })),
      ]),
    [config?.departments],
  )

  function update(next: Matrix) {
    setMatrix(next)
    setDirty(true)
  }

  function toggle(from: string, to: string, checked: boolean) {
    const next = { ...matrix }
    if (checked) next[cellKey(from, to)] = { allowedDepartmentIds: [] }
    else delete next[cellKey(from, to)]
    update(next)
  }

  function markAll() {
    const next: Matrix = {}
    for (const a of phases)
      for (const b of phases)
        if (a.id !== b.id)
          next[cellKey(a.id, b.id)] = { allowedDepartmentIds: [] }
    update(next)
  }

  function sequential() {
    const next: Matrix = {}
    const canceled = phases.filter((p) => p.category === 'CANCELED')
    phases.forEach((phase, index) => {
      const following = phases[index + 1]
      if (following)
        next[cellKey(phase.id, following.id)] = { allowedDepartmentIds: [] }
      for (const c of canceled)
        if (c.id !== phase.id)
          next[cellKey(phase.id, c.id)] = { allowedDepartmentIds: [] }
    })
    update(next)
  }

  async function handleSave() {
    try {
      await save.mutateAsync(
        Object.entries(matrix).map(([key, cell]) => {
          const [fromPhaseId, toPhaseId] = key.split('>')
          return {
            fromPhaseId,
            toPhaseId,
            allowedDepartmentIds: cell.allowedDepartmentIds,
          }
        }),
      )
      setDirty(false)
      notify.success('Transições salvas')
    } catch (err) {
      notify.error(err)
    }
  }

  const count = Object.keys(matrix).length

  return (
    <SettingsSection
      title='Transições'
      description='Linhas = fase de origem, colunas = destino. Sem nenhuma transição marcada o fluxo é livre (qualquer fase → qualquer fase).'
      actions={
        canEdit && phases.length > 1 ? (
          <>
            <Button variant='outline' size='xs' onClick={() => update({})}>
              Liberar tudo
            </Button>
            <Button variant='outline' size='xs' onClick={markAll}>
              Marcar todas
            </Button>
            <Button variant='outline' size='xs' onClick={sequential}>
              Sequencial
            </Button>
          </>
        ) : null
      }
    >
      {phases.length < 2 ? (
        <EmptyState>
          Cadastre ao menos duas fases para definir transições.
        </EmptyState>
      ) : (
        <>
          <div className='overflow-x-auto rounded-lg border border-border'>
            <table className='w-full border-collapse text-xs'>
              <thead>
                <tr className='bg-muted/50'>
                  <th className='sticky left-0 bg-muted/50 px-3 py-2 text-left font-medium'>
                    De \ Para
                  </th>
                  {phases.map((to) => (
                    <th key={to.id} className='px-2 py-2 font-medium'>
                      <span className='flex items-center justify-center gap-1 whitespace-nowrap'>
                        <ColorDot color={to.color} />
                        {to.name}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {phases.map((from) => (
                  <tr key={from.id} className='border-t border-border'>
                    <th className='sticky left-0 bg-card px-3 py-2 text-left font-medium'>
                      <span className='flex items-center gap-1.5 whitespace-nowrap'>
                        <ColorDot color={from.color} />
                        {from.name}
                      </span>
                    </th>
                    {phases.map((to) => {
                      const key = cellKey(from.id, to.id)
                      const cell = matrix[key]
                      const same = from.id === to.id
                      return (
                        <td
                          key={to.id}
                          className={cn(
                            'px-2 py-2 text-center',
                            same && 'bg-muted/40',
                          )}
                        >
                          {same ? (
                            <span className='text-muted-foreground'>—</span>
                          ) : (
                            <div className='flex items-center justify-center gap-1'>
                              <Checkbox
                                checked={!!cell}
                                disabled={!canEdit}
                                onCheckedChange={(checked) =>
                                  toggle(from.id, to.id, !!checked)
                                }
                                aria-label={`${from.name} para ${to.name}`}
                              />
                              {cell ? (
                                <DepartmentRestriction
                                  departments={departments}
                                  value={cell.allowedDepartmentIds}
                                  disabled={!canEdit}
                                  onChange={(ids) =>
                                    update({
                                      ...matrix,
                                      [key]: { allowedDepartmentIds: ids },
                                    })
                                  }
                                />
                              ) : null}
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <span className='text-xs text-muted-foreground'>
              {count === 0
                ? 'Fluxo livre.'
                : `${count} transição(ões) permitida(s).`}
            </span>
            {canEdit ? (
              <div className='flex gap-2'>
                <Button
                  variant='outline'
                  size='sm'
                  disabled={!dirty}
                  onClick={() => {
                    setMatrix(loaded)
                    setDirty(false)
                  }}
                >
                  Descartar
                </Button>
                <Button
                  size='sm'
                  disabled={!dirty || save.isPending}
                  onClick={handleSave}
                >
                  {save.isPending ? 'Salvando...' : 'Salvar transições'}
                </Button>
              </div>
            ) : null}
          </div>
        </>
      )}
    </SettingsSection>
  )
}

function DepartmentRestriction({
  departments,
  value,
  onChange,
  disabled,
}: {
  departments: { id: string; name: string }[]
  value: string[]
  onChange: (ids: string[]) => void
  disabled?: boolean
}) {
  return (
    <Popover>
      <PopoverTrigger
        disabled={disabled}
        render={
          <button
            type='button'
            aria-label='Restringir a departamentos'
            className={cn(
              'flex items-center gap-0.5 rounded px-1 text-[10px] transition',
              value.length > 0
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <SteelIcon icon={Building03Icon} strokeWidth={2} size={12} />
            {value.length > 0 ? value.length : null}
          </button>
        }
      />
      <PopoverContent className='w-64'>
        <p className='mb-2 text-xs text-muted-foreground'>
          Só membros destes departamentos podem fazer a transição (nenhum =
          qualquer agente).
        </p>
        {departments.length === 0 ? (
          <p className='text-xs text-muted-foreground'>Nenhum departamento.</p>
        ) : (
          <div className='flex max-h-60 flex-col gap-1.5 overflow-y-auto'>
            {departments.map((d) => (
              <label
                key={d.id}
                htmlFor={`sd-transition-dept-${d.id}`}
                className='flex items-center gap-2 text-xs'
              >
                <Checkbox
                  id={`sd-transition-dept-${d.id}`}
                  checked={value.includes(d.id)}
                  onCheckedChange={(checked) =>
                    onChange(
                      checked
                        ? [...value, d.id]
                        : value.filter((id) => id !== d.id),
                    )
                  }
                />
                {d.name}
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
