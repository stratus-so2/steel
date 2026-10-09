'use client'

import { LayoutTopIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmEmailTemplateDTO } from '@/types/crm-email-marketing'

const LOOKUP_KINDS: LookupKind[] = ['users']

const COLUMNS: GridColumn[] = [
  {
    key: 'name',
    header: 'Nome',
    kind: 'text',
    required: true,
    primary: true,
    placeholder: 'Boas-vindas',
  },
  {
    key: 'subject',
    header: 'Assunto',
    kind: 'text',
    required: true,
    placeholder: 'Seja bem-vindo ao nosso CRM',
  },
  {
    key: 'kind',
    header: 'Tipo',
    kind: 'select',
    readonly: true,
    options: [
      { value: 'BUILDER', label: 'Editor visual' },
      { value: 'LEGACY', label: 'HTML livre' },
    ],
  },
  {
    key: 'contentHtml',
    header: 'Conteúdo',
    kind: 'emailhtml',
    required: true,
    placeholder: 'Escrever email…',
  },
  {
    key: 'createdById',
    header: 'Criado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  {
    key: 'updatedById',
    header: 'Atualizado por',
    kind: 'relation',
    relationKind: 'users',
    readonly: true,
  },
  { key: 'createdAt', header: 'Criado em', kind: 'readonly-date' },
  { key: 'updatedAt', header: 'Última atualização', kind: 'readonly-date' },
]

export function CrmEmailTemplatesTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmEmailTemplateDTO>(
    workspaceId,
    'email-templates',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)
  const columns = useMemo(() => COLUMNS, [])
  const router = useRouter()

  return (
    <div className='flex h-full min-h-0 flex-col gap-2'>
      <div className='flex shrink-0 justify-end'>
        <Button
          size='sm'
          variant='outline'
          nativeButton={false}
          render={<Link href={`/${slug}/crm/email-templates/new`} />}
        >
          <SteelIcon icon={LayoutTopIcon} strokeWidth={2} />
          Galeria de modelos
        </Button>
      </div>
      <div className='min-h-0 flex-1'>
        <DataTable
          columns={columns}
          data={items}
          workspaceId={workspaceId}
          slug={slug}
          resource='email-templates'
          createTitle='template'
          lookups={lookups}
          isLoading={isLoading}
          searchPlaceholder='Buscar templates…'
          refetch={refetch}
          // Visual-builder templates open the editor; free HTML keeps the
          // default record panel.
          onOpenRecord={(record) => {
            if (record.kind !== 'BUILDER') return false
            router.push(`/${slug}/crm/email-templates/${record.id}`)
          }}
        />
      </div>
    </div>
  )
}
