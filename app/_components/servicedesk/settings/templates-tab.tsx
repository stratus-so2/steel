'use client'

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  CheckListIcon,
  PencilEdit02Icon,
  PlusSignIcon,
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSdConfigList,
  useSdConfigMutations,
} from '@/src/hooks/use-sd-config'
import {
  isSdCustomFieldApplicable,
  isSdCustomFieldEmpty,
  validateSdCustomFieldValue,
} from '@/src/lib/servicedesk/custom-fields'
import type {
  CreateSdTicketTemplateDTO,
  SdTicketTemplateDefaults,
  UpdateSdTicketTemplateDTO,
} from '@/src/schemas/sd-ticket-template.schema'
import type {
  SdCategoryTreeDTO,
  SdTicketTemplateDTO,
  SdTicketTemplateTaskDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'
import { SdCustomFieldInput } from './custom-fields-tab'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SD_TICKET_TYPE_OPTIONS,
  SettingsSection,
  SimpleSelect,
  SortableList,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

const CHANGE_TYPES = [
  { value: 'STANDARD', label: 'Padrão' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'EMERGENCY', label: 'Emergencial' },
] as const

const RISK_LEVELS = [
  { value: 'LOW', label: 'Baixo' },
  { value: 'MEDIUM', label: 'Médio' },
  { value: 'HIGH', label: 'Alto' },
  { value: 'VERY_HIGH', label: 'Muito alto' },
] as const

type ChangeType = (typeof CHANGE_TYPES)[number]['value']
type RiskLevel = (typeof RISK_LEVELS)[number]['value']

function flatCategories(
  nodes: SdCategoryTreeDTO[] | undefined,
): SdCategoryTreeDTO[] {
  return (nodes ?? []).flatMap((n) => [n, ...flatCategories(n.children)])
}

export function SdTemplatesTab() {
  const { workspaceId, canEdit, config } = useSdSettingsContext()
  const [filter, setFilter] = useState<SdTicketTypeDTO | null>(null)
  const [editing, setEditing] = useState<SdTicketTemplateDTO | 'new' | null>(
    null,
  )
  const { data, isLoading } = useSdConfigList<SdTicketTemplateDTO>(
    workspaceId,
    'ticket-templates',
    { includeInactive: true },
  )
  const mutations = useSdConfigMutations<
    SdTicketTemplateDTO,
    CreateSdTicketTemplateDTO,
    UpdateSdTicketTemplateDTO
  >(workspaceId, 'ticket-templates')

  const categories = useMemo(
    () => flatCategories(config?.categories),
    [config?.categories],
  )
  const departments = useMemo(
    () => (config?.departments ?? []).flatMap((d) => [d, ...d.children]),
    [config?.departments],
  )
  const nameOf = (list: { id: string; name: string }[], id?: string) =>
    id ? list.find((i) => i.id === id)?.name : undefined

  const templates = data ?? []
  const groups = SD_TICKET_TYPE_OPTIONS.filter(
    (o) => !filter || o.value === filter,
  )

  async function toggleActive(item: SdTicketTemplateDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: item.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-center justify-between gap-3'>
        <div className='flex flex-wrap gap-1.5'>
          <FilterChip active={!filter} onClick={() => setFilter(null)}>
            Todos
          </FilterChip>
          {SD_TICKET_TYPE_OPTIONS.map((option) => (
            <FilterChip
              key={option.value}
              active={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </FilterChip>
          ))}
        </div>
        {canEdit ? (
          <Button size='sm' onClick={() => setEditing('new')}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo modelo
          </Button>
        ) : null}
      </div>

      {groups.map((group) => {
        const items = templates.filter((t) => t.ticketType === group.value)
        return (
          <SettingsSection
            key={group.value}
            title={`Modelos de ${group.label.toLowerCase()}`}
            description='Arraste para definir a ordem de exibição na abertura do chamado.'
          >
            {!isLoading && items.length === 0 ? (
              <EmptyState>Nenhum modelo para este tipo.</EmptyState>
            ) : (
              <SortableList
                items={items}
                disabled={!canEdit}
                onReorder={(orderedIds) =>
                  mutations.reorder.mutate(
                    { orderedIds },
                    { onError: (err) => notify.error(err) },
                  )
                }
                renderItem={(item, handle) => {
                  const d = item.defaults
                  const summary = [
                    nameOf(
                      categories,
                      d.serviceId ?? d.subcategoryId ?? d.categoryId,
                    ),
                    nameOf(config?.priorities ?? [], d.priorityId),
                    nameOf(departments, d.departmentId),
                  ].filter(Boolean)
                  return (
                    <div
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-border bg-background px-3 py-2.5',
                        !item.active && 'opacity-60',
                      )}
                    >
                      <div className='pt-0.5'>{handle}</div>
                      <div className='flex min-w-0 flex-1 flex-col gap-1'>
                        <div className='flex flex-wrap items-center gap-2'>
                          <span className='truncate text-sm font-medium'>
                            {item.name}
                          </span>
                          {item.portalVisible ? (
                            <Badge variant='outline'>Portal</Badge>
                          ) : null}
                          {item.tasks.length > 0 ? (
                            <Badge variant='secondary'>
                              <SteelIcon icon={CheckListIcon} strokeWidth={2} />
                              {item.tasks.length}{' '}
                              {item.tasks.length === 1 ? 'tarefa' : 'tarefas'}
                            </Badge>
                          ) : null}
                        </div>
                        {item.description ? (
                          <span className='line-clamp-2 text-xs text-muted-foreground'>
                            {item.description}
                          </span>
                        ) : null}
                        {summary.length > 0 ? (
                          <span className='text-xs text-muted-foreground'>
                            {summary.join(' · ')}
                          </span>
                        ) : null}
                      </div>
                      <Switch
                        checked={item.active}
                        disabled={!canEdit}
                        onCheckedChange={(value) => toggleActive(item, value)}
                        aria-label={item.active ? 'Desativar' : 'Ativar'}
                      />
                      {canEdit ? (
                        <>
                          <Button
                            type='button'
                            variant='ghost'
                            size='icon-xs'
                            aria-label={`Editar ${item.name}`}
                            onClick={() => setEditing(item)}
                          >
                            <SteelIcon
                              icon={PencilEdit02Icon}
                              strokeWidth={2}
                            />
                          </Button>
                          <ConfirmDeleteButton
                            title='Excluir modelo'
                            description={`O modelo "${item.name}" será removido. Chamados já abertos com ele não mudam.`}
                            pending={mutations.remove.isPending}
                            onConfirm={() =>
                              mutations.remove.mutate(item.id, {
                                onError: (err) => notify.error(err),
                              })
                            }
                          />
                        </>
                      ) : null}
                    </div>
                  )
                }}
              />
            )}
          </SettingsSection>
        )
      })}

      {editing ? (
        <TemplateDialog
          item={editing === 'new' ? null : editing}
          initialType={filter ?? 'SERVICE_REQUEST'}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setEditing(null)}
          onCreate={async (data) => {
            try {
              await mutations.create.mutateAsync(data)
              notify.success('Modelo criado')
              setEditing(null)
            } catch (err) {
              notify.error(err)
            }
          }}
          onUpdate={async (id, data) => {
            try {
              await mutations.update.mutateAsync({ id, data })
              notify.success('Modelo salvo')
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

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type='button'
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1 text-xs transition',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {children}
    </button>
  )
}

function DialogSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className='flex flex-col gap-3'>
      <h4 className='text-xs font-semibold uppercase tracking-wide text-muted-foreground'>
        {title}
      </h4>
      {children}
    </div>
  )
}

function TemplateDialog({
  item,
  initialType,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: {
  item: SdTicketTemplateDTO | null
  initialType: SdTicketTypeDTO
  saving: boolean
  onClose: () => void
  onCreate: (data: CreateSdTicketTemplateDTO) => void
  onUpdate: (id: string, data: UpdateSdTicketTemplateDTO) => void
}) {
  const { config } = useSdSettingsContext()
  const d = item?.defaults ?? {}
  const [ticketType, setTicketType] = useState<SdTicketTypeDTO>(
    item?.ticketType ?? initialType,
  )
  const [name, setName] = useState(item?.name ?? '')
  const [description, setDescription] = useState(item?.description ?? '')
  const [portalVisible, setPortalVisible] = useState(
    item?.portalVisible ?? false,
  )
  const [active, setActive] = useState(item?.active ?? true)
  const [title, setTitle] = useState(d.title ?? '')
  const [body, setBody] = useState(d.description ?? '')
  const [categoryId, setCategoryId] = useState(d.categoryId ?? null)
  const [subcategoryId, setSubcategoryId] = useState(d.subcategoryId ?? null)
  const [serviceId, setServiceId] = useState(d.serviceId ?? null)
  const [priorityId, setPriorityId] = useState(d.priorityId ?? null)
  const [impactId, setImpactId] = useState(d.impactId ?? null)
  const [urgencyId, setUrgencyId] = useState(d.urgencyId ?? null)
  const [severityId, setSeverityId] = useState(d.severityId ?? null)
  const [classificationId, setClassificationId] = useState(
    d.classificationId ?? null,
  )
  const [departmentId, setDepartmentId] = useState(d.departmentId ?? null)
  const [tags, setTags] = useState<string[]>(d.tags ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [changeType, setChangeType] = useState<ChangeType | null>(
    d.changeType ?? null,
  )
  const [changeRisk, setChangeRisk] = useState<RiskLevel | null>(
    d.changeRisk ?? null,
  )
  const [implementationPlan, setImplementationPlan] = useState(
    d.implementationPlan ?? '',
  )
  const [rollbackPlan, setRollbackPlan] = useState(d.rollbackPlan ?? '')
  const [testPlan, setTestPlan] = useState(d.testPlan ?? '')
  const [customValues, setCustomValues] = useState<Record<string, unknown>>(
    d.customFields ?? {},
  )
  const [tasks, setTasks] = useState<SdTicketTemplateTaskDTO[]>(
    item?.tasks ?? [],
  )

  const categories = config?.categories ?? []
  const subcategories =
    categories.find((c) => c.id === categoryId)?.children ?? []
  const services =
    subcategories.find((s) => s.id === subcategoryId)?.children ?? []
  const forType = <T extends { ticketTypes: SdTicketTypeDTO[] }>(list: T[]) =>
    list.filter(
      (i) => i.ticketTypes.length === 0 || i.ticketTypes.includes(ticketType),
    )
  const toOptions = (list: { id: string; name: string }[]) =>
    list.map((i) => ({ value: i.id, label: i.name }))
  const departments = (config?.departments ?? []).flatMap((dep) => [
    { value: dep.id, label: dep.name },
    ...dep.children.map((c) => ({ value: c.id, label: `  ↳ ${c.name}` })),
  ])
  const classifications = forType(
    (config?.classifications ?? []).filter(
      (c) => c.kind === 'TICKET' && c.active,
    ),
  )
  const customFields = (config?.customFields ?? []).filter(
    (f) =>
      f.entity === 'TICKET' &&
      f.active &&
      isSdCustomFieldApplicable(f, { ticketType }),
  )

  const customIssues = customFields.flatMap((f) => {
    const value = customValues[f.key]
    if (isSdCustomFieldEmpty(value)) return []
    const check = validateSdCustomFieldValue(f, value)
    return check.ok ? [] : [`${f.label} ${check.message}`]
  })

  function addTag() {
    const tag = tagDraft.trim()
    if (tag && !tags.includes(tag) && tags.length < 30) {
      setTags([...tags, tag.slice(0, 50)])
    }
    setTagDraft('')
  }

  function moveTask(index: number, delta: number) {
    setTasks((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  function buildDefaults(): SdTicketTemplateDefaults {
    const out: SdTicketTemplateDefaults = {}
    const text = (v: string) => v.trim() || undefined
    if (text(title)) out.title = title.trim()
    if (text(body)) out.description = body.trim()
    if (categoryId) out.categoryId = categoryId
    if (subcategoryId) out.subcategoryId = subcategoryId
    if (serviceId) out.serviceId = serviceId
    if (priorityId) out.priorityId = priorityId
    if (impactId) out.impactId = impactId
    if (urgencyId) out.urgencyId = urgencyId
    if (severityId) out.severityId = severityId
    if (classificationId) out.classificationId = classificationId
    if (departmentId) out.departmentId = departmentId
    if (tags.length > 0) out.tags = tags
    if (ticketType === 'CHANGE') {
      if (changeType) out.changeType = changeType
      if (changeRisk) out.changeRisk = changeRisk
      if (text(implementationPlan))
        out.implementationPlan = implementationPlan.trim()
      if (text(rollbackPlan)) out.rollbackPlan = rollbackPlan.trim()
      if (text(testPlan)) out.testPlan = testPlan.trim()
    }
    const custom: Record<string, unknown> = {}
    for (const field of customFields) {
      const value = customValues[field.key]
      if (isSdCustomFieldEmpty(value)) continue
      const check = validateSdCustomFieldValue(field, value)
      if (check.ok) custom[field.key] = check.value
    }
    if (Object.keys(custom).length > 0) out.customFields = custom
    return out
  }

  const cleanTasks = tasks
    .map((t) => ({
      title: t.title.trim(),
      ...(t.description?.trim() ? { description: t.description.trim() } : {}),
    }))
    .filter((t) => t.title)
  const canSave = !!name.trim() && customIssues.length === 0 && !saving

  function save() {
    const common = {
      name: name.trim(),
      description: description.trim() || null,
      defaults: buildDefaults(),
      tasks: cleanTasks,
      portalVisible,
      active,
    }
    if (item) onUpdate(item.id, common)
    else onCreate({ ...common, ticketType })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {item ? `Editar "${item.name}"` : 'Novo modelo de chamado'}
          </DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-6'>
          <DialogSection title='Básico'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldBlock
                label='Tipo de chamado'
                hint={item ? 'O tipo não muda depois de criado.' : undefined}
              >
                <SimpleSelect
                  value={ticketType}
                  onChange={(v) => v && setTicketType(v)}
                  options={SD_TICKET_TYPE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                  }))}
                  disabled={!!item}
                />
              </FieldBlock>
              <FieldBlock label='Nome'>
                <Input
                  value={name}
                  maxLength={120}
                  onChange={(e) => setName(e.target.value)}
                  placeholder='Ex.: Reset de senha'
                />
              </FieldBlock>
            </div>
            <FieldBlock label='Descrição'>
              <Textarea
                value={description}
                rows={2}
                onChange={(e) => setDescription(e.target.value)}
              />
            </FieldBlock>
            <div className='flex flex-col divide-y divide-border rounded-lg border border-border px-3'>
              <ToggleRow
                label='Visível no portal'
                description='O solicitante pode abrir chamados com este modelo.'
                checked={portalVisible}
                onCheckedChange={setPortalVisible}
              />
              <ToggleRow
                label='Ativo'
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </DialogSection>

          <DialogSection title='Valores padrão'>
            <FieldBlock label='Título do chamado'>
              <Input
                value={title}
                maxLength={200}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Descrição do chamado'>
              <Textarea
                value={body}
                rows={3}
                onChange={(e) => setBody(e.target.value)}
              />
            </FieldBlock>
            <div className='grid gap-4 sm:grid-cols-3'>
              <FieldBlock label='Categoria'>
                <SimpleSelect
                  value={categoryId}
                  onChange={(v) => {
                    setCategoryId(v)
                    setSubcategoryId(null)
                    setServiceId(null)
                  }}
                  options={toOptions(forType(categories))}
                  allowEmpty
                />
              </FieldBlock>
              <FieldBlock label='Subcategoria'>
                <SimpleSelect
                  value={subcategoryId}
                  onChange={(v) => {
                    setSubcategoryId(v)
                    setServiceId(null)
                  }}
                  options={toOptions(forType(subcategories))}
                  allowEmpty
                  disabled={!categoryId}
                />
              </FieldBlock>
              <FieldBlock label='Serviço'>
                <SimpleSelect
                  value={serviceId}
                  onChange={setServiceId}
                  options={toOptions(forType(services))}
                  allowEmpty
                  disabled={!subcategoryId}
                />
              </FieldBlock>
              <FieldBlock label='Prioridade'>
                <SimpleSelect
                  value={priorityId}
                  onChange={setPriorityId}
                  options={toOptions(config?.priorities ?? [])}
                  allowEmpty
                  emptyLabel='Pela matriz'
                />
              </FieldBlock>
              <FieldBlock label='Impacto'>
                <SimpleSelect
                  value={impactId}
                  onChange={setImpactId}
                  options={toOptions(config?.impacts ?? [])}
                  allowEmpty
                />
              </FieldBlock>
              <FieldBlock label='Urgência'>
                <SimpleSelect
                  value={urgencyId}
                  onChange={setUrgencyId}
                  options={toOptions(config?.urgencies ?? [])}
                  allowEmpty
                />
              </FieldBlock>
              <FieldBlock label='Severidade'>
                <SimpleSelect
                  value={severityId}
                  onChange={setSeverityId}
                  options={toOptions(config?.severities ?? [])}
                  allowEmpty
                />
              </FieldBlock>
              <FieldBlock label='Classificação'>
                <SimpleSelect
                  value={classificationId}
                  onChange={setClassificationId}
                  options={toOptions(classifications)}
                  allowEmpty
                />
              </FieldBlock>
              <FieldBlock label='Departamento'>
                <SimpleSelect
                  value={departmentId}
                  onChange={setDepartmentId}
                  options={departments}
                  allowEmpty
                  emptyLabel='Pelo roteamento'
                />
              </FieldBlock>
            </div>
            <FieldBlock label='Tags'>
              <div className='flex flex-wrap items-center gap-1.5 rounded-md border border-border px-2 py-1.5'>
                {tags.map((tag) => (
                  <Badge key={tag} variant='secondary'>
                    {tag}
                    <button
                      type='button'
                      aria-label={`Remover ${tag}`}
                      onClick={() => setTags(tags.filter((t) => t !== tag))}
                    >
                      <SteelIcon
                        icon={Cancel01Icon}
                        strokeWidth={2}
                        size={12}
                      />
                    </button>
                  </Badge>
                ))}
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  onBlur={addTag}
                  placeholder={tags.length ? '' : 'Digite e tecle Enter'}
                  className='min-w-32 flex-1 bg-transparent text-sm outline-none'
                />
              </div>
            </FieldBlock>

            {ticketType === 'CHANGE' ? (
              <div className='flex flex-col gap-4 rounded-lg border border-border p-3'>
                <div className='grid gap-4 sm:grid-cols-2'>
                  <FieldBlock label='Tipo de mudança'>
                    <SimpleSelect
                      value={changeType}
                      onChange={setChangeType}
                      options={[...CHANGE_TYPES]}
                      allowEmpty
                    />
                  </FieldBlock>
                  <FieldBlock label='Risco'>
                    <SimpleSelect
                      value={changeRisk}
                      onChange={setChangeRisk}
                      options={[...RISK_LEVELS]}
                      allowEmpty
                    />
                  </FieldBlock>
                </div>
                <FieldBlock label='Plano de implementação'>
                  <Textarea
                    value={implementationPlan}
                    rows={3}
                    onChange={(e) => setImplementationPlan(e.target.value)}
                  />
                </FieldBlock>
                <FieldBlock label='Plano de rollback'>
                  <Textarea
                    value={rollbackPlan}
                    rows={2}
                    onChange={(e) => setRollbackPlan(e.target.value)}
                  />
                </FieldBlock>
                <FieldBlock label='Plano de testes'>
                  <Textarea
                    value={testPlan}
                    rows={2}
                    onChange={(e) => setTestPlan(e.target.value)}
                  />
                </FieldBlock>
              </div>
            ) : null}
          </DialogSection>

          {customFields.length > 0 ? (
            <DialogSection title='Campos customizados'>
              <div className='grid gap-4 sm:grid-cols-2'>
                {customFields.map((field) => (
                  <FieldBlock key={field.id} label={field.label}>
                    <SdCustomFieldInput
                      type={field.type}
                      options={field.options}
                      value={
                        customValues[field.key] ??
                        (field.type === 'MULTI_SELECT'
                          ? []
                          : field.type === 'CHECKBOX'
                            ? false
                            : '')
                      }
                      onChange={(value) =>
                        setCustomValues((values) => ({
                          ...values,
                          [field.key]: value,
                        }))
                      }
                    />
                  </FieldBlock>
                ))}
              </div>
              {customIssues.length > 0 ? (
                <ul className='text-xs text-destructive'>
                  {customIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </DialogSection>
          ) : null}

          <DialogSection title='Checklist de tarefas'>
            {tasks.length === 0 ? (
              <p className='text-xs text-muted-foreground'>
                As tarefas viram o checklist do chamado aberto pelo modelo.
              </p>
            ) : null}
            <div className='flex flex-col gap-2'>
              {tasks.map((task, index) => (
                <div
                  key={index}
                  className='flex items-start gap-2 rounded-lg border border-border p-2'
                >
                  <span className='mt-2 w-5 text-center text-xs text-muted-foreground'>
                    {index + 1}
                  </span>
                  <div className='flex flex-1 flex-col gap-1.5'>
                    <Input
                      value={task.title}
                      maxLength={200}
                      placeholder='Título da tarefa'
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((t, i) =>
                            i === index ? { ...t, title: e.target.value } : t,
                          ),
                        )
                      }
                    />
                    <Input
                      value={task.description ?? ''}
                      placeholder='Descrição (opcional)'
                      className='text-xs'
                      onChange={(e) =>
                        setTasks((list) =>
                          list.map((t, i) =>
                            i === index
                              ? { ...t, description: e.target.value }
                              : t,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label='Subir'
                    disabled={index === 0}
                    onClick={() => moveTask(index, -1)}
                  >
                    <SteelIcon icon={ArrowUp01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label='Descer'
                    disabled={index === tasks.length - 1}
                    onClick={() => moveTask(index, 1)}
                  >
                    <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
                  </Button>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon-xs'
                    aria-label='Remover tarefa'
                    onClick={() =>
                      setTasks((list) => list.filter((_, i) => i !== index))
                    }
                  >
                    <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
                  </Button>
                </div>
              ))}
              <Button
                type='button'
                variant='outline'
                size='xs'
                className='w-fit'
                disabled={tasks.length >= 100}
                onClick={() => setTasks((list) => [...list, { title: '' }])}
              >
                <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
                Adicionar tarefa
              </Button>
            </div>
          </DialogSection>
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button size='sm' disabled={!canSave} onClick={save}>
            {saving ? 'Salvando...' : item ? 'Salvar' : 'Criar modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
