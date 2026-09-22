'use client'

import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  Calendar01Icon,
  Cancel01Icon,
  CheckmarkSquare02Icon,
  Clock01Icon,
  GridViewIcon,
  Link01Icon,
  ListViewIcon,
  Mail01Icon,
  Money01Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  SmartPhone01Icon,
  TextAlignLeftIcon,
  TextIcon,
  UserIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useSdConfigList,
  useSdConfigMutations,
} from '@/src/hooks/use-sd-config'
import {
  isSdCustomFieldEmpty,
  validateSdCustomFieldValue,
} from '@/src/lib/servicedesk/custom-fields'
import type {
  CreateSdCustomFieldDTO,
  UpdateSdCustomFieldDTO,
} from '@/src/schemas/sd-custom-field.schema'
import type {
  SdCategoryTreeDTO,
  SdCustomFieldDefinitionDTO,
  SdCustomFieldEntityDTO,
  SdCustomFieldOptionDTO,
  SdCustomFieldTypeDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'
import {
  ColorDot,
  ColorInput,
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SD_TICKET_TYPE_LABEL,
  SettingsSection,
  SimpleSelect,
  SortableList,
  TicketTypeToggles,
  ToggleRow,
  useSdSettingsContext,
} from './sd-settings-kit'

const ENTITIES: { value: SdCustomFieldEntityDTO; label: string }[] = [
  { value: 'TICKET', label: 'Chamado' },
  { value: 'CUSTOMER', label: 'Cliente' },
  { value: 'CONTACT', label: 'Contato' },
  { value: 'CONFIG_ITEM', label: 'Item de configuração' },
]

export const SD_CUSTOM_FIELD_TYPE_META: Record<
  SdCustomFieldTypeDTO,
  { label: string; icon: typeof TextIcon }
> = {
  TEXT: { label: 'Texto curto', icon: TextIcon },
  TEXTAREA: { label: 'Texto longo', icon: TextAlignLeftIcon },
  NUMBER: { label: 'Número', icon: GridViewIcon },
  CURRENCY: { label: 'Moeda (R$)', icon: Money01Icon },
  DATE: { label: 'Data', icon: Calendar01Icon },
  DATETIME: { label: 'Data e hora', icon: Clock01Icon },
  CHECKBOX: { label: 'Caixa de seleção', icon: CheckmarkSquare02Icon },
  SELECT: { label: 'Lista (uma opção)', icon: ListViewIcon },
  MULTI_SELECT: { label: 'Lista (várias opções)', icon: ListViewIcon },
  USER: { label: 'Usuário', icon: UserIcon },
  EMAIL: { label: 'E-mail', icon: Mail01Icon },
  URL: { label: 'Link (URL)', icon: Link01Icon },
  PHONE: { label: 'Telefone', icon: SmartPhone01Icon },
}

const TYPE_OPTIONS = (
  Object.keys(SD_CUSTOM_FIELD_TYPE_META) as SdCustomFieldTypeDTO[]
).map((value) => ({ value, label: SD_CUSTOM_FIELD_TYPE_META[value].label }))

const hasOptions = (type: SdCustomFieldTypeDTO) =>
  type === 'SELECT' || type === 'MULTI_SELECT'

/** "Número do patrimônio" → "numeroDoPatrimonio". */
export function slugifySdKey(label: string): string {
  const words = label
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const camel = words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('')
  const key = camel.replace(/^[^a-zA-Z]+/, '')
  return key.slice(0, 64)
}

/** Categorias da árvore em lista plana, com indentação por nível. */
export function flattenSdCategories(
  nodes: SdCategoryTreeDTO[] | undefined,
  depth = 0,
): { id: string; name: string; depth: number; level: string }[] {
  return (nodes ?? []).flatMap((node) => [
    { id: node.id, name: node.name, depth, level: node.level },
    ...flattenSdCategories(node.children, depth + 1),
  ])
}

// ── Entrada do campo (preview e valores padrão) ────────────────────────────

/**
 * Renderiza o campo como o usuário final o vê. Valores: texto → string,
 * número/moeda → string digitada, caixa → boolean, múltipla → string[].
 */
export function SdCustomFieldInput({
  type,
  options,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  type: SdCustomFieldTypeDTO
  options: SdCustomFieldOptionDTO[]
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  placeholder?: string
}) {
  const text =
    typeof value === 'string' || typeof value === 'number' ? String(value) : ''

  switch (type) {
    case 'TEXTAREA':
      return (
        <Textarea
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      )
    case 'CHECKBOX':
      return (
        <Label className='flex items-center gap-2 text-sm font-normal'>
          <Checkbox
            checked={value === true}
            disabled={disabled}
            onCheckedChange={(checked) => onChange(checked === true)}
          />
          <span>{placeholder ?? 'Sim'}</span>
        </Label>
      )
    case 'SELECT':
      return (
        <SimpleSelect
          value={typeof value === 'string' && value ? value : null}
          onChange={(next) => onChange(next ?? '')}
          options={options.map((o) => ({ value: o.value, label: o.label }))}
          allowEmpty
          emptyLabel='—'
          disabled={disabled}
        />
      )
    case 'MULTI_SELECT': {
      const selected = Array.isArray(value) ? (value as string[]) : []
      return (
        <div className='flex flex-wrap gap-1.5'>
          {options.length === 0 ? (
            <span className='text-xs text-muted-foreground'>
              Adicione opções para visualizar.
            </span>
          ) : null}
          {options.map((option) => {
            const active = selected.includes(option.value)
            return (
              <button
                key={option.value}
                type='button'
                disabled={disabled}
                aria-pressed={active}
                onClick={() =>
                  onChange(
                    active
                      ? selected.filter((v) => v !== option.value)
                      : [...selected, option.value],
                  )
                }
                className={cn(
                  'flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition disabled:opacity-60',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                {option.color ? <ColorDot color={option.color} /> : null}
                {option.label}
              </button>
            )
          })}
        </div>
      )
    }
    case 'CURRENCY':
      return (
        <div className='relative flex items-center'>
          <span className='pointer-events-none absolute left-3 text-xs text-muted-foreground'>
            R$
          </span>
          <Input
            inputMode='decimal'
            value={text}
            disabled={disabled}
            placeholder='0,00'
            onChange={(e) => onChange(e.target.value)}
            className='pl-9'
          />
        </div>
      )
    case 'USER':
      return (
        <Input
          value={text}
          disabled={disabled}
          placeholder={placeholder ?? 'Selecionar usuário do workspace'}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    default: {
      const inputType: Record<string, string> = {
        NUMBER: 'number',
        DATE: 'date',
        DATETIME: 'datetime-local',
        EMAIL: 'email',
        URL: 'url',
        PHONE: 'tel',
      }
      return (
        <Input
          type={inputType[type] ?? 'text'}
          value={text}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    }
  }
}

/** Valor salvo → valor editável na entrada (ISO → datetime-local). */
function toInputValue(type: SdCustomFieldTypeDTO, value: unknown): unknown {
  if (value == null)
    return type === 'MULTI_SELECT' ? [] : type === 'CHECKBOX' ? false : ''
  if (type === 'DATETIME' && typeof value === 'string') {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return value
}

// ── Aba ────────────────────────────────────────────────────────────────────

export function SdCustomFieldsTab() {
  const { workspaceId, canEdit, config } = useSdSettingsContext()
  const [entity, setEntity] = useState<SdCustomFieldEntityDTO>('TICKET')
  const [editing, setEditing] = useState<
    SdCustomFieldDefinitionDTO | 'new' | null
  >(null)
  const { data, isLoading } = useSdConfigList<SdCustomFieldDefinitionDTO>(
    workspaceId,
    'custom-fields',
    { entity, includeInactive: true },
  )
  const mutations = useSdConfigMutations<
    SdCustomFieldDefinitionDTO,
    CreateSdCustomFieldDTO,
    UpdateSdCustomFieldDTO
  >(workspaceId, 'custom-fields')
  const categories = useMemo(
    () => flattenSdCategories(config?.categories),
    [config?.categories],
  )
  const categoryName = (id: string) =>
    categories.find((c) => c.id === id)?.name ?? 'Categoria removida'
  const items = data ?? []

  async function toggleActive(
    item: SdCustomFieldDefinitionDTO,
    active: boolean,
  ) {
    try {
      await mutations.update.mutateAsync({ id: item.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-5'>
      <div className='flex flex-wrap items-center gap-1 rounded-lg bg-muted p-1 w-fit'>
        {ENTITIES.map((option) => (
          <button
            key={option.value}
            type='button'
            aria-pressed={entity === option.value}
            onClick={() => setEntity(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition',
              entity === option.value
                ? 'bg-background font-medium shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <SettingsSection
        title={`Campos de ${ENTITIES.find((e) => e.value === entity)?.label.toLowerCase()}`}
        description='Os valores ficam no próprio registro, na chave do campo. Arraste para definir a ordem de exibição.'
        actions={
          canEdit ? (
            <Button size='sm' onClick={() => setEditing('new')}>
              <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
              Novo campo
            </Button>
          ) : null
        }
      >
        {!isLoading && items.length === 0 ? (
          <EmptyState>Nenhum campo customizado para esta entidade.</EmptyState>
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
              const meta = SD_CUSTOM_FIELD_TYPE_META[item.type]
              return (
                <div
                  className={cn(
                    'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2',
                    !item.active && 'opacity-60',
                  )}
                >
                  {handle}
                  <span
                    className='flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground'
                    title={meta.label}
                  >
                    <SteelIcon icon={meta.icon} strokeWidth={2} />
                  </span>
                  <div className='flex min-w-0 flex-1 flex-col'>
                    <span className='truncate text-sm font-medium'>
                      {item.label}
                      {item.required ? (
                        <span className='ml-0.5 text-destructive'>*</span>
                      ) : null}
                    </span>
                    <span className='truncate font-mono text-[11px] text-muted-foreground'>
                      {item.key} · {meta.label}
                    </span>
                  </div>
                  <div className='hidden max-w-[45%] flex-wrap justify-end gap-1 md:flex'>
                    {item.required ? (
                      <Badge variant='secondary'>Obrigatório</Badge>
                    ) : null}
                    {item.visibleInPortal ? (
                      <Badge variant='outline'>Portal</Badge>
                    ) : null}
                    {item.ticketTypes.map((type) => (
                      <Badge key={type} variant='outline'>
                        {SD_TICKET_TYPE_LABEL[type]}
                      </Badge>
                    ))}
                    {item.categoryIds.slice(0, 2).map((id) => (
                      <Badge key={id} variant='outline'>
                        {categoryName(id)}
                      </Badge>
                    ))}
                    {item.categoryIds.length > 2 ? (
                      <Badge variant='outline'>
                        +{item.categoryIds.length - 2}
                      </Badge>
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
                        aria-label={`Editar ${item.label}`}
                        onClick={() => setEditing(item)}
                      >
                        <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                      </Button>
                      <ConfirmDeleteButton
                        title='Excluir campo customizado'
                        description={`A definição "${item.label}" será removida. Os valores já gravados continuam no registro (chave "${item.key}"), mas deixam de ser exibidos. Para só esconder, desative.`}
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

      {editing ? (
        <CustomFieldDialog
          entity={entity}
          item={editing === 'new' ? null : editing}
          categories={categories}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setEditing(null)}
          onCreate={async (data) => {
            try {
              await mutations.create.mutateAsync(data)
              notify.success('Campo criado')
              setEditing(null)
            } catch (err) {
              notify.error(err)
            }
          }}
          onUpdate={async (id, data) => {
            try {
              await mutations.update.mutateAsync({ id, data })
              notify.success('Campo salvo')
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

// ── Construtor ─────────────────────────────────────────────────────────────

function CustomFieldDialog({
  entity,
  item,
  categories,
  saving,
  onClose,
  onCreate,
  onUpdate,
}: {
  entity: SdCustomFieldEntityDTO
  item: SdCustomFieldDefinitionDTO | null
  categories: { id: string; name: string; depth: number }[]
  saving: boolean
  onClose: () => void
  onCreate: (data: CreateSdCustomFieldDTO) => void
  onUpdate: (id: string, data: UpdateSdCustomFieldDTO) => void
}) {
  const isNew = !item
  const [label, setLabel] = useState(item?.label ?? '')
  const [key, setKey] = useState(item?.key ?? '')
  const [keyTouched, setKeyTouched] = useState(false)
  const [description, setDescription] = useState(item?.description ?? '')
  const [type, setType] = useState<SdCustomFieldTypeDTO>(item?.type ?? 'TEXT')
  const [options, setOptions] = useState<SdCustomFieldOptionDTO[]>(
    item?.options ?? [],
  )
  const [ticketTypes, setTicketTypes] = useState<SdTicketTypeDTO[]>(
    item?.ticketTypes ?? [],
  )
  const [categoryIds, setCategoryIds] = useState<string[]>(
    item?.categoryIds ?? [],
  )
  const [required, setRequired] = useState(item?.required ?? false)
  const [visibleInPortal, setVisibleInPortal] = useState(
    item?.visibleInPortal ?? false,
  )
  const [active, setActive] = useState(item?.active ?? true)
  const [defaultValue, setDefaultValue] = useState<unknown>(
    toInputValue(item?.type ?? 'TEXT', item?.defaultValue),
  )
  const [preview, setPreview] = useState<unknown>(toInputValue(type, null))
  const effectiveKey = isNew && !keyTouched ? slugifySdKey(label) : key
  const keyValid = /^[a-zA-Z][a-zA-Z0-9_]*$/.test(effectiveKey)
  const isTicket = entity === 'TICKET'

  const cleanOptions = options
    .map((o) => ({ ...o, label: o.label.trim(), value: o.value.trim() }))
    .filter((o) => o.label && o.value)

  const previewError = isSdCustomFieldEmpty(preview)
    ? required
      ? `${label || 'Campo'} é obrigatório`
      : null
    : (() => {
        const check = validateSdCustomFieldValue(
          { type, options: cleanOptions },
          preview,
        )
        return check.ok ? null : `${label || 'Campo'} ${check.message}`
      })()

  const defaultCheck = isSdCustomFieldEmpty(defaultValue)
    ? { ok: true as const, value: null }
    : validateSdCustomFieldValue({ type, options: cleanOptions }, defaultValue)

  function changeType(next: SdCustomFieldTypeDTO) {
    setType(next)
    setDefaultValue(toInputValue(next, null))
    setPreview(toInputValue(next, null))
  }

  function updateOption(index: number, patch: Partial<SdCustomFieldOptionDTO>) {
    setOptions((list) =>
      list.map((option, i) => {
        if (i !== index) return option
        const next = { ...option, ...patch }
        // Valor acompanha o rótulo enquanto não for editado à mão.
        if (
          patch.label !== undefined &&
          option.value === slugifySdKey(option.label)
        ) {
          next.value = slugifySdKey(patch.label) || option.value
        }
        return next
      }),
    )
  }

  function moveOption(index: number, delta: number) {
    setOptions((list) => {
      const target = index + delta
      if (target < 0 || target >= list.length) return list
      const next = [...list]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const canSave =
    !!label.trim() &&
    keyValid &&
    defaultCheck.ok &&
    (!hasOptions(type) || cleanOptions.length > 0) &&
    !saving

  function save() {
    if (!defaultCheck.ok) return
    const common = {
      label: label.trim(),
      description: description.trim() || null,
      options: hasOptions(type) ? cleanOptions : [],
      ticketTypes: isTicket ? ticketTypes : [],
      categoryIds: isTicket ? categoryIds : [],
      required,
      visibleInPortal,
      defaultValue:
        defaultCheck.value as CreateSdCustomFieldDTO['defaultValue'],
      active,
    }
    if (item) onUpdate(item.id, common)
    else onCreate({ ...common, entity, key: effectiveKey, type })
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-4xl'>
        <DialogHeader>
          <DialogTitle>
            {isNew ? 'Novo campo customizado' : `Editar "${item.label}"`}
          </DialogTitle>
        </DialogHeader>

        <div className='grid gap-6 md:grid-cols-[1fr_320px]'>
          <div className='flex flex-col gap-4'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <FieldBlock label='Rótulo'>
                <Input
                  value={label}
                  maxLength={120}
                  autoFocus
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder='Ex.: Número do patrimônio'
                />
              </FieldBlock>
              <FieldBlock
                label='Chave'
                hint={
                  isNew
                    ? 'Gerada do rótulo; não muda depois de criada.'
                    : 'Imutável.'
                }
              >
                <Input
                  value={effectiveKey}
                  disabled={!isNew}
                  maxLength={64}
                  className={cn(
                    'font-mono',
                    !keyValid && effectiveKey && 'border-destructive',
                  )}
                  onChange={(e) => {
                    setKeyTouched(true)
                    setKey(e.target.value)
                  }}
                />
              </FieldBlock>
            </div>
            <FieldBlock label='Descrição / ajuda'>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder='Texto de apoio exibido abaixo do campo'
              />
            </FieldBlock>
            <FieldBlock
              label='Tipo'
              hint={isNew ? undefined : 'O tipo não muda depois de criado.'}
            >
              <SimpleSelect
                value={type}
                onChange={(next) => next && changeType(next)}
                options={TYPE_OPTIONS}
                disabled={!isNew}
              />
            </FieldBlock>

            {hasOptions(type) ? (
              <FieldBlock label='Opções'>
                <div className='flex flex-col gap-2'>
                  {options.map((option, index) => (
                    <div key={index} className='flex items-center gap-2'>
                      <Input
                        value={option.label}
                        placeholder='Rótulo'
                        onChange={(e) =>
                          updateOption(index, { label: e.target.value })
                        }
                      />
                      <Input
                        value={option.value}
                        placeholder='valor'
                        className='w-36 font-mono text-xs'
                        onChange={(e) =>
                          updateOption(index, { value: e.target.value })
                        }
                      />
                      <div className='w-40 shrink-0'>
                        <ColorInputCompact
                          value={option.color ?? null}
                          onChange={(color) => updateOption(index, { color })}
                        />
                      </div>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label='Subir'
                        disabled={index === 0}
                        onClick={() => moveOption(index, -1)}
                      >
                        <SteelIcon icon={ArrowUp01Icon} strokeWidth={2} />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label='Descer'
                        disabled={index === options.length - 1}
                        onClick={() => moveOption(index, 1)}
                      >
                        <SteelIcon icon={ArrowDown01Icon} strokeWidth={2} />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-xs'
                        aria-label='Remover opção'
                        onClick={() =>
                          setOptions((list) =>
                            list.filter((_, i) => i !== index),
                          )
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
                    onClick={() =>
                      setOptions((list) => [
                        ...list,
                        {
                          value: `opcao${list.length + 1}`,
                          label: `Opção ${list.length + 1}`,
                          color: null,
                        },
                      ])
                    }
                  >
                    <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
                    Adicionar opção
                  </Button>
                </div>
              </FieldBlock>
            ) : null}

            {isTicket ? (
              <>
                <FieldBlock
                  label='Tipos de chamado'
                  hint='Nenhum = aparece em todos.'
                >
                  <TicketTypeToggles
                    value={ticketTypes}
                    onChange={setTicketTypes}
                  />
                </FieldBlock>
                <FieldBlock
                  label='Categorias'
                  hint='Nenhuma = aparece em todas.'
                >
                  {categories.length === 0 ? (
                    <span className='text-xs text-muted-foreground'>
                      Nenhuma categoria no catálogo.
                    </span>
                  ) : (
                    <div className='max-h-40 overflow-y-auto rounded-md border border-border p-2'>
                      {categories.map((category) => (
                        <Label
                          key={category.id}
                          className='flex items-center gap-2 py-1 text-sm font-normal'
                          style={{ paddingLeft: category.depth * 16 }}
                        >
                          <Checkbox
                            checked={categoryIds.includes(category.id)}
                            onCheckedChange={(checked) =>
                              setCategoryIds((ids) =>
                                checked
                                  ? [...ids, category.id]
                                  : ids.filter((id) => id !== category.id),
                              )
                            }
                          />
                          <span>{category.name}</span>
                        </Label>
                      ))}
                    </div>
                  )}
                </FieldBlock>
              </>
            ) : null}

            <div className='flex flex-col divide-y divide-border rounded-lg border border-border px-3'>
              <ToggleRow
                label='Obrigatório'
                checked={required}
                onCheckedChange={setRequired}
              />
              <ToggleRow
                label='Visível no portal'
                description='O solicitante vê e preenche o campo.'
                checked={visibleInPortal}
                onCheckedChange={setVisibleInPortal}
              />
              <ToggleRow
                label='Ativo'
                checked={active}
                onCheckedChange={setActive}
              />
            </div>

            <FieldBlock
              label='Valor padrão'
              hint='Aplicado quando o campo vem vazio na criação.'
            >
              <SdCustomFieldInput
                type={type}
                options={cleanOptions}
                value={defaultValue}
                onChange={setDefaultValue}
              />
              {!defaultCheck.ok ? (
                <span className='text-xs text-destructive'>
                  Valor padrão {defaultCheck.message}
                </span>
              ) : null}
            </FieldBlock>
          </div>

          <aside className='flex h-fit flex-col gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 md:sticky md:top-0'>
            <span className='text-xs font-medium uppercase tracking-wide text-muted-foreground'>
              Pré-visualização
            </span>
            <div className='flex flex-col gap-1.5 rounded-lg bg-background p-3 shadow-sm'>
              <span className='text-sm font-medium'>
                {label || 'Rótulo do campo'}
                {required ? (
                  <span className='ml-0.5 text-destructive'>*</span>
                ) : null}
              </span>
              <SdCustomFieldInput
                type={type}
                options={cleanOptions}
                value={preview}
                onChange={setPreview}
              />
              {description ? (
                <span className='text-xs text-muted-foreground'>
                  {description}
                </span>
              ) : null}
              {previewError ? (
                <span className='text-xs text-destructive'>{previewError}</span>
              ) : null}
            </div>
            <p className='text-[11px] text-muted-foreground'>
              Teste valores aqui: a validação é a mesma aplicada pelo servidor.
            </p>
          </aside>
        </div>

        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button size='sm' disabled={!canSave} onClick={save}>
            {saving ? 'Salvando...' : isNew ? 'Criar campo' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Cor da opção: bolinha que abre o seletor completo. */
function ColorInputCompact({
  value,
  onChange,
}: {
  value: string | null
  onChange: (color: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className='relative flex items-center gap-1'>
      <button
        type='button'
        aria-label='Escolher cor'
        onClick={() => setOpen((o) => !o)}
        className='flex h-9 items-center gap-1.5 rounded-md border border-border px-2 text-xs text-muted-foreground'
      >
        <ColorDot color={value} />
        {value ? 'Cor' : 'Sem cor'}
      </button>
      {value ? (
        <Button
          type='button'
          variant='ghost'
          size='icon-xs'
          aria-label='Sem cor'
          onClick={() => onChange(null)}
        >
          <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      ) : null}
      {open ? (
        <div className='absolute top-10 right-0 z-20 w-64 rounded-lg border border-border bg-popover p-2 shadow-md'>
          <ColorInput
            value={value}
            onChange={(color) => {
              onChange(color)
              setOpen(false)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
