'use client'

import { Delete02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { type FormEvent, useId, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { useDeleteWorkspace } from '@/src/hooks/use-workspace'
import type { WorkspaceDTO } from '@/types/workspace'

/** Product copy, verbatim (do not reword without the product owner). */
export const DELETE_WORKSPACE_COPY =
  'Excluir este workspace apaga permanentemente todos os projetos, páginas e dados de todos os membros. Depois de excluído, você não poderá restaurá-lo. Continue somente se tiver certeza.'

/** Leaves the workspace once the deletion is queued (full reload on purpose). */
export function leaveWorkspace(): void {
  window.location.assign('/')
}

export function DeleteWorkspaceDialog({
  open,
  onOpenChange,
  workspace,
  onDeleted = leaveWorkspace,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  workspace: Pick<WorkspaceDTO, 'id' | 'name' | 'slug'>
  onDeleted?: () => void
}) {
  const inputId = useId()
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const remove = useDeleteWorkspace(workspace.id)

  const matches = confirmation.trim() === workspace.slug

  function handleOpenChange(next: boolean) {
    if (remove.isPending) return
    if (!next) {
      setConfirmation('')
      setError(null)
    }
    onOpenChange(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!matches || remove.isPending) return
    setError(null)
    try {
      await remove.mutateAsync({ confirmation: confirmation.trim() })
      notify.success(
        'Exclusão solicitada. O workspace será apagado em alguns minutos.',
      )
      onDeleted()
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Não foi possível excluir o workspace',
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>Excluir {workspace.name}?</DialogTitle>
            <DialogDescription>{DELETE_WORKSPACE_COPY}</DialogDescription>
          </DialogHeader>

          <ul className='list-disc space-y-1 pl-4 text-sm text-muted-foreground'>
            <li>Todos os membros perdem o acesso imediatamente.</li>
            <li>
              A exclusão roda em segundo plano e termina em alguns minutos; as
              assinaturas ativas são canceladas antes de qualquer dado ser
              apagado.
            </li>
          </ul>

          <Field data-invalid={!!error || undefined}>
            <FieldLabel htmlFor={inputId}>
              <span>
                Digite <strong className='font-mono'>{workspace.slug}</strong>{' '}
                para confirmar
              </span>
            </FieldLabel>
            <Input
              id={inputId}
              value={confirmation}
              autoComplete='off'
              spellCheck={false}
              disabled={remove.isPending}
              onChange={(e) => setConfirmation(e.target.value)}
            />
            {error && <FieldError>{error}</FieldError>}
          </Field>

          <DialogFooter>
            <Button
              type='button'
              variant='ghost'
              disabled={remove.isPending}
              onClick={() => handleOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              type='submit'
              variant='destructive'
              disabled={!matches || remove.isPending}
            >
              <SteelIcon icon={Delete02Icon} />
              {remove.isPending ? 'Excluindo...' : 'Excluir workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
