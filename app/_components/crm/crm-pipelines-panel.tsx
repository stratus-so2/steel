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
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCreateCrmPipeline,
  useCreateCrmPipelineStage,
  useCrmPipelineStages,
  useCrmPipelines,
  useDeleteCrmPipeline,
  useDeleteCrmPipelineStage,
  useUpdateCrmPipelineStage,
} from '@/src/hooks/use-crm-pipeline'
import type { CrmPipelineStageDTO } from '@/types/crm-pipeline'

export function CrmPipelinesPanel({ workspaceId }: { workspaceId: string }) {
  const { data: pipelines, isLoading } = useCrmPipelines(workspaceId)
  const deletePipeline = useDeleteCrmPipeline(workspaceId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!selectedId && pipelines && pipelines.length > 0) {
      setSelectedId(pipelines[0].id)
    }
  }, [pipelines, selectedId])

  async function handleDelete(pipelineId: string) {
    try {
      await deletePipeline.mutateAsync(pipelineId)
      notify.success('Pipeline removido')
      if (selectedId === pipelineId) setSelectedId(null)
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
      <div className='flex flex-col gap-3 sm:col-span-1'>
        <div className='flex justify-end'>
          <CreateCrmPipelineDialog workspaceId={workspaceId} />
        </div>
        <div className='flex flex-col gap-1'>
          {!isLoading && pipelines?.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              Nenhum pipeline cadastrado
            </p>
          )}
          {pipelines?.map((pipeline) => (
            <button
              type='button'
              key={pipeline.id}
              onClick={() => setSelectedId(pipeline.id)}
              className={cn(
                'flex items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted',
                selectedId === pipeline.id && 'bg-muted font-medium',
              )}
            >
              {pipeline.name}
              <Button
                variant='ghost'
                size='icon-xs'
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(pipeline.id)
                }}
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </Button>
            </button>
          ))}
        </div>
      </div>
      <div className='sm:col-span-2'>
        {selectedId ? (
          <CrmPipelineStagesList
            workspaceId={workspaceId}
            pipelineId={selectedId}
          />
        ) : (
          <p className='text-sm text-muted-foreground'>
            Selecione um pipeline para gerenciar as etapas
          </p>
        )}
      </div>
    </div>
  )
}

function CreateCrmPipelineDialog({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const createPipeline = useCreateCrmPipeline(workspaceId)

  function handleClose() {
    setOpen(false)
    setName('')
    createPipeline.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createPipeline.mutateAsync({ name })
      notify.success('Pipeline criado')
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
            Novo pipeline
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                placeholder='Nome do pipeline'
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
              disabled={createPipeline.isPending || !name}
            >
              {createPipeline.isPending ? 'Criando...' : 'Criar pipeline'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CrmPipelineStagesList({
  workspaceId,
  pipelineId,
}: {
  workspaceId: string
  pipelineId: string
}) {
  const { data: stages, isLoading } = useCrmPipelineStages(
    workspaceId,
    pipelineId,
  )
  const createStage = useCreateCrmPipelineStage(workspaceId, pipelineId)
  const updateStage = useUpdateCrmPipelineStage(workspaceId, pipelineId)
  const deleteStage = useDeleteCrmPipelineStage(workspaceId, pipelineId)
  const [stageName, setStageName] = useState('')

  async function handleCreateStage(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createStage.mutateAsync({ name: stageName })
      setStageName('')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleDeleteStage(stageId: string) {
    try {
      await deleteStage.mutateAsync(stageId)
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <form onSubmit={handleCreateStage} className='flex gap-2'>
        <Input
          placeholder='Nova etapa'
          value={stageName}
          onChange={(e) => setStageName(e.target.value)}
          required
        />
        <Button
          type='submit'
          size='sm'
          disabled={createStage.isPending || !stageName}
        >
          Adicionar
        </Button>
      </form>
      <div className='flex flex-col gap-1'>
        {!isLoading && stages?.length === 0 && (
          <p className='text-sm text-muted-foreground'>
            Nenhuma etapa cadastrada
          </p>
        )}
        {stages?.map((stage) => (
          <CrmPipelineStageRow
            key={stage.id}
            stage={stage}
            onUpdate={updateStage}
            onDelete={() => handleDeleteStage(stage.id)}
          />
        ))}
      </div>
    </div>
  )
}

function CrmPipelineStageRow({
  stage,
  onUpdate,
  onDelete,
}: {
  stage: CrmPipelineStageDTO
  onUpdate: ReturnType<typeof useUpdateCrmPipelineStage>
  onDelete: () => void
}) {
  const [editingField, setEditingField] = useState<
    'name' | 'probability' | null
  >(null)
  const [draft, setDraft] = useState('')

  function startEdit(field: 'name' | 'probability') {
    setDraft(field === 'name' ? stage.name : String(stage.probability))
    setEditingField(field)
  }

  async function save() {
    const field = editingField
    setEditingField(null)
    if (!field) return
    try {
      if (field === 'name') {
        const value = draft.trim()
        if (!value || value === stage.name) return
        await onUpdate.mutateAsync({ stageId: stage.id, name: value })
      } else {
        const value = Math.max(0, Math.min(100, Math.round(Number(draft)) || 0))
        if (value === stage.probability) return
        await onUpdate.mutateAsync({ stageId: stage.id, probability: value })
      }
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm'>
      {editingField === 'name' ? (
        <Input
          autoFocus
          value={draft}
          className='h-7'
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') save()
            if (e.key === 'Escape') setEditingField(null)
          }}
        />
      ) : (
        <button
          type='button'
          onClick={() => startEdit('name')}
          className='rounded px-1.5 py-0.5 text-left hover:bg-muted/50'
        >
          {stage.name}
        </button>
      )}
      <div className='flex items-center gap-2'>
        {editingField === 'probability' ? (
          <Input
            autoFocus
            type='number'
            min={0}
            max={100}
            value={draft}
            className='h-7 w-16 text-right'
            onChange={(e) => setDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
              if (e.key === 'Escape') setEditingField(null)
            }}
          />
        ) : (
          <button
            type='button'
            onClick={() => startEdit('probability')}
            className='rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50'
          >
            {stage.probability}%
          </button>
        )}
        <Button variant='ghost' size='icon-xs' onClick={onDelete}>
          <SteelIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>
    </div>
  )
}
