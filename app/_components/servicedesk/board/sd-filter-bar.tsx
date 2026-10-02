'use client'

import {
  Cancel01Icon,
  FilterIcon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type RefObject, useEffect, useState } from 'react'
import {
  SdConfigItemPicker,
  SdContactPicker,
  SdCustomerPicker,
} from '@/app/_components/servicedesk/pickers'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Kbd } from '@/components/ui/kbd'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { SD_RISK_LEVEL_LABEL } from '@/src/lib/servicedesk/risk'
import type { SdAgentDTO, SdConfigBootstrapDTO } from '@/types/sd-config'
import type { SdTicketTypeDTO } from '@/types/sd-ticket'
import { SdKbTagsInput } from '../knowledge/sd-kb-tags-input'
import { useDebouncedValue } from '../table/use-sd-table-state'
import { SdOptionSelect, type SdSelectOption } from '../ticket/sd-option-select'
import {
  SD_CHANNEL_LABEL,
  SD_TICKET_TYPE_LABEL,
  SD_TICKET_TYPES,
  sdFormatDate,
} from '../ticket/sd-ticket-meta'
import {
  sdCategoryChildOptions,
  sdCategoryName,
  sdCategoryOptions,
  sdClassificationOptions,
  sdDepartmentOptions,
  sdScaleOptions,
  sdTypePhases,
} from '../ticket/sd-ticket-options'
import {
  SD_QUICK_FILTERS,
  type SdBoardFilters,
  sdActiveFilterCount,
  sdNormalizeFilters,
  sdQuickFilterActive,
  sdToggleQuickFilter,
} from './sd-board-state'
import { SdMultiSelect } from './sd-multi-select'

export interface SdFilterChip {
  key: keyof SdBoardFilters
  label: string
  value: string
}

interface ChipLookup {
  config?: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  /** Rótulos conhecidos dos seletores assíncronos (cliente, contato, CI). */
  pickedLabels?: Record<string, string>
}

function names(
  ids: string[] | undefined,
  options: { value: string; label: string }[],
): string {
  return (ids ?? [])
    .map((id) => options.find((o) => o.value === id)?.label ?? id)
    .join(', ')
}

function assigneeName(id: string, agents: SdAgentDTO[]): string {
  if (id === 'me') return 'Eu'
  if (id === 'unassigned') return 'Não atribuído'
  return agents.find((a) => a.id === id)?.name ?? id
}

