'use client'

import { Add01Icon, FileEmpty02Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { notify } from '@/lib/notify'
import { useCrmDocumentTemplates } from '@/src/hooks/use-crm-document-template'
import {
  createCrmResource,
  useCrmResourceList,
} from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmDocumentTypeDTO, CrmProposalDTO } from '@/types/crm-proposal'

const LOOKUP_KINDS: LookupKind[] = ['users']

const DOCUMENT_TYPES: CrmDocumentTypeDTO[] = [
  'PROPOSAL',
  'PREMISES',
  'PORTFOLIO',
  'CONTRACT',
]

const TYPE_LABEL: Record<CrmDocumentTypeDTO, string> = {
  PROPOSAL: 'Proposta',
  PREMISES: 'Escopo',
  PORTFOLIO: 'Portfólio',
  CONTRACT: 'Contrato',
}

const TYPE_STYLES: Record<CrmDocumentTypeDTO, string> = {
  PREMISES: 'bg-amber-500/15 text-amber-600',
  PORTFOLIO: 'bg-violet-500/15 text-violet-600',
  PROPOSAL: 'bg-teal-500/15 text-teal-600',
  CONTRACT: 'bg-blue-500/15 text-blue-600',
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-600',
}

const COLUMNS: GridColumn[] = [
  {
    key: 'title',
    header: 'Título',
    kind: 'text',
    primary: true,
    linkView: true,
    placeholder: 'Documento sem título',
  },
  {
    key: 'type',
    header: 'Tipo',
    kind: 'select',
    defaultValue: 'PROPOSAL',
    options: DOCUMENT_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })),
    optionStyles: TYPE_STYLES,
  },
  {
    key: 'status',
    header: 'Status',
    kind: 'select',
    defaultValue: 'DRAFT',
    options: [
      { value: 'DRAFT', label: 'Offline' },
      { value: 'PUBLISHED', label: 'Online' },
    ],
    optionStyles: STATUS_STYLES,
  },
  {
    key: 'viewsCount',
    header: 'Visualizações',
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
  const { templates } = useCrmDocumentTemplates(workspaceId)
  const columns = useMemo(() => COLUMNS, [])
  const [creating, setCreating] = useState(false)

  /** Cria o documento (em branco ou a partir de um template) e abre o editor. */
  async function onCreate(type: CrmDocumentTypeDTO, templateId?: string) {
    if (creating) return
    setCreating(true)
    const res = await createCrmResource<CrmProposalDTO>(
      workspaceId,
      'proposals',
      {
        type,
        ...(templateId ? { templateId } : {}),
      },
    )
    setCreating(false)
    if (res.ok && res.data) {
      router.push(`/${slug}/crm/proposals/${res.data.id}`)
    } else {
      notify.error(res.message ?? 'Não foi possível criar o documento.')
    }
  }

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='proposals'
      createTitle='documento'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar documentos…'
      refetch={refetch}
      disableInlineCreate
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger
            nativeButton={true}
            render={
              <Button size='sm' disabled={creating}>
                <SteelIcon icon={Add01Icon} strokeWidth={2} />
                Novo documento
              </Button>
            }
          />
          <DropdownMenuContent align='end' className='w-52'>
            {DOCUMENT_TYPES.map((type) => {
              const ofType = templates.filter((t) => t.type === type)
              return (
                <DropdownMenuSub key={type}>
                  <DropdownMenuSubTrigger>
                    {TYPE_LABEL[type]}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className='w-52'>
                    <DropdownMenuItem onClick={() => onCreate(type)}>
                      <SteelIcon
                        icon={FileEmpty02Icon}
                        strokeWidth={2}
                        className='size-4 shrink-0'
                      />
                      Em branco
                    </DropdownMenuItem>
                    {ofType.length ? <DropdownMenuSeparator /> : null}
                    {ofType.map((t) => (
                      <DropdownMenuItem
                        key={t.id}
                        onClick={() => onCreate(type, t.id)}
                      >
                        <span className='truncate'>{t.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )
}
