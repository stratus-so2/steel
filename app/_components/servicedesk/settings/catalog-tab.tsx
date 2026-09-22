'use client'

import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Layers01Icon,
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
import { toSdCategoryTree } from '@/src/mappers/sd-category.mapper'
import type {
  CreateSdCategoryDTO,
  UpdateSdCategoryDTO,
} from '@/src/schemas/sd-category.schema'
import type {
  SdCategoryDTO,
  SdCategoryLevelDTO,
  SdCategoryTreeDTO,
  SdSlaPolicyDTO,
  SdTicketTypeDTO,
} from '@/types/sd-config'
import {
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

const LEVEL_LABEL: Record<SdCategoryLevelDTO, string> = {
  CATEGORY: 'Categoria',
  SUBCATEGORY: 'Subcategoria',
  SERVICE: 'Serviço',
}

const CHILD_LEVEL: Record<SdCategoryLevelDTO, SdCategoryLevelDTO | null> = {
  CATEGORY: 'SUBCATEGORY',
  SUBCATEGORY: 'SERVICE',
  SERVICE: null,
}

function countDescendants(node: SdCategoryTreeDTO): number {
  return node.children.reduce((n, c) => n + 1 + countDescendants(c), 0)
}

type DialogState =
  | { mode: 'create'; parentId: string | null; level: SdCategoryLevelDTO }
  | { mode: 'edit'; node: SdCategoryDTO }
  | null

export function SdCatalogTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const { data, isLoading } = useSdConfigList<SdCategoryDTO>(
    workspaceId,
    'categories',
    { includeInactive: true },
  )
  const mutations = useSdConfigMutations<
    SdCategoryDTO,
    CreateSdCategoryDTO,
    UpdateSdCategoryDTO
  >(workspaceId, 'categories')
  const tree = useMemo(() => toSdCategoryTree(data ?? []), [data])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>(null)

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function reorder(orderedIds: string[]) {
    mutations.reorder.mutate(
      { orderedIds },
      { onError: (err) => notify.error(err) },
    )
  }

  async function toggleActive(node: SdCategoryDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: node.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  function renderLevel(nodes: SdCategoryTreeDTO[], depth: number) {
    return (
      <SortableList
        items={nodes}
        disabled={!canEdit}
        onReorder={reorder}
        renderItem={(node, handle) => {
          const childLevel = CHILD_LEVEL[node.level]
          const isOpen = !collapsed.has(node.id)
          const total = countDescendants(node)
          return (
            <div className='flex flex-col gap-1.5'>
              <div
                className={cn(
                  'flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2',
                  !node.active && 'opacity-60',
                )}
                style={{ marginLeft: depth * 24 }}
              >
                {handle}
                {node.children.length > 0 ? (
                  <button
                    type='button'
                    onClick={() => toggle(node.id)}
                    aria-label={isOpen ? 'Recolher' : 'Expandir'}
                    className='text-muted-foreground hover:text-foreground'
                  >
                    <SteelIcon
                      icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                      strokeWidth={2}
                    />
                  </button>
                ) : (
                  <span className='w-4' />
                )}
                <div className='flex min-w-0 flex-1 flex-col'>
                  <span className='flex items-center gap-2 truncate text-sm font-medium'>
                    {node.icon ? <span>{node.icon}</span> : null}
                    <span className='truncate'>{node.name}</span>
                    <Badge variant='outline'>{LEVEL_LABEL[node.level]}</Badge>
                    {total > 0 ? (
                      <span className='text-xs font-normal text-muted-foreground'>
                        {total} {total === 1 ? 'item' : 'itens'}
                      </span>
                    ) : null}
                  </span>
                  <span className='truncate text-xs text-muted-foreground'>
                    {node.ticketTypes.length > 0
                      ? node.ticketTypes
                          .map((t) => SD_TICKET_TYPE_LABEL[t])
                          .join(', ')
                      : 'Todos os tipos'}
                    {node.portalVisible ? '' : ' · oculto no portal'}
                  </span>
                </div>
                {canEdit && childLevel ? (
                  <Button
                    type='button'
                    variant='ghost'
                    size='xs'
                    onClick={() =>
                      setDialog({
                        mode: 'create',
                        parentId: node.id,
                        level: childLevel,
                      })
                    }
                  >
                    <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
                    {LEVEL_LABEL[childLevel]}
                  </Button>
                ) : null}
                <Switch
                  checked={node.active}
                  disabled={!canEdit}
                  onCheckedChange={(value) => toggleActive(node, value)}
                  aria-label={node.active ? 'Desativar' : 'Ativar'}
                />
                {canEdit ? (
                  <>
                    <Button
                      type='button'
                      variant='ghost'
                      size='icon-xs'
                      aria-label={`Editar ${node.name}`}
                      onClick={() => setDialog({ mode: 'edit', node })}
                    >
                      <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                    </Button>
                    <ConfirmDeleteButton
                      title={`Excluir ${LEVEL_LABEL[node.level].toLowerCase()}`}
                      description={
                        total > 0
                          ? `"${node.name}" e os ${total} itens abaixo dele serão removidos. Chamados ficam sem essa categoria. Para só esconder, desative.`
                          : `"${node.name}" será removido. Chamados ficam sem essa categoria. Para só esconder, desative.`
                      }
                      pending={mutations.remove.isPending}
                      onConfirm={() =>
                        mutations.remove.mutate(node.id, {
                          onError: (err) => notify.error(err),
                        })
                      }
                    />
                  </>
                ) : null}
              </div>
              {isOpen && node.children.length > 0
                ? renderLevel(node.children, depth + 1)
                : null}
            </div>
          )
        }}
      />
    )
  }

  return (
    <SettingsSection
      title='Catálogo de serviços'
      description='Categoria > subcategoria > serviço. O time e o SLA padrão do nó mais específico são usados no roteamento do chamado.'
      actions={
        canEdit ? (
          <Button
            size='sm'
            onClick={() =>
              setDialog({ mode: 'create', parentId: null, level: 'CATEGORY' })
            }
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova categoria
          </Button>
        ) : null
      }
    >
      {!isLoading && tree.length === 0 ? (
        <EmptyState>Nenhuma categoria cadastrada.</EmptyState>
      ) : (
        renderLevel(tree, 0)
      )}

      {dialog ? (
        <CategoryDialog
          state={dialog}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            try {
              if (dialog.mode === 'create') {
                await mutations.create.mutateAsync({
                  ...values,
                  parentId: dialog.parentId,
                  level: dialog.level,
                })
                if (dialog.parentId) {
                  const parentId = dialog.parentId
                  setCollapsed((prev) => {
                    const next = new Set(prev)
                    next.delete(parentId)
                    return next
                  })
                }
                notify.success(`${LEVEL_LABEL[dialog.level]} criada`)
              } else {
                await mutations.update.mutateAsync({
                  id: dialog.node.id,
                  data: values,
                })
                notify.success('Item salvo')
              }
              setDialog(null)
            } catch (err) {
              notify.error(err)
            }
          }}
        />
      ) : null}
    </SettingsSection>
  )
}

