'use client'

import { type ReactNode, useEffect, useId, useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export const MIN_REASON_LENGTH = 5

export interface ConfirmActionValues {
  reason: string
  confirmSlug: string
}

/**
 * Confirmação das ações do admin: motivo obrigatório (vai para a auditoria)
 * e, nas destrutivas, o slug digitado à mão. O botão só libera quando tudo
 * confere; o servidor valida de novo.
 */
export function ConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel = 'Enviando...',
  destructive = false,
  requireSlug,
  extraValid = true,
  pending,
  children,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  pendingLabel?: string
  destructive?: boolean
  /** Slug que o admin precisa digitar (exclusão/restauração). */
  requireSlug?: string
  /** Validade de campos extras passados em `children`. */
  extraValid?: boolean
  pending: boolean
  children?: ReactNode
  onConfirm: (values: ConfirmActionValues) => void
}) {
  const [reason, setReason] = useState('')
  const [slug, setSlug] = useState('')
  const reasonId = useId()
  const slugId = useId()

  // Cada abertura começa limpa (o diálogo pode seguir montado entre usos).
  useEffect(() => {
    if (open) {
      setReason('')
      setSlug('')
    }
  }, [open])

  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH
  const slugOk = requireSlug === undefined || slug.trim() === requireSlug
  const canConfirm = reasonOk && slugOk && extraValid && !pending

  function handleOpenChange(next: boolean) {
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<div />}>{description}</DialogDescription>
        </DialogHeader>

        <form
          className='space-y-4'
          onSubmit={(event) => {
            event.preventDefault()
            if (canConfirm) {
              onConfirm({ reason: reason.trim(), confirmSlug: slug.trim() })
            }
          }}
        >
          {children}

          <div className='space-y-1.5'>
            <Label htmlFor={reasonId}>Motivo</Label>
            <Textarea
              id={reasonId}
              value={reason}
              maxLength={500}
              placeholder='Fica registrado na auditoria (mín. 5 caracteres)'
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {requireSlug !== undefined && (
            <div className='space-y-1.5'>
              <Label htmlFor={slugId} className='block leading-normal'>
                Digite{' '}
                <code className='rounded bg-muted px-1 py-0.5 font-mono text-xs'>
                  {requireSlug}
                </code>{' '}
                para confirmar
              </Label>
              <Input
                id={slugId}
                value={slug}
                autoComplete='off'
                spellCheck={false}
                className='font-mono'
                onChange={(e) => setSlug(e.target.value)}
                aria-invalid={slug.length > 0 && !slugOk}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type='submit'
              variant={destructive ? 'destructive' : 'default'}
              disabled={!canConfirm}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
