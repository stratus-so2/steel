'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { SdTimeEntryDTO } from '@/types/sd-time-entry'
import { FieldBlock, ToggleRow } from '../../settings/sd-settings-kit'
import { SdAgentSelect } from '../shared/sd-tab-bits'

/**
 * Lançamento manual de horas: início e fim em horário local, faturável e a
 * descrição. Os minutos cobrados e o valor são calculados no servidor pelas
 * regras do contrato — por isso não há campo de duração.
 */

/** ISO → valor de `<input type="datetime-local">` no fuso do navegador. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function defaultStart(): string {
  const now = new Date()
  now.setMinutes(now.getMinutes() - 30)
  return toLocalInput(now.toISOString())
}

export interface SdTimeEntryFormValues {
  startedAt: string
  endedAt: string
  billable: boolean
  description: string | null
  userId: string | null
}

export function SdTimeEntryFormDialog({
  workspaceId,
  open,
  entry,
  /** Admin do módulo pode apontar por outro agente. */
  canPickAgent,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  entry: SdTimeEntryDTO | null
  canPickAgent: boolean
  pending: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (values: SdTimeEntryFormValues) => void
}) {
  const [startedAt, setStartedAt] = useState(
    entry ? toLocalInput(entry.startedAt) : defaultStart(),
  )
  const [endedAt, setEndedAt] = useState(
    entry
      ? toLocalInput(entry.endedAt)
      : toLocalInput(new Date().toISOString()),
  )
  const [billable, setBillable] = useState(entry?.billable ?? true)
  const [description, setDescription] = useState(entry?.description ?? '')
  const [userId, setUserId] = useState<string | null>(null)

  const startIso = fromLocalInput(startedAt)
  const endIso = fromLocalInput(endedAt)
  const valid = Boolean(startIso && endIso && endIso > startIso)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            {entry ? 'Editar apontamento' : 'Lançar horas'}
          </DialogTitle>
          <DialogDescription>
            O arredondamento, o mínimo por chamado e o valor saem das regras do
            contrato do cliente.
          </DialogDescription>
        </DialogHeader>

        <div className='flex flex-col gap-4'>
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
            <FieldBlock label='Início'>
              <Input
                type='datetime-local'
                value={startedAt}
                onChange={(event) => setStartedAt(event.target.value)}
              />
            </FieldBlock>
            <FieldBlock label='Fim'>
              <Input
                type='datetime-local'
                value={endedAt}
                onChange={(event) => setEndedAt(event.target.value)}
                aria-invalid={!valid}
              />
            </FieldBlock>
          </div>

          {canPickAgent && !entry ? (
            <FieldBlock
              label='Agente'
              hint='Vazio = você. Apontar por outro agente é restrito a admins.'
            >
              <SdAgentSelect
                workspaceId={workspaceId}
                value={userId}
                onChange={setUserId}
                emptyLabel='Eu'
              />
            </FieldBlock>
          ) : null}

          <ToggleRow
            label='Faturável'
            description='Desmarque para registrar o tempo sem cobrar do cliente.'
            checked={billable}
            onCheckedChange={setBillable}
          />

          <FieldBlock label='O que foi feito'>
            <Textarea
              value={description}
              rows={3}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
            />
          </FieldBlock>
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size='sm'
            disabled={!valid || pending}
            onClick={() =>
              onSubmit({
                startedAt: startIso as string,
                endedAt: endIso as string,
                billable,
                description: description.trim() || null,
                userId,
              })
            }
          >
            {pending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
