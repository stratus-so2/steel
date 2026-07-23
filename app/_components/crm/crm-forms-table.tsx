'use client'

import { PlusSignIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { CrmFormStatsPanel } from '@/app/_components/crm/crm-form-stats-panel'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notify'
import {
  createCrmResource,
  useCrmResourceList,
} from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmFormDTO } from '@/types/crm-form'

const LOOKUP_KINDS: LookupKind[] = ['users']

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600',
}

const ACTION_STYLES: Record<string, string> = {
  COMPANY: 'bg-blue-500/15 text-blue-600',
  PERSON: 'bg-emerald-500/15 text-emerald-600',
  LEAD: 'bg-amber-500/15 text-amber-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    primary: true,
    readonly: true,
    linkView: true,
    placeholder: 'Formulário de contato',
  },
  {
    key: 'action',
    header: 'Ação',
    kind: 'select',
    readonly: true,
    options: [
      { value: 'COMPANY', label: 'Empresa' },
      { value: 'PERSON', label: 'Pessoa' },
      { value: 'LEAD', label: 'Lead' },
    ],
    optionStyles: ACTION_STYLES,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    readonly: true,
    options: [
      { value: 'DRAFT', label: 'Offline' },
      { value: 'PUBLISHED', label: 'Online' },
    ],
    optionStyles: STATUS_STYLES,
  },
  {
    key: 'submissionCount',
    header: 'Submissões',
    kind: 'number',
    readonly: true,
  },
  {
    key: 'createdById',
    header: 'Criado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmFormsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const { items, isLoading, refetch } = useCrmResourceList<CrmFormDTO>(
    workspaceId,
    'forms',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])
  const [creating, setCreating] = useState(false)
  const [statsForm, setStatsForm] = useState<CrmFormDTO | null>(null)

  async function onCreate() {
    setCreating(true)
    const res = await createCrmResource<CrmFormDTO>(workspaceId, 'forms', {
      name: 'Novo formulário',
    })
    setCreating(false)
    if (res.ok && res.data) {
      router.push(`/${slug}/crm/forms/${res.data.id}`)
    } else {
      notify.error(res.message ?? 'Não foi possível criar o formulário.')
    }
  }

  return (
    <>
      <DataTable
        columns={columns}
        data={items}
        workspaceId={workspaceId}
        slug={slug}
        resource='forms'
        createTitle='formulário'
        lookups={lookups}
        isLoading={isLoading}
        searchPlaceholder='Buscar formulários…'
        refetch={refetch}
        disableInlineCreate
        headerAction={
          <Button size='sm' onClick={onCreate} disabled={creating}>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo formulário
          </Button>
        }
        onOpenRecord={(record) => setStatsForm(record)}
      />
      {statsForm ? (
        <CrmFormStatsPanel
          open
          onOpenChange={(next) => {
            if (!next) setStatsForm(null)
          }}
          workspaceId={workspaceId}
          formId={statsForm.id}
          formName={statsForm.name}
          fields={statsForm.fields}
        />
      ) : null}
    </>
  )
}
