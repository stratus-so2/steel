'use client'

import { useMemo } from 'react'
import { DataTable } from '@/app/_components/crm/table/data-table'
import type { GridColumn } from '@/app/_components/crm/table/grid'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import {
  type LookupKind,
  useCrmWorkspaceLookups,
} from '@/src/hooks/use-crm-workspace-lookups'
import type { CrmCompanyDTO } from '@/types/crm-company'

const LOOKUP_KINDS: LookupKind[] = ['users']

const COLUMNS: GridColumn[] = [
  {
    key: 'cnpj',
    header: 'CNPJ',
    kind: 'cnpj',
    primary: true,
    placeholder: '00.000.000/0000-00',
  },
  { key: 'name', header: 'Nome', kind: 'text', placeholder: 'Acme Inc' },
  { key: 'domain', header: 'Domínio', kind: 'link', placeholder: 'acme.com' },
  {
    key: 'employees',
    header: 'Funcionários',
    kind: 'number',
    placeholder: '120',
  },
  {
    key: 'linkedin',
    header: 'LinkedIn',
    kind: 'link',
    placeholder: 'linkedin.com/company/acme',
  },
  { key: 'address', header: 'Endereço (CEP)', kind: 'address' },
  { key: 'arr', header: 'ARR', kind: 'money', placeholder: '250000' },
  { key: 'icp', header: 'ICP', kind: 'boolean' },
  {
    key: 'accountOwnerId',
    header: 'Responsável pela conta',
    kind: 'relation',
    relationKind: 'users',
    clearable: true,
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

export function CrmCompaniesTable({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const { items, isLoading, refetch } = useCrmResourceList<CrmCompanyDTO>(
    workspaceId,
    'companies',
  )
  const { lookups } = useCrmWorkspaceLookups(workspaceId, LOOKUP_KINDS)

  const columns = useMemo(() => COLUMNS, [])

  return (
    <DataTable
      columns={columns}
      data={items}
      workspaceId={workspaceId}
      slug={slug}
      resource='companies'
      createTitle='empresa'
      lookups={lookups}
      isLoading={isLoading}
      searchPlaceholder='Buscar empresas…'
      refetch={refetch}
    />
  )
}
