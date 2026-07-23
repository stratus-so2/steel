'use client'

import {
  Delete02Icon,
  PlayIcon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
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
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateCrmWorkflow,
  useCrmWorkflowRuns,
  useCrmWorkflows,
  useDeleteCrmWorkflow,
  useRunCrmWorkflow,
  useSetCrmWorkflowActive,
} from '@/src/hooks/use-crm-workflow'
import type {
  CrmWorkflowStatusDTO,
  CrmWorkflowTriggerTypeDTO,
} from '@/types/crm-workflow'

const STATUS_VARIANT: Record<
  CrmWorkflowStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  ACTIVE: 'default',
  DEACTIVATED: 'destructive',
}

const DEFAULT_DEFINITION = JSON.stringify(
  {
    nodes: [{ id: 'n1', type: 'CREATE_TASK', config: { title: 'Ligar' } }],
  },
  null,
  2,
)

export function CrmWorkflowsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: workflows, isLoading } = useCrmWorkflows(workspaceId)
  const deleteWorkflow = useDeleteCrmWorkflow(workspaceId)
  const setActive = useSetCrmWorkflowActive(workspaceId)
  const runWorkflow = useRunCrmWorkflow(workspaceId)
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  )

  async function handleDelete(workflowId: string) {
    try {
      await deleteWorkflow.mutateAsync(workflowId)
      notify.success('Workflow removido')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleToggleActive(workflowId: string, active: boolean) {
    try {
      await setActive.mutateAsync({ workflowId, active })
      notify.success(active ? 'Workflow ativado' : 'Workflow desativado')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleRun(workflowId: string) {
    try {
      await runWorkflow.mutateAsync(workflowId)
      notify.success('Workflow executado')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-end'>
        <CreateCrmWorkflowDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Gatilho</TableHead>
            <TableHead className='w-56' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && workflows?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhum workflow
              </TableCell>
            </TableRow>
          )}
          {workflows?.map((workflow) => (
            <TableRow key={workflow.id}>
              <TableCell>{workflow.name}</TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[workflow.status]}>
                  {workflow.status}
                </Badge>
              </TableCell>
              <TableCell>{workflow.triggerType}</TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    setSelectedWorkflowId(
                      selectedWorkflowId === workflow.id ? null : workflow.id,
                    )
                  }
                >
                  Execuções
                </Button>
                <Button
                  variant='outline'
                  size='xs'
                  onClick={() =>
                    handleToggleActive(
                      workflow.id,
                      workflow.status !== 'ACTIVE',
                    )
                  }
                >
                  {workflow.status === 'ACTIVE' ? 'Desativar' : 'Ativar'}
                </Button>
                <Button
                  variant='default'
                  size='xs'
                  onClick={() => handleRun(workflow.id)}
                  disabled={runWorkflow.isPending}
                >
                  <SteelIcon icon={PlayIcon} strokeWidth={2} />
                  Executar
                </Button>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(workflow.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {selectedWorkflowId && (
        <CrmWorkflowRunsPanel
          workspaceId={workspaceId}
          workflowId={selectedWorkflowId}
        />
      )}
    </div>
  )
}

function CrmWorkflowRunsPanel({
  workspaceId,
  workflowId,
}: {
  workspaceId: string
  workflowId: string
}) {
  const { data: runs, isLoading } = useCrmWorkflowRuns(workspaceId, workflowId)

  return (
    <div className='rounded-md border p-3'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Gatilho</TableHead>
            <TableHead>Erro</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && runs?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={3}
                className='text-center text-muted-foreground'
              >
                Nenhuma execução
              </TableCell>
            </TableRow>
          )}
          {runs?.map((run) => (
            <TableRow key={run.id}>
              <TableCell>{run.status}</TableCell>
              <TableCell>{run.triggerType}</TableCell>
              <TableCell>{run.error ?? '-'}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmWorkflowDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [triggerType, setTriggerType] =
    useState<CrmWorkflowTriggerTypeDTO>('MANUAL')
  const [definitionText, setDefinitionText] = useState(DEFAULT_DEFINITION)
  const createWorkflow = useCreateCrmWorkflow(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setTriggerType('MANUAL')
    setDefinitionText(DEFAULT_DEFINITION)
    createWorkflow.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    let definition: unknown
    try {
      definition = JSON.parse(definitionText)
    } catch {
      notify.error(new Error('Definição inválida: JSON malformado'))
      return
    }
    try {
      await createWorkflow.mutateAsync({
        name,
        triggerType,
        definition: definition as never,
      })
      notify.success('Workflow criado')
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
            Novo workflow
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome'
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Select
                items={[
                  { value: 'MANUAL', label: 'Disparo manual' },
                  { value: 'WEBHOOK', label: 'Webhook' },
                ]}
                value={triggerType}
                onValueChange={(value) =>
                  setTriggerType(value as CrmWorkflowTriggerTypeDTO)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='MANUAL'>Disparo manual</SelectItem>
                    <SelectItem value='WEBHOOK'>Webhook</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Textarea
                value={definitionText}
                onChange={(e) => setDefinitionText(e.target.value)}
                rows={10}
                className='font-mono text-xs'
                required
              />
              <p className='text-muted-foreground text-xs'>
                Lista sequencial de nodes (JSON). Tipos suportados:
                CREATE_PERSON, CREATE_TASK, SEND_EMAIL. Use{' '}
                {'{{trigger.campo}}'} para interpolar o payload do disparo.
              </p>
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
              disabled={createWorkflow.isPending || !name}
            >
              {createWorkflow.isPending ? 'Criando...' : 'Criar workflow'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