/** Chips dos filtros ativos (rótulo legível de cada um). */
export function sdFilterChips(
  filters: SdBoardFilters,
  { config, agents, pickedLabels = {} }: ChipLookup,
): SdFilterChip[] {
  const f = sdNormalizeFilters(filters as Record<string, unknown>)
  const phases = (config?.phases ?? []).flatMap((flow) =>
    flow.phases.map((p) => ({ value: p.id, label: p.name })),
  )
  const chips: SdFilterChip[] = []
  const push = (key: keyof SdBoardFilters, label: string, value: string) =>
    chips.push({ key, label, value })

  if (f.types) {
    push(
      'types',
      'Tipo',
      f.types.map((t) => SD_TICKET_TYPE_LABEL[t]).join(', '),
    )
  }
  if (f.phaseIds) push('phaseIds', 'Fase', names(f.phaseIds, phases))
  if (f.priorityIds) {
    push(
      'priorityIds',
      'Prioridade',
      names(f.priorityIds, sdScaleOptions(config?.priorities ?? [])),
    )
  }
  if (f.severityIds) {
    push(
      'severityIds',
      'Severidade',
      names(f.severityIds, sdScaleOptions(config?.severities ?? [])),
    )
  }
  if (f.impactIds) {
    push(
      'impactIds',
      'Impacto',
      names(f.impactIds, sdScaleOptions(config?.impacts ?? [])),
    )
  }
  if (f.urgencyIds) {
    push(
      'urgencyIds',
      'Urgência',
      names(f.urgencyIds, sdScaleOptions(config?.urgencies ?? [])),
    )
  }
  if (f.departmentIds) {
    push(
      'departmentIds',
      'Departamento',
      names(f.departmentIds, sdDepartmentOptions(config?.departments ?? [])),
    )
  }
  if (f.assigneeIds) {
    push(
      'assigneeIds',
      'Responsável',
      f.assigneeIds.map((id) => assigneeName(id, agents)).join(', '),
    )
  }
  if (f.requesterId) {
    push('requesterId', 'Solicitante', assigneeName(f.requesterId, agents))
  }
  if (f.participantId) {
    push('participantId', 'Participante', assigneeName(f.participantId, agents))
  }
  for (const [key, label] of [
    ['customerId', 'Cliente'],
    ['companyId', 'Empresa'],
    ['contactId', 'Contato'],
    ['configItemId', 'Item de configuração'],
  ] as const) {
    const id = f[key]
    if (id) push(key, label, pickedLabels[id] ?? 'selecionado')
  }
  for (const [key, label] of [
    ['categoryId', 'Categoria'],
    ['subcategoryId', 'Subcategoria'],
    ['serviceId', 'Serviço'],
  ] as const) {
    const id = f[key]
    if (id) {
      push(key, label, sdCategoryName(config?.categories ?? [], id) ?? id)
    }
  }
  if (f.classificationId) {
    push(
      'classificationId',
      'Classificação',
      config?.classifications.find((c) => c.id === f.classificationId)?.name ??
        f.classificationId,
    )
  }
  if (f.channel) push('channel', 'Canal', SD_CHANNEL_LABEL[f.channel])
  if (f.tags) push('tags', 'Tags', f.tags.map((t) => `#${t}`).join(' '))
  if (f.sla) {
    push('sla', 'SLA', f.sla === 'at_risk' ? 'Em risco' : 'Violado')
  }
  if (f.riskLevel) {
    push('riskLevel', 'Risco', SD_RISK_LEVEL_LABEL[f.riskLevel])
  }
  if (f.createdFrom) push('createdFrom', 'Aberto desde', sdDay(f.createdFrom))
  if (f.createdTo) push('createdTo', 'Aberto até', sdDay(f.createdTo))
  if (f.dueFrom) push('dueFrom', 'Prazo desde', sdDay(f.dueFrom))
  if (f.dueTo) push('dueTo', 'Prazo até', sdDay(f.dueTo))
  if (f.includeClosed) push('includeClosed', 'Inclui', 'fechados')
  return chips
}

function sdDay(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? sdFormatDate(`${value}T12:00:00`)
    : value
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className='font-medium text-muted-foreground text-xs'>{label}</span>
      {children}
    </div>
  )
}

