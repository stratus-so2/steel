'use client'

import {
  FileImportIcon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import {
  SD_PERSON_TYPE_LABEL,
  UF_OPTIONS,
} from '@/app/_components/servicedesk/directory/shared/sd-directory-labels'
import { SdActivePill } from '@/app/_components/servicedesk/directory/shared/sd-directory-widgets'
import { SdImportDialog } from '@/app/_components/servicedesk/directory/shared/sd-import-dialog'
import {
  type SdColumn,
  SdDataTable,
  SdFilterField,
  SdFilterSelect,
} from '@/app/_components/servicedesk/table/sd-data-table'
import { useSdTableState } from '@/app/_components/servicedesk/table/use-sd-table-state'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  type SdCustomersQuery,
  useImportSdCustomers,
  useSdCustomers,
} from '@/src/hooks/use-sd-customers'
import { formatDocument, formatPhone } from '@/src/lib/servicedesk/document'
import type { SdCustomerDTO, SdCustomerKindDTO } from '@/types/sd-customer'
import { SdCustomerDetailSheet } from './sd-customer-detail-sheet'
import { SdCustomerFormSheet } from './sd-customer-form-sheet'

const COLUMNS: SdColumn<SdCustomerDTO>[] = [
  {
    id: 'name',
    header: 'Nome',
    sortKey: 'name',
    hideable: false,
    cell: (c) => (
      <div className='flex min-w-48 flex-col'>
        <span className='font-medium'>{c.name}</span>
        {c.tradeName && c.tradeName !== c.name ? (
          <span className='text-muted-foreground text-xs'>{c.tradeName}</span>
        ) : null}
      </div>
    ),
  },
  {
    id: 'document',
    header: 'CPF/CNPJ',
    sortKey: 'document',
    cell: (c) =>
      c.document ? (
        <span className='font-mono text-xs'>{formatDocument(c.document)}</span>
      ) : (
        <span className='text-muted-foreground'>—</span>
      ),
  },
  {
    id: 'personType',
    header: 'Pessoa',
    defaultHidden: true,
    cell: (c) => SD_PERSON_TYPE_LABEL[c.personType],
  },
  {
    id: 'email',
    header: 'E-mail',
    cell: (c) => c.email ?? <span className='text-muted-foreground'>—</span>,
  },
  {
    id: 'whatsapp',
    header: 'WhatsApp',
    cell: (c) =>
      c.whatsapp ? (
        <a
          href={`https://wa.me/${c.whatsapp}`}
          target='_blank'
          rel='noreferrer'
          onClick={(e) => e.stopPropagation()}
          className='whitespace-nowrap font-medium hover:underline'
        >
          {formatPhone(c.whatsapp)}
        </a>
      ) : (
        <span className='text-muted-foreground'>—</span>
      ),
  },
  {
    id: 'phone',
    header: 'Telefone',
    defaultHidden: true,
    cell: (c) => (
      <span className='whitespace-nowrap'>{formatPhone(c.phone) || '—'}</span>
    ),
  },
  {
    id: 'city',
    header: 'Cidade/UF',
    sortKey: 'city',
    cell: (c) =>
      [c.city, c.state].filter(Boolean).join('/') || (
        <span className='text-muted-foreground'>—</span>
      ),
  },
  {
    id: 'contacts',
    header: 'Contatos',
    cell: (c) => <span className='tabular-nums'>{c.contactsCount}</span>,
  },
  {
    id: 'items',
    header: 'CIs',
    defaultHidden: true,
    cell: (c) => <span className='tabular-nums'>{c.configItemsCount}</span>,
  },
  {
    id: 'active',
    header: 'Situação',
    cell: (c) => <SdActivePill active={c.active} />,
  },
  {
    id: 'createdAt',
    header: 'Criado em',
    sortKey: 'createdAt',
    defaultHidden: true,
    cell: (c) => new Date(c.createdAt).toLocaleDateString('pt-BR'),
  },
]

