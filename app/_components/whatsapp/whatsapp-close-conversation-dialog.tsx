'use client'

import { type FormEvent, useState } from 'react'
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
import { Textarea } from '@/components/ui/textarea'

const REASON_MAX = 500

export function WhatsappCloseConversationDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string | undefined) => void
  isPending: boolean
}) {
  const [reason, setReason] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    onConfirm(reason.trim() || undefined)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setReason('')
        onOpenChange(next)
      }}
    >
      <DialogContent className='max-w-md'>
        <DialogHeader>
          <DialogTitle>Fechar conversa</DialogTitle>
          <DialogDescription>
            A conversa sai da caixa de entrada ativa e a IA para de responder.
            Ela é reaberta automaticamente se o contato enviar uma nova
            mensagem.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className='space-y-3'>
          <div className='space-y-1.5'>
            <Label htmlFor='closeReason'>Motivo (opcional)</Label>
            <Textarea
              id='closeReason'
              rows={3}
              maxLength={REASON_MAX}
              placeholder='Ex.: atendimento concluído'
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type='submit' disabled={isPending}>
              {isPending ? 'Fechando...' : 'Fechar conversa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
