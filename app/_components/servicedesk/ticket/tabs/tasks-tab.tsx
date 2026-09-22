'use client'

import {
  Calendar03Icon,
  PencilEdit02Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  type SdTicketTaskInput,
  useCreateSdTicketTask,
  useDeleteSdTicketTask,
  useReorderSdTicketTasks,
  useSdTicketTasks,
  useUpdateSdTicketTask,
} from '@/src/hooks/use-sd-ticket-tasks'
import { useSdTicketRealtime } from '@/src/hooks/use-sd-tickets'
import type { SdTaskStatusDTO, SdTicketTaskDTO } from '@/types/sd-ticket-task'
import {
  ConfirmDeleteButton,
  EmptyState,
  SortableList,
} from '../../settings/sd-settings-kit'
import { SdNativeSelect } from '../shared/sd-native-select'
import { SdAgentOnlyNotice } from '../shared/sd-tab-bits'
import { formatDate, formatDateTime } from '../shared/sd-tab-format'
import { SdTaskFormDialog } from '../tasks/sd-task-form-dialog'
import type { SdTicketTabProps } from './types'

export const SD_TASK_STATUS_OPTIONS: {
  value: SdTaskStatusDTO
  label: string
}[] = [
  { value: 'TODO', label: 'A fazer' },
  { value: 'IN_PROGRESS', label: 'Em andamento' },
  { value: 'DONE', label: 'Concluída' },
  { value: 'CANCELED', label: 'Cancelada' },
]

type DialogState = { task: SdTicketTaskDTO | null } | null

/** Tarefas do chamado (checklist ordenável com responsável e prazo). */
export function SdTicketTasksTab({
  workspaceId,
  ticket,
  mode,
}: SdTicketTabProps) {
  const ticketRef = ticket.id
  const isAgent = mode === 'agent'
  useSdTicketRealtime(isAgent ? workspaceId : undefined)
  const query = useSdTicketTasks(isAgent ? workspaceId : '', ticketRef)
  const create = useCreateSdTicketTask(workspaceId, ticketRef)
  const update = useUpdateSdTicketTask(workspaceId, ticketRef)
  const remove = useDeleteSdTicketTask(workspaceId, ticketRef)
  const reorder = useReorderSdTicketTasks(workspaceId, ticketRef)
  const [quickTitle, setQuickTitle] = useState('')
  const [dialog, setDialog] = useState<DialogState>(null)

  if (!isAgent) return <SdAgentOnlyNotice />

  const items = query.data?.items ?? []
  const progress = query.data?.progress ?? { done: 0, total: 0, percent: 0 }

  function patch(task: SdTicketTaskDTO, data: SdTicketTaskInput) {
    update.mutate(
      { id: task.id, data },
      { onError: (error) => notify.error(error) },
    )
  }

  async function quickAdd() {
    const title = quickTitle.trim()
    if (!title) return
    try {
      await create.mutateAsync({ title })
      setQuickTitle('')
    } catch (error) {
      notify.error(error)
    }
  }

  async function submitDialog(data: SdTicketTaskInput & { title: string }) {
    try {
      if (dialog?.task) {
        await update.mutateAsync({ id: dialog.task.id, data })
      } else {
        await create.mutateAsync(data)
      }
      setDialog(null)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='flex flex-col gap-1.5'>
        <div className='flex items-center justify-between text-sm'>
          <span className='font-medium'>Progresso</span>
          <span className='text-muted-foreground tabular-nums'>
            {progress.done}/{progress.total} concluídas · {progress.percent}%
          </span>
        </div>
        <div
          className='h-2 overflow-hidden rounded-full bg-muted'
          role='progressbar'
          aria-valuenow={progress.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label='Progresso das tarefas'
        >
          <div
            className='h-full rounded-full bg-primary transition-all'
            style={{ width: `${progress.percent}%` }}
          />
        </div>
      </div>

      <form
        className='flex gap-2'
        onSubmit={(e) => {
          e.preventDefault()
          void quickAdd()
        }}
      >
        <Input
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder='Adicionar tarefa e pressionar Enter'
          aria-label='Nova tarefa'
        />
        <Button type='submit' size='sm' disabled={!quickTitle.trim()}>
          Adicionar
        </Button>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={() => setDialog({ task: null })}
        >
          <SteelIcon icon={PlusSignIcon} />
          Detalhada
        </Button>
      </form>

      {query.error ? (
        <EmptyState>{query.error.message}</EmptyState>
      ) : !query.isLoading && items.length === 0 ? (
        <EmptyState>Nenhuma tarefa neste chamado.</EmptyState>
      ) : (
        <SortableList
          items={items}
          onReorder={(orderedIds) =>
            reorder.mutate(orderedIds, {
              onError: (error) => notify.error(error),
            })
          }
          renderItem={(task, handle) => {
            const done = task.status === 'DONE'
            const canceled = task.status === 'CANCELED'
            return (
              <div
                className={cn(
                  'flex items-start gap-2 rounded-lg border border-border bg-card px-3 py-2',
                  task.overdue && 'border-destructive/50 bg-destructive/5',
                  canceled && 'opacity-60',
                )}
                data-testid='sd-task'
              >
                <div className='pt-0.5'>{handle}</div>
                <Checkbox
                  className='mt-0.5'
                  checked={done}
                  disabled={canceled}
                  aria-label={
                    done ? `Reabrir ${task.title}` : `Concluir ${task.title}`
                  }
                  onCheckedChange={(checked) =>
                    patch(task, { status: checked ? 'DONE' : 'TODO' })
                  }
                />
                <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
                  <span
                    className={cn(
                      'font-medium text-sm',
                      (done || canceled) &&
                        'text-muted-foreground line-through',
                    )}
                  >
                    {task.title}
                  </span>
                  {task.description ? (
                    <span className='line-clamp-2 text-muted-foreground text-xs'>
                      {task.description}
                    </span>
                  ) : null}
                  <div className='flex flex-wrap items-center gap-x-3 gap-y-0.5 text-muted-foreground text-xs'>
                    {task.assignee ? <span>{task.assignee.name}</span> : null}
                    {task.dueDate ? (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1',
                          task.overdue && 'font-medium text-destructive',
                        )}
                      >
                        <SteelIcon icon={Calendar03Icon} size={12} />
                        {formatDate(task.dueDate)}
                        {task.overdue ? ' · atrasada' : ''}
                      </span>
                    ) : null}
                    {task.completedAt ? (
                      <span>
                        Concluída em {formatDateTime(task.completedAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <SdNativeSelect
                  label={`Status de ${task.title}`}
                  value={task.status}
                  options={SD_TASK_STATUS_OPTIONS}
                  onChange={(status) => patch(task, { status })}
                />
                <Button
                  size='icon-xs'
                  variant='ghost'
                  aria-label={`Editar ${task.title}`}
                  onClick={() => setDialog({ task })}
                >
                  <SteelIcon icon={PencilEdit02Icon} />
                </Button>
                <ConfirmDeleteButton
                  title='Excluir tarefa?'
                  description={`"${task.title}" será removida do chamado.`}
                  pending={remove.isPending}
                  onConfirm={() =>
                    remove.mutate(task.id, {
                      onError: (error) => notify.error(error),
                    })
                  }
                />
              </div>
            )
          }}
        />
      )}

      <SdTaskFormDialog
        workspaceId={workspaceId}
        open={dialog !== null}
        task={dialog?.task ?? null}
        pending={create.isPending || update.isPending}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        onSubmit={(data) => void submitDialog(data)}
      />
    </div>
  )
}