/** Tela de Clientes (`kind = CLIENT`) ou Empresas (`kind = COMPANY`). */
export function SdCustomersView({
  workspaceId,
  slug,
  kind,
}: {
  workspaceId: string
  slug: string
  kind: SdCustomerKindDTO
}) {
  const table = useSdTableState({
    sort: 'name',
    filters: { active: '' as '' | 'true' | 'false', state: '', city: '' },
  })
  const query: SdCustomersQuery = {
    kind,
    q: table.q,
    page: table.page,
    pageSize: table.pageSize,
    sort: table.sort as SdCustomersQuery['sort'],
    order: table.order,
    active: table.filters.active ? table.filters.active === 'true' : undefined,
    state: table.filters.state || undefined,
    city: table.filters.city.trim() || undefined,
  }
  const { data, isLoading, error } = useSdCustomers(workspaceId, query)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const importRows = useImportSdCustomers(workspaceId)
  const [form, setForm] = useState<{
    open: boolean
    customer: SdCustomerDTO | null
  }>({ open: false, customer: null })

  const noun = kind === 'COMPANY' ? 'empresa' : 'cliente'
  const createButton = (
    <Button size='sm' onClick={() => setForm({ open: true, customer: null })}>
      <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
      {kind === 'COMPANY' ? 'Nova empresa' : 'Novo cliente'}
    </Button>
  )

  return (
    <>
      <SdDataTable
        storageKey={`customers-${kind}`}
        columns={COLUMNS}
        rows={data?.items ?? []}
        total={data?.total ?? 0}
        page={table.page}
        pageSize={table.pageSize}
        onPageChange={table.setPage}
        onPageSizeChange={table.setPageSize}
        sort={table.sort}
        order={table.order}
        onSortChange={table.setSort}
        search={table.search}
        onSearchChange={table.setSearch}
        searchPlaceholder='Nome, fantasia, CPF/CNPJ, e-mail, cidade…'
        isLoading={isLoading}
        error={error ? error.message : null}
        onRowClick={(row) => setDetailId(row.id)}
        activeFilterCount={table.activeFilterCount}
        onClearFilters={table.clearFilters}
        filters={
          <>
            <SdFilterField label='Situação'>
              <SdFilterSelect
                value={table.filters.active}
                onChange={(v) => table.setFilter('active', v)}
                options={[
                  { value: 'true', label: 'Ativos' },
                  { value: 'false', label: 'Inativos' },
                ]}
              />
            </SdFilterField>
            <SdFilterField label='UF'>
              <SdFilterSelect
                value={table.filters.state}
                onChange={(v) => table.setFilter('state', v)}
                options={UF_OPTIONS.map((uf) => ({ value: uf, label: uf }))}
                allLabel='Todas'
              />
            </SdFilterField>
            <SdFilterField label='Cidade'>
              <Input
                value={table.filters.city}
                onChange={(e) => table.setFilter('city', e.target.value)}
                placeholder='Ex.: Campinas'
                className='h-8'
              />
            </SdFilterField>
          </>
        }
        actions={
          <>
            <Button
              size='sm'
              variant='outline'
              onClick={() => setImporting(true)}
            >
              <SteelIcon icon={FileImportIcon} strokeWidth={2} />
              Importar
            </Button>
            {createButton}
          </>
        }
        emptyTitle={`Nenhum ${noun} encontrado`}
        emptyDescription={`Cadastre ${noun === 'empresa' ? 'a primeira empresa' : 'o primeiro cliente'} ou ajuste a busca e os filtros.`}
        emptyAction={createButton}
      />

      <SdImportDialog
        open={importing}
        onOpenChange={setImporting}
        title={kind === 'COMPANY' ? 'Importar empresas' : 'Importar clientes'}
        columnsHelp='Colunas reconhecidas: nome (ou razão social), fantasia, cpf/cnpj, email, telefone, whatsapp, cep, logradouro, número, complemento, bairro, cidade, uf e observações.'
        onImport={(rows) => importRows.mutateAsync({ kind, rows })}
      />

      <SdCustomerDetailSheet
        workspaceId={workspaceId}
        slug={slug}
        customerId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        onEdit={(customer) => setForm({ open: true, customer })}
      />

      <SdCustomerFormSheet
        workspaceId={workspaceId}
        kind={kind}
        open={form.open}
        customer={form.customer}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(saved) => {
          if (!form.customer) setDetailId(saved.id)
        }}
      />
    </>
  )
}
