'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import {
  type UpdateSdTicketInput,
  useMoveSdTicketPhase,
  useUpdateSdTicket,
} from '@/src/hooks/use-sd-tickets'
import type {
  SdAgentDTO,
  SdConfigBootstrapDTO,
  SdPhaseDTO,
} from '@/types/sd-config'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { SdTicketFieldControl } from './sd-ticket-field-control'
import { sdFieldLabel, sdTicketHref } from './sd-ticket-meta'
import {
  sdMissingPhaseFields,
  sdTicketFieldLabel,
  sdTicketFieldValue,
} from './sd-ticket-options'

interface PendingMove {
  ticket: SdTicketDTO
  phase: SdPhaseDTO
  missing: string[]
  message: string
}

/**
 * Mudança de fase com tratamento das recusas do motor: campos obrigatórios
 * (abre um diálogo para preencher e tenta de novo), aprovação e assinatura
 * (aviso com atalho para a aba do chamado) e transição não permitida.
 * Retorna `move` e o elemento do diálogo (renderize-o uma vez).
 */
export function useSdPhaseMover({
  workspaceId,
  slug,
  config,
  agents,
}: {
  workspaceId: string
  slug: string
  config: SdConfigBootstrapDTO | undefined
  agents: SdAgentDTO[]
}): {
  move: (ticket: SdTicketDTO, phaseId: string) => void
  isPending: boolean
  dialog: ReactNode
} {
  const router = useRouter()
  const mover = useMoveSdTicketPhase(workspaceId)
  const [pending, setPending] = useState<PendingMove | null>(null)

  function explain(ticket: SdTicketDTO, message: string) {
    const lower = message.toLowerCase()
    const tab = lower.includes('aprova')
      ? 'approvals'
      : lower.includes('assinatura')
        ? 'signature'
        : null
    if (tab) {
      toast.error(message, {
        action: {
          label: 'Abrir chamado',
          onClick: () => router.push(sdTicketHref(slug, ticket, tab)),
        },
      })
    } else {
      notify.error(message)
    }
  }

  function move(ticket: SdTicketDTO, phaseId: string) {
    if (ticket.phaseId === phaseId) return
    const phase = config?.phases
      .flatMap((f) => f.phases)
      .find((p) => p.id === phaseId)
    mover.mutate(
      { ticketRef: ticket.id, phaseId },
      {
        onSuccess: (moved) =>
          notify.success(`${moved.code} movido para ${moved.phase.name}.`),
        onError: (error) => {
          const missing =
            phase && config ? sdMissingPhaseFields(ticket, phase, config) : []
          if (phase && missing.length > 0) {
            setPending({ ticket, phase, missing, message: error.message })
          } else {
            explain(ticket, error.message)
          }
        },
      },
    )
  }

  const dialog =
    pending && config ? (
      <SdPhaseRequirementsDialog
        key={`${pending.ticket.id}:${pending.phase.id}`}
        workspaceId={workspaceId}
        config={config}
        agents={agents}
        pending={pending}
        onClose={() => setPending(null)}
        onFailed={(message) => explain(pending.ticket, message)}
      />
    ) : null

  return { move, isPending: mover.isPending, dialog }
}

function SdPhaseRequirementsDialog({
  workspaceId,
  config,
  agents,
  pending,
  onClose,
  onFailed,
}: {
  workspaceId: string
  config: SdConfigBootstrapDTO
  agents: SdAgentDTO[]
  pending: PendingMove
  onClose: () => void
  onFailed: (message: string) => void
}) {
  const { ticket, phase, missing } = pending
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(
      missing.map((field) => [field, sdTicketFieldValue(ticket, field)]),
    ),
  )
  const [error, setError] = useState<string | null>(null)
  const update = useUpdateSdTicket(workspaceId, ticket.id)
  const mover = useMoveSdTicketPhase(workspaceId)
  const busy = update.isPending || mover.isPending

  const context = {
    type: ticket.type,
    categoryId: (values.categoryId as string | null) ?? ticket.category?.id,
    subcategoryId:
      (values.subcategoryId as string | null) ?? ticket.subcategory?.id,
    customerId: (values.customerId as string | null) ?? ticket.customer?.id,
    companyId: ticket.company?.id,
  }

  async function submit() {
    setError(null)
    const patch: UpdateSdTicketInput = {}
    const customFields: Record<string, unknown> = {}
    for (const field of missing) {
      if (field === 'solution' || field === 'solutionClassificationId') {
        continue
      }
      if (field.startsWith('customFields.')) {
        customFields[field.slice(13)] = values[field]
      } else {
        ;(patch as Record<string, unknown>)[field] = values[field]
      }
    }
    if (Object.keys(customFields).length > 0) patch.customFields = customFields
    try {
      if (Object.keys(patch).length > 0) await update.mutateAsync(patch)
      const solution =
        typeof values.solution === 'string' && values.solution.trim()
          ? values.solution.trim()
          : undefined
      const solutionClassificationId =
        typeof values.solutionClassificationId === 'string'
          ? values.solutionClassificationId
          : undefined
      const moved = await mover.mutateAsync({
        ticketRef: ticket.id,
        phaseId: phase.id,
        solution,
        solutionClassificationId,
      })
      notify.success(`${moved.code} movido para ${moved.phase.name}.`)
      onClose()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível mover'
      if (/aprova|assinatura/i.test(message)) {
        onClose()
        onFailed(message)
      } else {
        setError(message)
      }
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>
            Mover {ticket.code} para {phase.name}
          </DialogTitle>
          <DialogDescription>
            Esta fase exige alguns campos. Preencha para concluir a mudança.
          </DialogDescription>
        </DialogHeader>
        <form
          id='sd-phase-requirements'
          className='flex max-h-[60vh] flex-col gap-3 overflow-y-auto'
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
        >
          {missing.map((field) => {
            const id = `sd-req-${field}`
            return (
              <div key={field} className='flex flex-col gap-1.5'>
                <Label htmlFor={id} className='text-xs'>
                  {sdFieldLabel(field)}
                  <span className='text-destructive' aria-hidden>
                    *
                  </span>
                </Label>
                <SdTicketFieldControl
                  id={id}
                  workspaceId={workspaceId}
                  config={config}
                  field={field}
                  context={context}
                  agents={agents}
                  value={values[field]}
                  selectedLabel={sdTicketFieldLabel(ticket, field)}
                  onChange={(value) =>
                    setValues((current) => ({ ...current, [field]: value }))
                  }
                />
              </div>
            )
          })}
          {error ? (
            <p className='text-destructive text-sm' role='alert'>
              {error}
            </p>
          ) : null}
        </form>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type='submit' form='sd-phase-requirements' disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar e mover'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
