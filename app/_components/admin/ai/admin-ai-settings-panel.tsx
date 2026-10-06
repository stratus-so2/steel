'use client'

import { type FormEvent, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import { useUpdatePlatformAiSettings } from '@/src/hooks/use-platform-ai-settings'
import { MAX_AI_COST_MARGIN, MIN_AI_COST_MARGIN } from '@/src/lib/ai/models'
import type { PlatformAiSettingsDTO } from '@/types/platform-ai-settings'
import { AdminPanel, DENSE_TABLE, formatDateTime } from '../shell/admin-ui'

const usdPrice = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 4,
})

/** "1,3" or "1.3" → 1.3; NaN when it is not a number. */
function parseMargin(value: string): number {
  return Number(value.replace(',', '.'))
}

/**
 * Global admin: platform margin over the real provider price of every AI
 * call, plus the price table it produces.
 */
export function AdminAiSettingsPanel({
  initial,
}: {
  initial: PlatformAiSettingsDTO
}) {
  const update = useUpdatePlatformAiSettings()
  const [settings, setSettings] = useState(initial)
  const [margin, setMargin] = useState(String(initial.costMargin))
  const [reason, setReason] = useState('')

  const parsed = parseMargin(margin)
  const valid =
    Number.isFinite(parsed) &&
    parsed >= MIN_AI_COST_MARGIN &&
    parsed <= MAX_AI_COST_MARGIN
  const dirty = valid && parsed !== settings.costMargin

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!valid) {
      notify.error(
        new Error(
          `Informe uma margem entre ${MIN_AI_COST_MARGIN} e ${MAX_AI_COST_MARGIN}.`,
        ),
      )
      return
    }
    update.mutate(
      { costMargin: parsed, ...(reason.trim() && { reason: reason.trim() }) },
      {
        onSuccess: (saved) => {
          setSettings(saved)
          setMargin(String(saved.costMargin))
          setReason('')
          notify.success('Margem de IA salva')
        },
        onError: (error) =>
          notify.error(error, 'Não foi possível salvar a margem'),
      },
    )
  }

  return (
    <div className='grid gap-4'>
      <AdminPanel
        title='Margem da plataforma'
        description='O custo de cada chamada de IA é o preço real do modelo (entrada e saída) multiplicado por esta margem. Vale para as próximas chamadas; o consumo já lançado não muda.'
      >
        <form
          onSubmit={handleSubmit}
          className='grid max-w-xl gap-4 sm:grid-cols-[10rem_1fr]'
        >
          <div className='grid gap-1.5'>
            <Label htmlFor='ai-cost-margin'>Margem (×)</Label>
            <Input
              id='ai-cost-margin'
              inputMode='decimal'
              value={margin}
              onChange={(event) => setMargin(event.target.value)}
              aria-invalid={!valid}
              aria-describedby='ai-cost-margin-hint'
            />
          </div>
          <div className='grid gap-1.5'>
            <Label htmlFor='ai-cost-margin-reason'>Motivo (opcional)</Label>
            <Input
              id='ai-cost-margin-reason'
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              placeholder='Fica na trilha de auditoria'
            />
          </div>
          <p
            id='ai-cost-margin-hint'
            className='text-muted-foreground text-xs sm:col-span-2'
          >
            1 = preço de custo; 1,3 = +30%. Aceita de {MIN_AI_COST_MARGIN} a{' '}
            {MAX_AI_COST_MARGIN}.{' '}
            {settings.updatedAt
              ? `Última alteração: ${formatDateTime(settings.updatedAt)}.`
              : 'Usando o padrão da plataforma.'}
          </p>
          <div className='sm:col-span-2'>
            <Button type='submit' disabled={!dirty || update.isPending}>
              {update.isPending ? 'Salvando...' : 'Salvar margem'}
            </Button>
          </div>
        </form>
      </AdminPanel>

      <AdminPanel
        flush
        title='Preço por modelo'
        description='US$ por 1 milhão de tokens. "Cobrado" já inclui a margem salva.'
      >
        <div className='overflow-x-auto'>
          <Table className={DENSE_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead className='text-right'>Entrada</TableHead>
                <TableHead className='text-right'>Entrada em cache</TableHead>
                <TableHead className='text-right'>Saída</TableHead>
                <TableHead className='text-right'>Entrada cobrada</TableHead>
                <TableHead className='text-right'>Saída cobrada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settings.models.map((model) => (
                <TableRow key={model.key}>
                  <TableCell className='font-medium'>{model.label}</TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {usdPrice.format(model.inputUsdPer1M)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {model.cachedInputUsdPer1M === null
                      ? '—'
                      : usdPrice.format(model.cachedInputUsdPer1M)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {usdPrice.format(model.outputUsdPer1M)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {usdPrice.format(model.chargedInputUsdPer1M)}
                  </TableCell>
                  <TableCell className='text-right tabular-nums'>
                    {usdPrice.format(model.chargedOutputUsdPer1M)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </AdminPanel>
    </div>
  )
}