interface CategoryValues {
  name: string
  description: string | null
  icon: string | null
  ticketTypes: SdTicketTypeDTO[]
  departmentId: string | null
  slaPolicyId: string | null
  portalVisible: boolean
  active: boolean
}

function CategoryDialog({
  state,
  saving,
  onClose,
  onSave,
}: {
  state: NonNullable<DialogState>
  saving: boolean
  onClose: () => void
  onSave: (values: CategoryValues) => void
}) {
  const { workspaceId, config } = useSdSettingsContext()
  const policies = useSdConfigList<SdSlaPolicyDTO>(workspaceId, 'sla-policies')
  const node = state.mode === 'edit' ? state.node : null
  const level =
    node?.level ?? (state.mode === 'create' ? state.level : 'CATEGORY')
  const [name, setName] = useState(node?.name ?? '')
  const [description, setDescription] = useState(node?.description ?? '')
  const [icon, setIcon] = useState(node?.icon ?? '')
  const [ticketTypes, setTicketTypes] = useState<SdTicketTypeDTO[]>(
    node?.ticketTypes ?? [],
  )
  const [departmentId, setDepartmentId] = useState<string | null>(
    node?.departmentId ?? null,
  )
  const [slaPolicyId, setSlaPolicyId] = useState<string | null>(
    node?.slaPolicyId ?? null,
  )
  const [portalVisible, setPortalVisible] = useState(
    node?.portalVisible ?? true,
  )
  const [active, setActive] = useState(node?.active ?? true)

  const departmentOptions = (config?.departments ?? []).flatMap((root) => [
    { value: root.id, label: root.name },
    ...root.children.map((child) => ({
      value: child.id,
      label: `${root.name} › ${child.name}`,
    })),
  ])

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2'>
            <SteelIcon icon={Layers01Icon} strokeWidth={2} />
            {state.mode === 'edit'
              ? `Editar ${LEVEL_LABEL[level].toLowerCase()}`
              : `Nova ${LEVEL_LABEL[level].toLowerCase()}`}
          </DialogTitle>
        </DialogHeader>
        <div className='flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1'>
          <div className='grid grid-cols-[1fr_6rem] gap-3'>
            <FieldBlock label='Nome'>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                autoFocus
              />
            </FieldBlock>
            <FieldBlock label='Ícone'>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                maxLength={64}
                placeholder='🌐'
              />
            </FieldBlock>
          </div>
          <FieldBlock label='Descrição'>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </FieldBlock>
          <FieldBlock
            label='Tipos de chamado'
            hint='Em quais tipos o item aparece (nenhum = todos).'
          >
            <TicketTypeToggles value={ticketTypes} onChange={setTicketTypes} />
          </FieldBlock>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Departamento padrão'>
              <SimpleSelect
                value={departmentId}
                onChange={setDepartmentId}
                options={departmentOptions}
                allowEmpty
                emptyLabel='Herdar / padrão'
              />
            </FieldBlock>
            <FieldBlock label='Política de SLA padrão'>
              <SimpleSelect
                value={slaPolicyId}
                onChange={setSlaPolicyId}
                options={(policies.data ?? []).map((p) => ({
                  value: p.id,
                  label: p.name,
                }))}
                allowEmpty
                emptyLabel='Herdar / padrão'
              />
            </FieldBlock>
          </div>
          <div className='flex flex-col'>
            <ToggleRow
              label='Visível no portal'
              description='O solicitante pode escolher este item ao abrir chamados.'
              checked={portalVisible}
              onCheckedChange={setPortalVisible}
            />
            <ToggleRow
              label='Ativo'
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!name.trim() || saving}
            onClick={() =>
              onSave({
                name: name.trim(),
                description: description.trim() || null,
                icon: icon.trim() || null,
                ticketTypes,
                departmentId,
                slaPolicyId,
                portalVisible,
                active,
              })
            }
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
