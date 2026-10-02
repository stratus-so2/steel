'use client'

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Delete02Icon,
  DragDropVerticalIcon,
  InformationCircleIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react'
import { SteelIcon } from '@/components/icon/icon'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
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
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type {
  SdConfigBootstrapDTO,
  SdPhaseCategoryDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'

// ── Contexto da tela ───────────────────────────────────────────────────────

export interface SdSettingsContextValue {
  workspaceId: string
  /** Admin do módulo: pode editar. Demais membros veem só leitura. */
  canEdit: boolean
  /** Bootstrap (lookups de departamentos, prioridades, categorias...). */
  config: SdConfigBootstrapDTO | undefined
}

const SdSettingsContext = createContext<SdSettingsContextValue | null>(null)

export function SdSettingsProvider({
  value,
  children,
}: {
  value: SdSettingsContextValue
  children: ReactNode
}) {
  return (
    <SdSettingsContext.Provider value={value}>
      {children}
    </SdSettingsContext.Provider>
  )
}

export function useSdSettingsContext(): SdSettingsContextValue {
  const ctx = useContext(SdSettingsContext)
  if (!ctx) throw new Error('useSdSettingsContext fora do SdSettingsProvider')
  return ctx
}

// ── Rótulos ────────────────────────────────────────────────────────────────

export const SD_TICKET_TYPE_OPTIONS: {
  value: SdTicketTypeDTO
  label: string
  short: string
}[] = [
  { value: 'INCIDENT', label: 'Incidente', short: 'INC' },
  { value: 'SERVICE_REQUEST', label: 'Requisição', short: 'REQ' },
  { value: 'CHANGE', label: 'Mudança', short: 'CHG' },
  { value: 'PROBLEM', label: 'Problema', short: 'PRB' },
]

export const SD_TICKET_TYPE_LABEL: Record<SdTicketTypeDTO, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

export const SD_PHASE_CATEGORY_OPTIONS: {
  value: SdPhaseCategoryDTO
  label: string
  hint: string
}[] = [
  { value: 'NEW', label: 'Novo', hint: 'Entrada do fluxo' },
  {
    value: 'IN_PROGRESS',
    label: 'Em andamento',
    hint: 'Relógio de SLA correndo',
  },
  { value: 'WAITING', label: 'Aguardando', hint: 'Normalmente pausa o SLA' },
  { value: 'RESOLVED', label: 'Resolvido', hint: 'Carimba a resolução' },
  { value: 'CLOSED', label: 'Fechado', hint: 'Encerra o chamado' },
  { value: 'CANCELED', label: 'Cancelado', hint: 'Encerra sem resolver' },
]

export const SD_COLOR_SWATCHES = [
  '#64748b',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#15803d',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#ec4899',
]

// ── Blocos visuais ─────────────────────────────────────────────────────────

export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-5',
        className,
      )}
    >
      <header className='flex flex-wrap items-start justify-between gap-3'>
        <div className='flex min-w-0 flex-col gap-1'>
          <h3 className='text-sm font-semibold'>{title}</h3>
          {description ? (
            <p className='max-w-2xl text-xs text-muted-foreground'>
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className='flex shrink-0 items-center gap-2'>{actions}</div>
        ) : null}
      </header>
      {children}
    </section>
  )
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className='rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground'>
      {children}
    </div>
  )
}

export function ReadOnlyNotice() {
  return (
    <div className='flex items-start gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-muted-foreground text-sm'>
      <SteelIcon
        icon={InformationCircleIcon}
        strokeWidth={2}
        className='mt-0.5 shrink-0'
      />
      <p>
        Você está vendo a configuração em modo leitura. Só administradores do
        ServiceDesk (OWNER/ADMIN ou perfil com permissão de configurações) podem
        alterá-la.
      </p>
    </div>
  )
}

export function ColorDot({
  color,
  className,
}: {
  color: string | null | undefined
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2.5 shrink-0 rounded-full ring-1 ring-border',
        className,
      )}
      style={{ backgroundColor: color ?? 'var(--muted-foreground)' }}
    />
  )
}

export function ColorInput({
  value,
  onChange,
  disabled,
}: {
  value: string | null | undefined
  onChange: (color: string) => void
  disabled?: boolean
}) {
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {SD_COLOR_SWATCHES.map((swatch) => (
        <button
          key={swatch}
          type='button'
          disabled={disabled}
          aria-label={`Cor ${swatch}`}
          aria-pressed={value === swatch}
          onClick={() => onChange(swatch)}
          className={cn(
            'size-5 rounded-full ring-offset-2 ring-offset-background transition disabled:cursor-not-allowed disabled:opacity-50',
            value === swatch ? 'ring-2 ring-foreground' : 'hover:scale-110',
          )}
          style={{ backgroundColor: swatch }}
        />
      ))}
      <label className='relative ml-1 flex size-5 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-border text-[10px] text-muted-foreground'>
        +
        <input
          type='color'
          disabled={disabled}
          value={value ?? '#64748b'}
          onChange={(e) => onChange(e.target.value)}
          className='absolute inset-0 cursor-pointer opacity-0'
          aria-label='Cor personalizada'
        />
      </label>
    </div>
  )
}

