'use client'

import {
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
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
import type {
  CreateSdClassificationDTO,
  UpdateSdClassificationDTO,
} from '@/src/schemas/sd-classification.schema'
import type {
  SdClassificationDTO,
  SdClassificationKindDTO,
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
  SortableList,
  TicketTypeToggles,
  useSdSettingsContext,
} from './sd-settings-kit'

const KINDS: {
  kind: SdClassificationKindDTO
  title: string
  description: string
}[] = [
  {
    kind: 'TICKET',
    title: 'Classificação do chamado',
    description:
      'Natureza do chamado (falha, dúvida, solicitação...). Usada em filtros, relatórios e automações.',
  },
  {
    kind: 'SOLUTION',
    title: 'Classificação da solução',
    description:
      'Como o chamado foi resolvido. Pode ser exigida ao resolver (Geral > Exigências).',
  },
]

export function SdClassificationsTab() {
  const { workspaceId } = useSdSettingsContext()
  const { data, isLoading } = useSdConfigList<SdClassificationDTO>(
    workspaceId,
    'classifications',
    { includeInactive: true },
  )

  return (
    <div className='flex flex-col gap-5'>
      {KINDS.map((section) => (
        <ClassificationSection
          key={section.kind}
          kind={section.kind}
          title={section.title}
          description={section.description}
          items={(data ?? []).filter((c) => c.kind === section.kind)}
          loading={isLoading}
        />
      ))}
    </div>
  )
}

function ClassificationSection({
  kind,
  title,
  description,
  items,
  loading,
}: {
  kind: SdClassificationKindDTO
  title: string
  description: string
  items: SdClassificationDTO[]
  loading: boolean
}) {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const mutations = useSdConfigMutations<
    SdClassificationDTO,
    CreateSdClassificationDTO,
    UpdateSdClassificationDTO
  >(workspaceId, 'classifications')
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<SdClassificationDTO | null>(null)

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    try {
      await mutations.create.mutateAsync({
        kind,
        name: name.trim(),
        ticketTypes: [],
        active: true,
      })
      setName('')
    } catch (err) {
      notify.error(err)
    }
  }

  async function toggleActive(item: SdClassificationDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: item.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <SettingsSection title={title} description={description}>
      {canEdit ? (
        <form onSubmit={handleAdd} className='flex gap-2'>
          <Input
            placeholder='Nova classificação'
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
          <Button
            type='submit'
            size='sm'
            className='h-9'
            disabled={!name.trim() || mutations.create.isPending}
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Adicionar
          </Button>
        </form>
      ) : null}

      {!loading && items.length === 0 ? (
        <EmptyState>Nenhuma classificação cadastrada.</EmptyState>
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
          renderItem={(item, handle) => (
            <div
              className={cn(
                'flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2',
                !item.active && 'opacity-60',
              )}
            >
              {handle}
              <ColorDot color={item.color} />
              <div className='flex min-w-0 flex-1 flex-col'>
                <span className='truncate text-sm font-medium'>
                  {item.name}
                </span>
                {item.description ? (
                  <span className='truncate text-xs text-muted-foreground'>
                    {item.description}
                  </span>
                ) : null}
              </div>
              <div className='hidden flex-wrap gap-1 sm:flex'>
                {item.ticketTypes.map((type) => (
                  <Badge key={type} variant='outline'>
                    {SD_TICKET_TYPE_LABEL[type]}
                  </Badge>
                ))}
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
                    <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                  </Button>
                  <ConfirmDeleteButton
                    title='Excluir classificação'
                    description={`"${item.name}" deixa de existir e os chamados com ela ficam sem classificação. Para só esconder, desative.`}
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
          )}
        />
      )}

      {editing ? (
        <ClassificationDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSave={async (data) => {
            try {
              await mutations.update.mutateAsync({ id: editing.id, data })
              notify.success('Classificação salva')
              setEditing(null)
            } catch (err) {
              notify.error(err)
            }
          }}
          saving={mutations.update.isPending}
        />
      ) : null}
    </SettingsSection>
  )
}

function ClassificationDialog({
  item,
  onClose,
  onSave,
  saving,
}: {
  item: SdClassificationDTO
  onClose: () => void
  onSave: (data: UpdateSdClassificationDTO) => void
  saving: boolean
}) {
  const [name, setName] = useState(item.name)
  const [description, setDescription] = useState(item.description ?? '')
  const [color, setColor] = useState(item.color)
  const [ticketTypes, setTicketTypes] = useState<SdTicketTypeDTO[]>(
    item.ticketTypes,
  )

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>Editar classificação</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </FieldBlock>
          <FieldBlock label='Descrição'>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </FieldBlock>
          <FieldBlock label='Cor'>
            <ColorInput value={color} onChange={setColor} />
          </FieldBlock>
          <FieldBlock
            label='Tipos de chamado'
            hint='Em quais tipos a opção aparece (nenhum = todos).'
          >
            <TicketTypeToggles value={ticketTypes} onChange={setTicketTypes} />
          </FieldBlock>
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
                color,
                ticketTypes,
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
