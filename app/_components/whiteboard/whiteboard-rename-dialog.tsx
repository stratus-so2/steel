'use client'

import { type FormEvent, useEffect, useState } from 'react'
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
import { notify } from '@/lib/notify'
import { useRenameWhiteboard } from '@/src/hooks/use-whiteboard'
import { WHITEBOARD_TITLE_MAX } from '@/src/schemas/whiteboard.schema'

export function WhiteboardRenameDialog({
  workspaceId,
  board,
  onOpenChange,
}: {
  workspaceId: string
  /** The board being renamed; `null` closes the dialog. */
  board: { id: string; title: string } | null
  onOpenChange: (open: boolean) => void
}) {
  const [title, setTitle] = useState('')
  const rename = useRenameWhiteboard(workspaceId)

  useEffect(() => {
    if (board) setTitle(board.title)
  }, [board])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!board) return
    rename.mutate(
      { id: board.id, title: title.trim() },
      {
        onSuccess: () => {
          notify.success('Quadro renomeado')
          onOpenChange(false)
        },
        onError: notify.error,
      },
    )
  }

  return (
    <Dialog open={board !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>Renomear quadro</DialogTitle>
            <DialogDescription>
              O novo nome aparece para todo o workspace.
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-2'>
            <Label htmlFor='whiteboard-title'>Nome</Label>
            <Input
              id='whiteboard-title'
              value={title}
              maxLength={WHITEBOARD_TITLE_MAX}
              placeholder='Quadro sem título'
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type='submit' disabled={rename.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
