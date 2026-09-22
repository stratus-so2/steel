'use client'

import { useEffect, useState } from 'react'
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
import type { SdTicketCostInput } from '@/src/hooks/use-sd-ticket-costs'
import type { SdCostCategoryDTO, SdTicketCostDTO } from '@/types/sd-ticket-cost'
import { FieldBlock, SimpleSelect } from '../../settings/sd-settings-kit'
import { SdAgentSelect } from '../shared/sd-tab-bits'
import {
  formatBRL,
  fromDateInput,
  parseSdDecimal,
  toDateInput,
} from '../shared/sd-tab-format'

export const SD_COST_CATEGORY_LABEL: Record<SdCostCategoryDTO, string> = {
  LABOR: 'Mão de obra',
  TRAVEL: 'Deslocamento',
  MATERIAL: 'Material',
  SERVICE: 'Serviço',
  LICENSE: 'Licença',
  OTHER: 'Outros',
}

const CATEGORY_OPTIONS = (
  Object.keys(SD_COST_CATEGORY_LABEL) as SdCostCategoryDTO[]
).map((value) => ({ value, label: SD_COST_CATEGORY_LABEL[value] }))

export function SdCostFormDialog({
  workspaceId,
  open,
  cost,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  cost: SdTicketCostDTO | null
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (
    data: SdTicketCostInput & { description: string; unitCost: string },
  ) => void
}) {
  const [category, setCategory] = useState<SdCostCategoryDTO>('OTHER')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [unitCost, setUnitCost] = useState('')
  const [billable, setBillable] = useState(false)
  const [incurredAt, setIncurredAt] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setCategory(cost?.category ?? 'OTHER')
    setDescription(cost?.description ?? '')
    setQuantity(cost ? String(Number(cost.quantity)) : '1')
    setUnitCost(cost ? cost.unitCost : '')
    setBillable(cost?.billable ?? false)
    setIncurredAt(toDateInput(cost?.incurredAt ?? new Date().toISOString()))
    setUserId(cost?.user?.id ?? null)
  }, [open, cost])

  const q = parseSdDecimal(quantity)
  const u = parseSdDecimal(unitCost)
  const valid =
    description.trim().length > 0 &&
    Number.isFinite(q) &&
    q > 0 &&
    Number.isFinite(u) &&
    u >= 0 &&
    unitCost.trim() !== ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{cost ? 'Editar custo' : 'Lançar custo'}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!valid) return
            const incurred = fromDateInput(incurredAt)
            onSubmit({
              category,
              description: description.trim(),
              quantity: q.toFixed(2),
              unitCost: u.toFixed(2),
              billable,
              ...(incurred ? { incurredAt: incurred } : {}),
              userId,
            })
          }}
        >
          <div className='grid gap-3 sm:grid-cols-2'>
            <FieldBlock label='Categoria'>
              <SimpleSelect
                value={category}
                onChange={(v) => setCategory(v ?? 'OTHER')}
                options={CATEGORY_OPTIONS}
              />
            </FieldBlock>
            <FieldBlock label='Data'>
              <Input
                type='date'
                value={incurredAt}
                onChange={(e) => setIncurredAt(e.target.value)}
                aria-label='Data do custo'
              />
            </FieldBlock>
          </div>
          <FieldBlock label='Descrição'>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='Ex.: Visita técnica'
              aria-label='Descrição do custo'
            />
          </FieldBlock>
          <div className='grid gap-3 sm:grid-cols-2'>
            <FieldBlock label='Quantidade'>
              <Input
                inputMode='decimal'
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
                placeholder='0,00'
                aria-label='Custo unitário'
              />
            </FieldBlock>
          </div>
          <FieldBlock label='Técnico'>
            <SdAgentSelect
              workspaceId={workspaceId}
              value={userId}
              onChange={setUserId}
            />
          </FieldBlock>
          <div className='flex items-center justify-between gap-3 text-sm'>
            <span>
              Faturável
              <span className='block text-muted-foreground text-xs'>
                Repassado ao cliente
              </span>
            </span>
            <Switch
              checked={billable}
              onCheckedChange={setBillable}
              aria-label='Faturável'
            />
          </div>
          <p className='text-right text-muted-foreground text-sm'>
            Total:{' '}
            <strong className='text-foreground'>
              {valid ? formatBRL(q * u) : '—'}
            </strong>
          </p>
          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={pending || !valid}>
              {cost ? 'Salvar' : 'Lançar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
