'use client'

import { Cancel01Icon, PlayIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetClose, SheetContent } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { notify } from '@/lib/notify'
import { cn } from '@/lib/utils'
import {
  useCrmWorkflowRuns,
  useResumeCrmWorkflowRun,
} from '@/src/hooks/use-crm-workflow'
import type {
  CrmWorkflowRunDTO,
  CrmWorkflowRunStatus,
} from '@/src/schemas/crm-workflow.schema'

const STATUS_COLOR: Record<CrmWorkflowRunStatus, string> = {
  PENDING: 'bg-muted text-muted-foreground',
  RUNNING: 'bg-amber-500/10 text-amber-600',
  WAITING: 'bg-sky-500/10 text-sky-600',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600',
  FAILED: 'bg-rose-500/10 text-rose-600',
  CANCELED: 'bg-zinc-500/10 text-zinc-600',
}

export function WorkflowRunsDrawer({
  workspaceId,
  workflowId,
  open,
  onOpenChange,
}: {
  workspaceId: string
  workflowId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const {
    data: runs,
    isLoading,
    refetch,
  } = useCrmWorkflowRuns(workspaceId, open ? workflowId : null)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side='right'
        className='!w-[480px] !max-w-[480px] overflow-auto p-0'
      >
        <div className='flex h-14 shrink-0 items-center gap-2 border-b px-4'>
          <span className='font-semibold text-sm'>Histórico de execuções</span>
          <SheetClose
            className='ml-auto'
            nativeButton={true}
            render={
              <Button variant='ghost' size='icon-sm'>
                <SteelIcon icon={Cancel01Icon} strokeWidth={2} />
              </Button>
            }
          />
        </div>
        <div className='flex-1 space-y-2 p-3'>
          {isLoading && (
            <>
              <Skeleton className='h-16 w-full' />
              <Skeleton className='h-16 w-full' />
            </>
          )}
          {!isLoading && (!runs || runs.length === 0) && (
            <p className='py-8 text-center text-muted-foreground text-sm'>
              Nenhuma execução ainda. Use "Test" pra disparar uma run.
            </p>
          )}
          {!isLoading &&
            runs?.map((run) => (
              <div
                key={run.id}
                className='rounded-lg border bg-card p-3 text-card-foreground'
              >
                <div className='flex items-center gap-2'>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 font-semibold text-xs uppercase',
                      STATUS_COLOR[run.status],
                    )}
                  >
                    {run.status}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {run.triggerType}
                  </span>
                  <span className='ml-auto text-muted-foreground text-xs'>
                    {new Date(run.createdAt).toLocaleString()}
                  </span>
                </div>
                {run.error && (
                  <p className='mt-2 rounded bg-rose-500/10 p-2 text-rose-600 text-xs'>
                    {run.error}
                  </p>
                )}
                {run.steps && run.steps.length > 0 && (
                  <ul className='mt-2 space-y-1 text-xs'>
                    {run.steps.map((step) => (
                      <li
                        key={step.id}
                        className='flex items-center gap-2 text-muted-foreground'
                      >
                        <span
                          className={cn(
                            'rounded px-1.5 py-px text-[10px] uppercase',
                            step.status === 'COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : step.status === 'FAILED'
                                ? 'bg-rose-500/10 text-rose-600'
                                : 'bg-muted text-muted-foreground',
                          )}
                        >
                          {step.status}
                        </span>
                        <span className='truncate'>
                          {step.nodeType} · {step.nodeId}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {run.status === 'WAITING' && (
                  <ResumeForm
                    workspaceId={workspaceId}
                    workflowId={workflowId}
                    run={run}
                    onResolved={refetch}
                  />
                )}
              </div>
            ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ResumeForm({
  workspaceId,
  workflowId,
  run,
  onResolved,
}: {
  workspaceId: string
  workflowId: string
  run: CrmWorkflowRunDTO
  onResolved: () => void
}) {
  const waitingStep = run.steps?.find((s) => s.id === run.waitingStepId)
  const fields =
    (waitingStep?.output as { fields?: string[] } | null)?.fields ?? []
  const [values, setValues] = useState<Record<string, string>>({})
  const resumeRun = useResumeCrmWorkflowRun(workspaceId)

  if (fields.length === 0) return null

  const handleSubmit = async () => {
    try {
      await resumeRun.mutateAsync({
        workflowId,
        runId: run.id,
        payload: values,
      })
      notify.success('Run retomada')
      onResolved()
    } catch (err) {
      notify.error(err, 'Falha ao retomar a run.')
    }
  }

  return (
    <div className='mt-3 space-y-2 rounded-md border border-sky-500/30 bg-sky-500/5 p-3'>
      <p className='font-medium text-sky-700 text-xs dark:text-sky-300'>
        Aguardando preenchimento
      </p>
      {fields.map((name) => (
        <div key={name} className='space-y-1'>
          <Label className='text-muted-foreground text-xs'>{name}</Label>
          <Input
            value={values[name] ?? ''}
            onChange={(e) =>
              setValues((v) => ({ ...v, [name]: e.target.value }))
            }
            className='h-8'
          />
        </div>
      ))}
      <Button
        size='sm'
        onClick={handleSubmit}
        disabled={resumeRun.isPending}
        className='w-full'
      >
        <SteelIcon icon={PlayIcon} strokeWidth={2} />
        Continuar
      </Button>
    </div>
  )
}