/** Campos do popover "Filtros" (todos os filtros da API de chamados). */
function AdvancedFilters({
  workspaceId,
  filters,
  onChange,
  config,
  agents,
  fixedType,
  onPick,
}: {
  workspaceId: string
  filters: SdBoardFilters
  onChange: (filters: SdBoardFilters) => void
  config?: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  fixedType: SdTicketTypeDTO | null
  onPick: (id: string, label: string) => void
}) {
  const set = <K extends keyof SdBoardFilters>(
    key: K,
    value: SdBoardFilters[K] | null,
  ) =>
    onChange(
      sdNormalizeFilters({
        ...filters,
        [key]: value ?? undefined,
      } as Record<string, unknown>),
    )

  const phaseTypes = fixedType ? [fixedType] : SD_TICKET_TYPES
  const phaseOptions: SdSelectOption[] = phaseTypes.flatMap((type) =>
    sdTypePhases(config, type).map((p) => ({
      value: p.id,
      label: fixedType ? p.name : `${p.name} · ${SD_TICKET_TYPE_LABEL[type]}`,
      color: p.color,
    })),
  )
  const people: SdSelectOption[] = [
    { value: 'me', label: 'Eu' },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ]
  const categoryType = fixedType ?? filters.types?.[0]

  return (
    <div className='grid max-h-[65vh] grid-cols-1 gap-3 overflow-y-auto p-1 sm:grid-cols-2'>
      {fixedType ? null : (
        <Field label='Tipo'>
          <SdMultiSelect
            label='Tipo'
            value={filters.types ?? []}
            onChange={(v) => set('types', v as SdTicketTypeDTO[])}
            options={SD_TICKET_TYPES.map((t) => ({
              value: t,
              label: SD_TICKET_TYPE_LABEL[t],
            }))}
          />
        </Field>
      )}
      <Field label='Fase'>
        <SdMultiSelect
          label='Fase'
          value={filters.phaseIds ?? []}
          onChange={(v) => set('phaseIds', v)}
          options={phaseOptions}
        />
      </Field>
      <Field label='Prioridade'>
        <SdMultiSelect
          label='Prioridade'
          value={filters.priorityIds ?? []}
          onChange={(v) => set('priorityIds', v)}
          options={sdScaleOptions(config?.priorities ?? [])}
        />
      </Field>
      <Field label='Severidade'>
        <SdMultiSelect
          label='Severidade'
          value={filters.severityIds ?? []}
          onChange={(v) => set('severityIds', v)}
          options={sdScaleOptions(config?.severities ?? [])}
        />
      </Field>
      <Field label='Impacto'>
        <SdMultiSelect
          label='Impacto'
          value={filters.impactIds ?? []}
          onChange={(v) => set('impactIds', v)}
          options={sdScaleOptions(config?.impacts ?? [])}
        />
      </Field>
      <Field label='Urgência'>
        <SdMultiSelect
          label='Urgência'
          value={filters.urgencyIds ?? []}
          onChange={(v) => set('urgencyIds', v)}
          options={sdScaleOptions(config?.urgencies ?? [])}
        />
      </Field>
      <Field label='Departamento'>
        <SdMultiSelect
          label='Departamento'
          value={filters.departmentIds ?? []}
          onChange={(v) => set('departmentIds', v)}
          options={sdDepartmentOptions(config?.departments ?? [])}
        />
      </Field>
      <Field label='Responsável'>
        <SdMultiSelect
          label='Responsável'
          value={filters.assigneeIds ?? []}
          onChange={(v) => set('assigneeIds', v)}
          options={[
            { value: 'me', label: 'Eu' },
            { value: 'unassigned', label: 'Não atribuído' },
            ...agents
              .filter((a) => a.isAgent)
              .map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </Field>
      <Field label='Solicitante'>
        <SdOptionSelect
          aria-label='Solicitante'
          value={filters.requesterId ?? null}
          onChange={(v) => set('requesterId', v)}
          options={people}
          noneLabel='Todos'
          placeholder='Todos'
        />
      </Field>
      <Field label='Participante'>
        <SdOptionSelect
          aria-label='Participante'
          value={filters.participantId ?? null}
          onChange={(v) => set('participantId', v)}
          options={people}
          noneLabel='Todos'
          placeholder='Todos'
        />
      </Field>
      <Field label='Cliente'>
        <SdCustomerPicker
          workspaceId={workspaceId}
          kind='CLIENT'
          allowCreate={false}
          placeholder='Todos'
          value={filters.customerId ?? null}
          onChange={(o) => {
            if (o) onPick(o.id, o.label)
            set('customerId', o?.id ?? null)
          }}
        />
      </Field>
      <Field label='Empresa'>
        <SdCustomerPicker
          workspaceId={workspaceId}
          kind='COMPANY'
          allowCreate={false}
          placeholder='Todas'
          value={filters.companyId ?? null}
          onChange={(o) => {
            if (o) onPick(o.id, o.label)
            set('companyId', o?.id ?? null)
          }}
        />
      </Field>
      <Field label='Contato'>
        <SdContactPicker
          workspaceId={workspaceId}
          allowCreate={false}
          placeholder='Todos'
          value={filters.contactId ?? null}
          onChange={(o) => {
            if (o) onPick(o.id, o.label)
            set('contactId', o?.id ?? null)
          }}
        />
      </Field>
      <Field label='Item de configuração'>
        <SdConfigItemPicker
          workspaceId={workspaceId}
          allowCreate={false}
          placeholder='Todos'
          value={filters.configItemId ?? null}
          onChange={(o) => {
            if (o) onPick(o.id, o.label)
            set('configItemId', o?.id ?? null)
          }}
        />
      </Field>
      <Field label='Categoria'>
        <SdOptionSelect
          aria-label='Categoria'
          value={filters.categoryId ?? null}
          onChange={(v) =>
            onChange(
              sdNormalizeFilters({
                ...filters,
                categoryId: v ?? undefined,
                subcategoryId: undefined,
                serviceId: undefined,
              } as Record<string, unknown>),
            )
          }
          options={sdCategoryOptions(config?.categories ?? [], categoryType)}
          noneLabel='Todas'
          placeholder='Todas'
        />
      </Field>
      <Field label='Subcategoria'>
        <SdOptionSelect
          aria-label='Subcategoria'
          value={filters.subcategoryId ?? null}
          disabled={!filters.categoryId}
          onChange={(v) =>
            onChange(
              sdNormalizeFilters({
                ...filters,
                subcategoryId: v ?? undefined,
                serviceId: undefined,
              } as Record<string, unknown>),
            )
          }
          options={sdCategoryChildOptions(
            config?.categories ?? [],
            filters.categoryId,
            categoryType,
          )}
          noneLabel='Todas'
          placeholder='Todas'
        />
      </Field>
      <Field label='Serviço'>
        <SdOptionSelect
          aria-label='Serviço'
          value={filters.serviceId ?? null}
          disabled={!filters.subcategoryId}
          onChange={(v) => set('serviceId', v)}
          options={sdCategoryChildOptions(
            config?.categories ?? [],
            filters.subcategoryId,
            categoryType,
          )}
          noneLabel='Todos'
          placeholder='Todos'
        />
      </Field>
      <Field label='Classificação'>
        <SdOptionSelect
          aria-label='Classificação'
          value={filters.classificationId ?? null}
          onChange={(v) => set('classificationId', v)}
          options={sdClassificationOptions(
            config?.classifications ?? [],
            'TICKET',
            categoryType,
          )}
          noneLabel='Todas'
          placeholder='Todas'
        />
      </Field>
      <Field label='Canal'>
        <SdOptionSelect
          aria-label='Canal'
          value={filters.channel ?? null}
          onChange={(v) =>
            set('channel', (v ?? undefined) as SdBoardFilters['channel'])
          }
          options={Object.entries(SD_CHANNEL_LABEL).map(([value, label]) => ({
            value,
            label,
          }))}
          noneLabel='Todos'
          placeholder='Todos'
        />
      </Field>
      <Field label='SLA'>
        <SdOptionSelect
          aria-label='SLA'
          value={filters.sla ?? null}
          onChange={(v) =>
            set('sla', (v ?? undefined) as SdBoardFilters['sla'])
          }
          options={[
            { value: 'at_risk', label: 'Em risco' },
            { value: 'breached', label: 'Violado' },
          ]}
          noneLabel='Todos'
          placeholder='Todos'
        />
      </Field>
      <Field label='Tags' className='sm:col-span-2'>
        <div className='min-h-8 rounded-md border px-2 py-1'>
          <SdKbTagsInput
            value={filters.tags ?? []}
            onChange={(tags) => set('tags', tags)}
          />
        </div>
      </Field>
      <Field label='Aberto entre'>
        <div className='flex items-center gap-1'>
          <Input
            type='date'
            aria-label='Aberto desde'
            className='h-8'
            value={filters.createdFrom ?? ''}
            onChange={(e) => set('createdFrom', e.target.value || null)}
          />
          <Input
            type='date'
            aria-label='Aberto até'
            className='h-8'
            value={filters.createdTo ?? ''}
            onChange={(e) => set('createdTo', e.target.value || null)}
          />
        </div>
      </Field>
      <Field label='Prazo de resolução entre'>
        <div className='flex items-center gap-1'>
          <Input
            type='date'
            aria-label='Prazo desde'
            className='h-8'
            value={filters.dueFrom ?? ''}
            onChange={(e) => set('dueFrom', e.target.value || null)}
          />
          <Input
            type='date'
            aria-label='Prazo até'
            className='h-8'
            value={filters.dueTo ?? ''}
            onChange={(e) => set('dueTo', e.target.value || null)}
          />
        </div>
      </Field>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: o Switch é o controle */}
      <label className='flex items-center gap-2 text-sm sm:col-span-2'>
        <Switch
          checked={Boolean(filters.includeClosed)}
          onCheckedChange={(checked) =>
            set('includeClosed', checked ? true : null)
          }
        />
        Incluir resolvidos, fechados e cancelados
      </label>
    </div>
  )
}

/**
 * Barra de filtros dos quadros: busca (atalho `/`), filtros rápidos,
 * popover com todos os filtros, chips dos ativos e "limpar tudo".
 */
export function SdFilterBar({
  workspaceId,
  filters,
  onChange,
  config,
  agents,
  fixedType,
  searchRef,
  children,
}: {
  workspaceId: string
  filters: SdBoardFilters
  onChange: (filters: SdBoardFilters) => void
  config?: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  fixedType: SdTicketTypeDTO | null
  searchRef?: RefObject<HTMLInputElement | null>
  /** Controles extras à direita (modo, visões, colunas…). */
  children?: React.ReactNode
}) {
  const [search, setSearch] = useState(filters.q ?? '')
  const [picked, setPicked] = useState<Record<string, string>>({})
  const debounced = useDebouncedValue(search.trim())

  // URL → campo (voltar do navegador, visão salva aplicada).
  const [lastQ, setLastQ] = useState(filters.q ?? '')
  if ((filters.q ?? '') !== lastQ) {
    setLastQ(filters.q ?? '')
    setSearch(filters.q ?? '')
  }

  // Campo → URL (com debounce).
  useEffect(() => {
    if (debounced === (filters.q ?? '')) return
    onChange(
      sdNormalizeFilters({ ...filters, q: debounced } as Record<
        string,
        unknown
      >),
    )
    // Só reage à busca digitada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const active = sdActiveFilterCount(filters)
  const chips = sdFilterChips(filters, { config, agents, pickedLabels: picked })

  return (
    <div className='flex shrink-0 flex-col gap-2 border-b px-4 py-2.5'>
      <div className='flex flex-wrap items-center gap-2'>
        <div className='relative'>
          <SteelIcon
            icon={Search01Icon}
            strokeWidth={2}
            className='-translate-y-1/2 absolute top-1/2 left-2.5 size-4 text-muted-foreground'
          />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder='Buscar por título, descrição ou código…'
            aria-label='Buscar chamados'
            className='h-8 w-72 pr-8 pl-8'
          />
          <Kbd className='-translate-y-1/2 absolute top-1/2 right-2'>/</Kbd>
        </div>

        <div className='flex flex-wrap items-center gap-1'>
          {SD_QUICK_FILTERS.map((quick) => {
            const on = sdQuickFilterActive(quick.id, filters)
            return (
              <button
                key={quick.id}
                type='button'
                aria-pressed={on}
                onClick={() => onChange(sdToggleQuickFilter(quick.id, filters))}
                className={cn(
                  'h-7 rounded-full border px-2.5 font-medium text-xs transition-colors',
                  on
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                {quick.label}
              </button>
            )
          })}
        </div>

        <Popover>
          <PopoverTrigger
            render={
              <Button variant='outline' size='sm'>
                <SteelIcon icon={FilterIcon} strokeWidth={2} />
                Filtros
                {active > 0 ? (
                  <span className='ml-0.5 rounded bg-primary px-1 text-primary-foreground text-xs tabular-nums'>
                    {active}
                  </span>
                ) : null}
              </Button>
            }
          />
          <PopoverContent align='start' className='w-[min(40rem,92vw)] p-3'>
            <AdvancedFilters
              workspaceId={workspaceId}
              filters={filters}
              onChange={onChange}
              config={config}
              agents={agents}
              fixedType={fixedType}
              onPick={(id, label) =>
                setPicked((current) => ({ ...current, [id]: label }))
              }
            />
          </PopoverContent>
        </Popover>

        <div className='ml-auto flex flex-wrap items-center gap-2'>
          {children}
        </div>
      </div>

      {chips.length > 0 ? (
        <div className='flex flex-wrap items-center gap-1.5'>
          {chips.map((chip) => (
            <span
              key={chip.key}
              className='inline-flex h-6 items-center gap-1 rounded-md border bg-muted/40 pr-1 pl-2 text-xs'
            >
              <span className='text-muted-foreground'>{chip.label}:</span>
              <span className='max-w-56 truncate font-medium'>
                {chip.value}
              </span>
              <button
                type='button'
                aria-label={`Remover filtro ${chip.label}`}
                className='rounded p-0.5 hover:bg-background'
                onClick={() =>
                  onChange(
                    sdNormalizeFilters({
                      ...filters,
                      [chip.key]: undefined,
                    } as Record<string, unknown>),
                  )
                }
              >
                <SteelIcon
                  icon={Cancel01Icon}
                  strokeWidth={2}
                  className='size-3'
                />
              </button>
            </span>
          ))}
          <Button
            variant='ghost'
            size='xs'
            onClick={() => {
              setSearch('')
              onChange({})
            }}
          >
            Limpar tudo
          </Button>
        </div>
      ) : null}
    </div>
  )
}
