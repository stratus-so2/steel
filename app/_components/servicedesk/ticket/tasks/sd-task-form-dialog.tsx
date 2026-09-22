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
import { Textarea } from '@/components/ui/textarea'
import type { SdTicketTaskInput } from '@/src/hooks/use-sd-ticket-tasks'
import type { SdTicketTaskDTO } from '@/types/sd-ticket-task'
import { FieldBlock } from '../../settings/sd-settings-kit'
import { SdAgentSelect } from '../shared/sd-tab-bits'
import { fromDateInput, toDateInput } from '../shared/sd-tab-format'

/** Criar/editar tarefa (título, responsável, prazo, descrição). */
export function SdTaskFormDialog({
  workspaceId,
  open,
  task,
  pending,
  onOpenChange,
  onSubmit,
}: {
  workspaceId: string
  open: boolean
  task: SdTicketTaskDTO | null
  pending?: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: SdTicketTaskInput & { title: string }) => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!open) return
    setTitle(task?.title ?? '')
    setDescription(task?.description ?? '')
    setAssigneeId(task?.assignee?.id ?? null)
    setDueDate(toDateInput(task?.dueDate))
  }, [open, task])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
        </DialogHeader>
        <form
          className='flex flex-col gap-3'
          onSubmit={(e) => {
            e.preventDefault()
            if (!title.trim()) return
            onSubmit({
              title: title.trim(),
              description: description.trim() || null,
              assigneeId,
              dueDate: fromDateInput(dueDate),
            })
          }}
        >
          <FieldBlock label='Título'>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder='Ex.: Trocar o cabo de rede'
              aria-label='Título da tarefa'
              autoFocus
            />
          </FieldBlock>
          <div className='grid gap-3 sm:grid-cols-2'>
            <FieldBlock label='Responsável'>
              <SdAgentSelect
                workspaceId={workspaceId}
                value={assigneeId}
                onChange={setAssigneeId}
              />
            </FieldBlock>
            <FieldBlock label='Prazo'>
              <Input
                type='date'
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                aria-label='Prazo da tarefa'
              />
            </FieldBlock>
          </div>
          <FieldBlock label='Descrição'>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              aria-label='Descrição da tarefa'
              rows={3}
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
            <Button type='submit' disabled={pending || !title.trim()}>
              {task ? 'Salvar' : 'Criar tarefa'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
