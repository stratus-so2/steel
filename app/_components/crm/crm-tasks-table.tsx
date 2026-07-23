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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { notify } from '@/lib/notify'
import {
  useCreateCrmTask,
  useCrmTasks,
  useDeleteCrmTask,
  useUpdateCrmTaskStatus,
} from '@/src/hooks/use-crm-task'
import type { CrmTaskStatusDTO } from '@/types/crm-task'

const STATUSES: CrmTaskStatusDTO[] = ['TODO', 'IN_PROGRESS', 'DONE']

export function CrmTasksTable({ workspaceId }: { workspaceId: string }) {
  const { data: tasks, isLoading } = useCrmTasks(workspaceId)
  const updateStatus = useUpdateCrmTaskStatus(workspaceId)
  const deleteTask = useDeleteCrmTask(workspaceId)

  async function handleStatusChange(taskId: string, status: CrmTaskStatusDTO) {
    try {
      await updateStatus.mutateAsync({ taskId, status })
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDelete(taskId: string) {
    try {
      await deleteTask.mutateAsync(taskId)
      notify.success('Tarefa removida')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex justify-end'>
        <CreateCrmTaskDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarefa</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && tasks?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-center text-muted-foreground'
              >
                Nenhuma tarefa cadastrada
              </TableCell>
            </TableRow>
          )}
          {tasks?.map((task) => (
            <TableRow key={task.id}>
              <TableCell>{task.title}</TableCell>
              <TableCell>
                <Select
                  items={STATUSES.map((s) => ({ value: s, label: s }))}
                  value={task.status}
                  onValueChange={(value) =>
                    handleStatusChange(task.id, value as CrmTaskStatusDTO)
                  }
                >
                  <SelectTrigger className='h-7 w-36 text-xs'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(task.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmTaskDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const createTask = useCreateCrmTask(workspaceId)

  function handleClose() {
    setOpen(false)
    setTitle('')
    createTask.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createTask.mutateAsync({ title })
      notify.success('Tarefa criada')
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
            Nova tarefa
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Título da tarefa'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
              disabled={createTask.isPending || !title}
            >
              {createTask.isPending ? 'Criando...' : 'Criar tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
