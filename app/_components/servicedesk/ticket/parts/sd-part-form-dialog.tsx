'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useSdConfigList } from '@/src/hooks/use-sd-config'
import type { SdTicketPartInput } from '@/src/hooks/use-sd-ticket-parts'
import type { SdPartDTO } from '@/types/sd-config'
import type { SdPartStatusDTO, SdTicketPartDTO } from '@/types/sd-ticket-part'
import { FieldBlock, SimpleSelect } from '../../settings/sd-settings-kit'
import { formatBRL, parseSdDecimal } from '../shared/sd-tab-format'

export const SD_PART_STATUS_LABEL: Record<SdPartStatusDTO, string> = {
  REQUESTED: 'Solicitada',
  RESERVED: 'Reservada',
  INSTALLED: 'Instalada',
  RETURNED: 'Devolvida',
  CANCELED: 'Cancelada',
}

const INITIAL_STATUSES: { value: SdPartStatusDTO; label: string }[] = [
  { value: 'REQUESTED', label: SD_PART_STATUS_LABEL.REQUESTED },
  { value: 'RESERVED', label: SD_PART_STATUS_LABEL.RESERVED },
  { value: 'INSTALLED', label: SD_PART_STATUS_LABEL.INSTALLED },
]

/**
 * Adicionar (do catálogo ou texto livre) ou editar uma peça do chamado. Na
 * edição o catálogo e o status não mudam aqui (status muda na tabela).
 */
export function SdPartFormDialog({
  workspaceId,
  open,
  part,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  part: SdTicketPartDTO | null
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SdTicketPartInput) => void
}) {
  const catalog = useSdConfigList<SdPartDTO>(
    workspaceId,
    'parts',
    {},
    { enabled: open && !part },
  )
  const [partId, setPartId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<SdPartStatusDTO>('REQUESTED')

  useEffect(() => {
    if (!open) return
    setPartId(null)
    setName(part?.name ?? '')
    setSku(part?.sku ?? '')
    setQuantity(String(part?.quantity ?? 1))
    setUnitCost(part?.unitCost ?? '')
    setSerialNumber(part?.serialNumber ?? '')
    setNotes(part?.notes ?? '')
    setStatus('REQUESTED')
  }, [open, part])

  const catalogParts = catalog.data ?? []
  const selected = useMemo(
    () => catalogParts.find((p) => p.id === partId) ?? null,
    [catalogParts, partId],
  )

  function pick(id: string | null) {
    setPartId(id)
    const found = catalogParts.find((p) => p.id === id)
    if (found) {
      setName(found.name)
      setSku(found.sku ?? '')
      setUnitCost(found.unitCost)
    }
  }

  const q = Number(quantity)
  const cost = unitCost.trim() ? parseSdDecimal(unitCost) : Number.NaN
  const costOk = unitCost.trim() === '' || (Number.isFinite(cost) && cost >= 0)
  const valid =
    Number.isInteger(q) &&
    q >= 1 &&
    costOk &&
    (Boolean(partId) || name.trim().length > 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{part ? 'Editar peça' : 'Adicionar peça'}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            const data: SdTicketPartInput = {
              quantity: q,
              serialNumber: serialNumber.trim() || null,
              notes: notes.trim() || null,
              ...(unitCost.trim() ? { unitCost: cost.toFixed(2) } : {}),
            }
            if (part) {
              onSubmit({
                ...data,
                name: name.trim() || part.name,
                sku: sku.trim() || null,
              })
            } else {
              onSubmit({
                ...data,
                ...(partId ? { partId } : {}),
                ...(name.trim() ? { name: name.trim() } : {}),
                sku: sku.trim() || null,
                status,
              })
            }
          }}
        >
          {!part ? (
            <FieldBlock
              label='Peça do catálogo'
              hint={
                selected?.stock != null
                  ? `Em estoque: ${selected.stock}`
                  : 'Deixe em "Texto livre" para uma peça fora do catálogo'
              }
            >
              <SimpleSelect
                value={partId}
                onChange={pick}
                allowEmpty
                emptyLabel='Texto livre'
                options={catalogParts.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.sku ? ` (${p.sku})` : ''} — ${formatBRL(p.unitCost)}`,
                }))}
              />
            </FieldBlock>
          ) : null}
          <div className='grid gap-3 sm:grid-cols-[1fr_8rem]'>
            <FieldBlock label='Nome'>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-label='Nome da peça'
                placeholder='Ex.: Fonte 12V'
              />
            </FieldBlock>
            <FieldBlock label='SKU'>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                aria-label='SKU'
              />
            </FieldBlock>
          </div>
          <div className='grid gap-3 sm:grid-cols-3'>
            <FieldBlock label='Quantidade'>
              <Input
                type='number'
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                aria-label='Quantidade'
              />
            </FieldBlock>
            <FieldBlock label='Custo unitário (R$)'>
              <Input
                inputMode='decimal'
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder='Do catálogo'
                aria-label='Custo unitário'
              />
            </FieldBlock>
            {!part ? (
              <FieldBlock label='Status'>
                <SimpleSelect
                  value={status}
                  onChange={(v) => setStatus(v ?? 'REQUESTED')}
                  options={INITIAL_STATUSES}
                />
              </FieldBlock>
            ) : null}
          </div>
          <FieldBlock label='Número de série'>
            <Input
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
              aria-label='Número de série'
            />
          </FieldBlock>
          <FieldBlock label='Observações'>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-label='Observações'
              rows={2}
            />
          </FieldBlock>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={pending || !valid}>
              {part ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