/** Chips de tipo de chamado (vazio = todos). */
export function TicketTypeToggles({
  value,
  onChange,
  disabled,
  emptyLabel = 'Todos os tipos',
}: {
  value: SdTicketTypeDTO[]
  onChange: (types: SdTicketTypeDTO[]) => void
  disabled?: boolean
  emptyLabel?: string
}) {
  return (
    <div className='flex flex-wrap items-center gap-1.5'>
      {SD_TICKET_TYPE_OPTIONS.map((option) => {
        const active = value.includes(option.value)
        return (
          <button
            key={option.value}
            type='button'
            disabled={disabled}
            aria-pressed={active}
            onClick={() =>
              onChange(
                active
                  ? value.filter((t) => t !== option.value)
                  : [...value, option.value],
              )
            }
            className={cn(
              'rounded-full border px-2.5 py-0.5 text-xs transition disabled:cursor-not-allowed disabled:opacity-60',
              active
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {option.label}
          </button>
        )
      })}
      {value.length === 0 ? (
        <span className='text-xs text-muted-foreground'>({emptyLabel})</span>
      ) : null}
    </div>
  )
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <div className='flex items-start justify-between gap-4 rounded-lg px-1 py-2'>
      <span className='flex flex-col gap-0.5'>
        <span className='text-sm'>{label}</span>
        {description ? (
          <span className='text-xs text-muted-foreground'>{description}</span>
        ) : null}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value)}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  )
}

export function FieldBlock({
  label,
  hint,
  children,
  className,
}: {
  label: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label className='text-xs font-medium text-muted-foreground'>
        {label}
      </Label>
      {children}
      {hint ? (
        <span className='text-[11px] text-muted-foreground'>{hint}</span>
      ) : null}
    </div>
  )
}

/** Select simples com rótulos (valor `''` = nenhum quando `allowEmpty`). */
export function SimpleSelect<T extends string>({
  value,
  onChange,
  options,
  placeholder = 'Selecione',
  allowEmpty,
  emptyLabel = 'Nenhum',
  disabled,
  className,
}: {
  value: T | null | undefined
  onChange: (value: T | null) => void
  options: { value: T; label: string }[]
  placeholder?: string
  allowEmpty?: boolean
  emptyLabel?: string
  disabled?: boolean
  className?: string
}) {
  const items = [
    ...(allowEmpty ? [{ value: '__none__', label: emptyLabel }] : []),
    ...options,
  ]
  return (
    <Select
      items={items}
      value={value ?? (allowEmpty ? '__none__' : null)}
      onValueChange={(next) =>
        onChange(next === '__none__' || next == null ? null : (next as T))
      }
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-full min-w-40', className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {items.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

/** Campo numérico que só confirma no blur/Enter. */
export function NumberInput({
  value,
  onCommit,
  min,
  max,
  disabled,
  className,
  suffix,
}: {
  value: number | null | undefined
  onCommit: (value: number | null) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  suffix?: string
}) {
  const [draft, setDraft] = useState(value == null ? '' : String(value))
  useEffect(() => setDraft(value == null ? '' : String(value)), [value])

  function commit() {
    if (draft.trim() === '') return onCommit(null)
    let n = Math.round(Number(draft))
    if (!Number.isFinite(n)) return setDraft(value == null ? '' : String(value))
    if (min !== undefined) n = Math.max(min, n)
    if (max !== undefined) n = Math.min(max, n)
    setDraft(String(n))
    if (n !== value) onCommit(n)
  }

  return (
    <div className='relative flex items-center'>
      <Input
        type='number'
        inputMode='numeric'
        value={draft}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
        }}
        className={cn(suffix && 'pr-10', className)}
      />
      {suffix ? (
        <span className='pointer-events-none absolute right-3 text-xs text-muted-foreground'>
          {suffix}
        </span>
      ) : null}
    </div>
  )
}

export function ConfirmDeleteButton({
  title,
  description,
  onConfirm,
  disabled,
  pending,
  label = 'Excluir',
  iconOnly = true,
}: {
  title: string
  description: string
  onConfirm: () => void
  disabled?: boolean
  pending?: boolean
  label?: string
  iconOnly?: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger
        disabled={disabled}
        render={
          iconOnly ? (
            <Button
              type='button'
              variant='ghost'
              size='icon-xs'
              aria-label={label}
              className='text-muted-foreground hover:text-destructive'
            >
              <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          ) : (
            <Button type='button' variant='destructive' size='sm'>
              <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              {label}
            </Button>
          )
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={pending}
            onClick={onConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Lista ordenável (dnd-kit) ──────────────────────────────────────────────

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  disabled,
  renderItem,
  className,
}: {
  items: T[]
  onReorder: (orderedIds: string[]) => void
  disabled?: boolean
  renderItem: (item: T, handle: ReactNode) => ReactNode
  className?: string
}) {
  const [order, setOrder] = useState(items)
  useEffect(() => setOrder(items), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = order.findIndex((i) => i.id === active.id)
    const to = order.findIndex((i) => i.id === over.id)
    const next = arrayMove(order, from, to)
    setOrder(next)
    onReorder(next.map((i) => i.id))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={order.map((i) => i.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className={cn('flex flex-col gap-1.5', className)}>
          {order.map((item) => (
            <SortableRow key={item.id} id={item.id} disabled={disabled}>
              {(handle) => renderItem(item, handle)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

function SortableRow({
  id,
  disabled,
  children,
}: {
  id: string
  disabled?: boolean
  children: (handle: ReactNode) => ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled })

  const handle = disabled ? null : (
    <button
      type='button'
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      aria-label='Arrastar para reordenar'
      className='flex cursor-grab touch-none items-center text-muted-foreground hover:text-foreground active:cursor-grabbing'
    >
      <SteelIcon icon={DragDropVerticalIcon} strokeWidth={2} />
    </button>
  )

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'relative z-10 opacity-80 shadow-lg')}
    >
      {children(handle)}
    </li>
  )
}
