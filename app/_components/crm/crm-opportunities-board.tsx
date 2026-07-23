'use client'

import { Delete02Icon, PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useEffect, useState } from 'react'
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
import { notify } from '@/lib/notify'
import {
  useCreateCrmOpportunity,
  useCrmOpportunities,
  useDeleteCrmOpportunity,
  useMoveCrmOpportunity,
} from '@/src/hooks/use-crm-opportunity'
import {
  useCrmPipelineStages,
  useCrmPipelines,
} from '@/src/hooks/use-crm-pipeline'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function CrmOpportunitiesBoard({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { data: pipelines } = useCrmPipelines(workspaceId)
  const [pipelineId, setPipelineId] = useState<string | null>(null)

  useEffect(() => {
    if (!pipelineId && pipelines && pipelines.length > 0) {
      setPipelineId(pipelines[0].id)
    }
  }, [pipelines, pipelineId])

  const { data: stages } = useCrmPipelineStages(workspaceId, pipelineId ?? '')
  const { data: opportunities } = useCrmOpportunities(
    workspaceId,
    pipelineId ?? undefined,
  )
  const moveOpportunity = useMoveCrmOpportunity(workspaceId, pipelineId ?? '')
  const deleteOpportunity = useDeleteCrmOpportunity(
    workspaceId,
    pipelineId ?? '',
  )

  async function handleMove(opportunityId: string, stageId: string) {
    try {
      await moveOpportunity.mutateAsync({ opportunityId, stageId })
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDelete(opportunityId: string) {
    try {
      await deleteOpportunity.mutateAsync(opportunityId)
      notify.success('Oportunidade removida')
    } catch (err) {
      notify.error(err)
    }
  }

  if (!pipelines || pipelines.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        Crie um pipeline na aba Pipelines para gerenciar oportunidades
      </p>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <Select
          items={pipelines.map((p) => ({ value: p.id, label: p.name }))}
          value={pipelineId ?? undefined}
          onValueChange={(value) => setPipelineId(value as string)}
        >
          <SelectTrigger className='w-56'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {pipelineId && (
          <CreateCrmOpportunityDialog
            workspaceId={workspaceId}
            pipelineId={pipelineId}
            stages={stages ?? []}
          />
        )}
      </div>

      <div className='flex gap-4 overflow-x-auto'>
        {stages?.map((stage) => {
          const stageOpportunities =
            opportunities?.filter((o) => o.stageId === stage.id) ?? []
          return (
            <div
              key={stage.id}
              className='flex w-72 shrink-0 flex-col gap-2 rounded-lg border border-border p-3'
            >
              <div className='flex items-center justify-between text-sm font-medium'>
                <span>{stage.name}</span>
                <span className='text-xs text-muted-foreground'>
                  {stageOpportunities.length}
                </span>
              </div>
              <div className='flex flex-col gap-2'>
                {stageOpportunities.map((opportunity) => (
                  <div
                    key={opportunity.id}
                    className='flex flex-col gap-2 rounded-md border border-border p-2 text-sm'
                  >
                    <div className='flex items-center justify-between'>
                      <span className='font-medium'>{opportunity.name}</span>
                      <Button
                        variant='ghost'
                        size='icon-xs'
                        onClick={() => handleDelete(opportunity.id)}
                      >
                        <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                      </Button>
                    </div>
                    {opportunity.amount !== null && (
                      <span className='text-xs text-muted-foreground'>
                        {currencyFormatter.format(opportunity.amount)}
                      </span>
                    )}
                    <Select
                      items={(stages ?? []).map((s) => ({
                        value: s.id,
                        label: s.name,
                      }))}
                      value={opportunity.stageId}
                      onValueChange={(value) =>
                        handleMove(opportunity.id, value as string)
                      }
                    >
                      <SelectTrigger className='h-7 text-xs'>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {(stages ?? []).map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CreateCrmOpportunityDialog({
  workspaceId,
  pipelineId,
  stages,
}: {
  workspaceId: string
  pipelineId: string
  stages: { id: string; name: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [stageId, setStageId] = useState('')
  const createOpportunity = useCreateCrmOpportunity(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    setStageId('')
    createOpportunity.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createOpportunity.mutateAsync({
        name,
        pipelineId,
        stageId: stageId || stages[0]?.id,
      })
      notify.success('Oportunidade criada')
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
          <Button variant='default' size='xs' disabled={stages.length === 0}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova oportunidade
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome da oportunidade'
                value={name}
                onChange={(e) => setName(e.target.value)}
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
              disabled={createOpportunity.isPending || !name}
            >
              {createOpportunity.isPending
                ? 'Criando...'
                : 'Criar oportunidade'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
