'use client'

import {
  PencilEdit02Icon,
  PlusSignIcon,
  Search01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
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
  CreateSdPartDTO,
  UpdateSdPartDTO,
} from '@/src/schemas/sd-part.schema'
import type { SdPartDTO } from '@/types/sd-config'
import {
  ConfirmDeleteButton,
  EmptyState,
  FieldBlock,
  SettingsSection,
  useSdSettingsContext,
} from './sd-settings-kit'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function formatCost(value: string): string {
  const n = Number(value)
  return Number.isFinite(n) ? BRL.format(n) : value
}

type DialogState = { mode: 'create' } | { mode: 'edit'; part: SdPartDTO } | null

export function SdPartsTab() {
  const { workspaceId, canEdit } = useSdSettingsContext()
  const [q, setQ] = useState('')
  const { data, isLoading, error } = useSdConfigList<SdPartDTO>(
    workspaceId,
    'parts',
    { includeInactive: true, q: q.trim() || undefined },
  )
  const mutations = useSdConfigMutations<
    SdPartDTO,
    CreateSdPartDTO,
    UpdateSdPartDTO
  >(workspaceId, 'parts')
  const [dialog, setDialog] = useState<DialogState>(null)
  const parts = data ?? []

  async function toggleActive(part: SdPartDTO, active: boolean) {
    try {
      await mutations.update.mutateAsync({ id: part.id, data: { active } })
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <SettingsSection
      title='Catálogo de peças'
      description='Peças usadas nos atendimentos, com custo unitário e estoque opcional.'
      actions={
        canEdit ? (
          <Button size='sm' onClick={() => setDialog({ mode: 'create' })}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova peça
          </Button>
        ) : null
      }
    >
      <div className='relative'>
        <SteelIcon
          icon={Search01Icon}
          strokeWidth={2}
          className='pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground'
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder='Buscar por nome ou SKU'
          className='pl-9'
        />
      </div>

      {error ? (
        <EmptyState>{error.message}</EmptyState>
      ) : !isLoading && parts.length === 0 ? (
        <EmptyState>
          {q ? 'Nenhuma peça encontrada.' : 'Nenhuma peça cadastrada.'}
        </EmptyState>
      ) : (
        <div className='overflow-x-auto rounded-lg border border-border'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 text-left text-xs text-muted-foreground'>
              <tr>
                <th className='px-3 py-2 font-medium'>Peça</th>
                <th className='px-3 py-2 font-medium'>SKU</th>
                <th className='px-3 py-2 text-right font-medium'>
                  Custo unitário
                </th>
                <th className='px-3 py-2 text-right font-medium'>Estoque</th>
                <th className='px-3 py-2 font-medium'>Ativa</th>
                <th className='w-20 px-3 py-2' />
              </tr>
            </thead>
            <tbody>
              {parts.map((part) => (
                <tr
                  key={part.id}
                  className={cn(
                    'border-t border-border',
                    !part.active && 'opacity-60',
                  )}
                >
                  <td className='max-w-64 px-3 py-2'>
                    <div className='truncate font-medium'>{part.name}</div>
                    {part.description ? (
                      <div className='truncate text-xs text-muted-foreground'>
                        {part.description}
                      </div>
                    ) : null}
                  </td>
                  <td className='px-3 py-2 font-mono text-xs'>
                    {part.sku ?? '—'}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {formatCost(part.unitCost)}
                  </td>
                  <td className='px-3 py-2 text-right tabular-nums'>
                    {part.stock ?? '—'}
                  </td>
                  <td className='px-3 py-2'>
                    <Switch
                      checked={part.active}
                      disabled={!canEdit}
                      onCheckedChange={(value) => toggleActive(part, value)}
                      aria-label={part.active ? 'Desativar' : 'Ativar'}
                    />
                  </td>
                  <td className='px-3 py-2'>
                    {canEdit ? (
                      <div className='flex justify-end gap-1'>
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-xs'
                          aria-label={`Editar ${part.name}`}
                          onClick={() => setDialog({ mode: 'edit', part })}
                        >
                          <SteelIcon icon={PencilEdit02Icon} strokeWidth={2} />
                        </Button>
                        <ConfirmDeleteButton
                          title='Excluir peça'
                          description={`"${part.name}" sai do catálogo. Peças já lançadas em chamados continuam lá. Para só esconder, desative.`}
                          pending={mutations.remove.isPending}
                          onConfirm={() =>
                            mutations.remove.mutate(part.id, {
                              onError: (err) => notify.error(err),
                            })
                          }
                        />
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog ? (
        <PartDialog
          part={dialog.mode === 'edit' ? dialog.part : null}
          saving={mutations.create.isPending || mutations.update.isPending}
          onClose={() => setDialog(null)}
          onSave={async (values) => {
            try {
              if (dialog.mode === 'edit') {
                await mutations.update.mutateAsync({
                  id: dialog.part.id,
                  data: values,
                })
                notify.success('Peça salva')
              } else {
                await mutations.create.mutateAsync({ ...values, active: true })
                notify.success('Peça criada')
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

interface PartValues {
  name: string
  sku: string | null
  description: string | null
  unitCost: string
  stock: number | null
}

function PartDialog({
  part,
  saving,
  onClose,
  onSave,
}: {
  part: SdPartDTO | null
  saving: boolean
  onClose: () => void
  onSave: (values: PartValues) => void
}) {
  const [name, setName] = useState(part?.name ?? '')
  const [sku, setSku] = useState(part?.sku ?? '')
  const [description, setDescription] = useState(part?.description ?? '')
  const [unitCost, setUnitCost] = useState(
    part ? part.unitCost.replace('.', ',') : '0,00',
  )
  const [stock, setStock] = useState(
    part?.stock == null ? '' : String(part.stock),
  )

  const costNumber = Number(unitCost.replace(/\./g, '').replace(',', '.'))
  const costValid = Number.isFinite(costNumber) && costNumber >= 0
  const stockNumber = stock.trim() === '' ? null : Number(stock)
  const stockValid =
    stockNumber === null || (Number.isInteger(stockNumber) && stockNumber >= 0)

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{part ? 'Editar peça' : 'Nova peça'}</DialogTitle>
        </DialogHeader>
        <div className='flex flex-col gap-4'>
          <FieldBlock label='Nome'>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
            />
          </FieldBlock>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
            <FieldBlock label='SKU'>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                maxLength={64}
              />
            </FieldBlock>
            <FieldBlock label='Custo unitário (R$)'>
              <Input
                value={unitCost}
                inputMode='decimal'
                onChange={(e) => setUnitCost(e.target.value)}
                aria-invalid={!costValid}
              />
            </FieldBlock>
            <FieldBlock label='Estoque' hint='Vazio = não controlado.'>
              <Input
                value={stock}
                inputMode='numeric'
                onChange={(e) => setStock(e.target.value)}
                aria-invalid={!stockValid}
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
        </div>
        <DialogFooter>
          <Button variant='outline' size='sm' onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!name.trim() || !costValid || !stockValid || saving}
            onClick={() =>
              onSave({
                name: name.trim(),
                sku: sku.trim() || null,
                description: description.trim() || null,
                unitCost: costNumber.toFixed(2),
                stock: stockNumber,
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
