'use client'

import {
  Add01Icon,
  Album02Icon,
  FileEmpty02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCrmProposalTemplates } from '@/src/hooks/use-crm-proposal-template'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmProposalDTO, CrmProposalStatusDTO } from '@/types/crm-proposal'

const LOOKUP_KINDS: LookupKind[] = [
  'companies',
  'people',
  'opportunities',
  'users',
]

const STATUS_OPTIONS: { value: CrmProposalStatusDTO; label: string }[] = [
  { value: 'DRAFT', label: 'Rascunho' },
  { value: 'SENT', label: 'Enviada' },
  { value: 'VIEWED', label: 'Visualizada' },
  { value: 'ACCEPTED', label: 'Aceita' },
  { value: 'REJECTED', label: 'Recusada' },
  { value: 'EXPIRED', label: 'Expirada' },
]

const STATUS_STYLES: Record<CrmProposalStatusDTO, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-500/15 text-blue-600',
  VIEWED: 'bg-violet-500/15 text-violet-600',
  ACCEPTED: 'bg-emerald-500/15 text-emerald-600',
  REJECTED: 'bg-red-500/15 text-red-600',
  EXPIRED: 'bg-amber-500/15 text-amber-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    primary: true,
    linkView: true,
    placeholder: 'Proposta sem título',
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    defaultValue: 'DRAFT',
    options: STATUS_OPTIONS,
    optionStyles: STATUS_STYLES,
  },
  {
    key: 'companyId',
    header: 'Cliente',
    kind: 'relation',
    relationKind: 'companies',
    clearable: true,
  },
  {
    key: 'contactId',
    header: 'Contato',
    kind: 'relation',
    relationKind: 'people',
    clearable: true,
  },
  {
    key: 'opportunityId',
    header: 'Oportunidade',
    kind: 'relation',
    relationKind: 'opportunities',
    clearable: true,
  },
  {
    key: 'responsibleId',
    header: 'Responsável',
    kind: 'relation',
    relationKind: 'users',
  },
  { key: 'validUntil', header: 'Validade', kind: 'date', clearable: true },
  {
    key: 'viewsCount',
    header: 'Visualizações',
    kind: 'number',
    readonly: true,
  },
  { key: 'createdAt', header: 'Data de criação', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmProposalsTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const router = useRouter()
  const { items, isLoading, refetch } = useCrmResourceList<CrmProposalDTO>(
    workspaceId,
    'proposals',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const { templates } = useCrmProposalTemplates(workspaceId)
  const columns = useMemo(() => COLUMNS, [])

  function openNew(templateId?: string) {
    const query = templateId ? `?templateId=${templateId}` : ''
    router.push(`/${slug}/crm/proposals/new${query}`)
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='proposals'
      createTitle='proposta'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar propostas…'
      refetch={refetch}
      disableInlineCreate
      headerAction={
        <div className='flex items-center gap-2'>
          <Button
            variant='outline'
            size='sm'
            render={<Link href={`/${slug}/crm/proposal-templates`} />}
          >
            <SteelIcon icon={Album02Icon} strokeWidth={2} />
            Templates
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              nativeButton={true}
              render={
                <Button size='sm'>
                  <SteelIcon icon={Add01Icon} strokeWidth={2} />
                  Nova proposta
                </Button>
              }
            />
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuItem onClick={() => openNew()}>
                <SteelIcon
                  icon={FileEmpty02Icon}
                  strokeWidth={2}
                  className='size-4 shrink-0'
                />
                Em branco
              </DropdownMenuItem>
              {templates.length ? <DropdownMenuSeparator /> : null}
              {templates.map((template) => (
                <DropdownMenuItem
                  key={template.id}
                  onClick={() => openNew(template.id)}
                >
                  <span className='truncate'>{template.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    />
  )
}
