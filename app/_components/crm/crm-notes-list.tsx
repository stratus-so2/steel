'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateCrmNote,
  useCrmNotes,
  useDeleteCrmNote,
} from '@/src/hooks/use-crm-note'

export function CrmNotesList({ workspaceId }: { workspaceId: string }) {
  const { data: notes, isLoading } = useCrmNotes(workspaceId)
  const deleteNote = useDeleteCrmNote(workspaceId)

  async function handleDelete(noteId: string) {
    try {
      await deleteNote.mutateAsync(noteId)
      notify.success('Nota removida')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmNoteDialog workspaceId={workspaceId} />
      </div>
      {!isLoading && notes?.length === 0 && (
        <p className='text-sm text-muted-foreground'>Nenhuma nota cadastrada</p>
      )}
      <div className='flex flex-col gap-2'>
        {notes?.map((note) => (
          <div
            key={note.id}
            className='flex items-start justify-between rounded-md border border-border p-3 text-sm'
          >
            <span className='whitespace-pre-wrap'>{note.body}</span>
            <Button
              variant='ghost'
              size='icon-xs'
              onClick={() => handleDelete(note.id)}
            >
              <SteelIcon icon={Delete02Icon} strokeWidth={2} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}

function CreateCrmNoteDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const createNote = useCreateCrmNote(workspaceId)

  function handleClose() {
    setOpen(false)
    setBody('')
    createNote.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createNote.mutateAsync({ body })
      notify.success('Nota criada')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova nota
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Textarea
                placeholder='Conteúdo da nota'
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={createNote.isPending || !body}
            >
              {createNote.isPending ? 'Criando...' : 'Criar nota'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
