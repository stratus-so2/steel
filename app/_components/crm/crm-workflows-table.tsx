'use client'

import { Add01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { notify } from '@/lib/notify'
import {
  useCreateCrmWorkflow,
  useCrmWorkflows,
} from '@/src/hooks/use-crm-workflow'
import { useCrmWorkspaceLookups } from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmWorkflowDTO } from '@/src/schemas/crm-workflow.schema'

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  ACTIVE: 'bg-emerald-500/15 text-emerald-600',
  DEACTIVATED: 'bg-rose-500/15 text-rose-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    primary: true,
    readonly: true,
    linkView: true,
    placeholder: 'Novo workflow',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    readonly: true,
    options: [
      { value: 'DRAFT', label: 'Rascunho' },
      { value: 'ACTIVE', label: 'Ativo' },
      { value: 'DEACTIVATED', label: 'Desativado' },
    ],
    optionStyles: STATUS_STYLES,
  },
  { key: 'lastRunAt', header: 'Última execução', kind: 'readonly-date' },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmWorkflowsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const { data: workflows, isLoading, refetch } = useCrmWorkflows(workspaceId)
  const { lookups } = useCrmWorkspaceLookups(workspaceId, [])
  const columns = React.useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={workflows ?? []}
      workspaceId={workspaceId}
      slug={slug}
      resource='workflows'
      createTitle='workflow'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar workflows…'
      refetch={refetch}
      disableInlineCreate
      headerAction={
        <CreateCrmWorkflowDialog workspaceId={workspaceId} slug={slug} />
      }
      onOpenRecord={(record: CrmWorkflowDTO) =>
        router.push(`/${slug}/crm/workflows/${record.id}`)
      }
    />
  )
}

/** Dialog de criação: define só o nome — o resto é editado no canvas. */
function CreateCrmWorkflowDialog({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const createWorkflow = useCreateCrmWorkflow(workspaceId)

  async function handleCreate() {
    if (!name.trim()) {
      notify.error('Informe o nome do workflow.')
      return
    }
    try {
      const created = await createWorkflow.mutateAsync({ name: name.trim() })
      setOpen(false)
      setName('')
      router.push(`/${slug}/crm/workflows/${created.id}`)
    } catch (err) {
      notify.error(err, 'Não foi possível criar o workflow.')
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setName('')
      }}
    >
      <Button size='sm' onClick={() => setOpen(true)}>
        <SteelIcon icon={Add01Icon} strokeWidth={2} />
        Novo workflow
      </Button>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Novo workflow</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-1.5'>
          <Label htmlFor='workflow-name'>Nome</Label>
          <Input
            id='workflow-name'
            value={name}
            placeholder='Boas-vindas a novos leads'
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant='outline' />}>
            Cancelar
          </DialogClose>
          <Button onClick={handleCreate} disabled={createWorkflow.isPending}>
            {createWorkflow.isPending ? 'Criando…' : 'Criar e abrir'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
