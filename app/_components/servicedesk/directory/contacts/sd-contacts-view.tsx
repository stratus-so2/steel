'use client'

import { PlusSignIcon, StarIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SdPill } from '@/app/_components/servicedesk/directory/shared/sd-directory-widgets'
import { SdCustomerPicker } from '@/app/_components/servicedesk/pickers'
import {
  type SdColumn,
  SdDataTable,
  SdFilterField,
  SdFilterSelect,
} from '@/app/_components/servicedesk/table/sd-data-table'
import { useSdTableState } from '@/app/_components/servicedesk/table/use-sd-table-state'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  type SdContactsQuery,
  useSdContacts,
} from '@/src/hooks/use-sd-contacts'
import { formatPhone } from '@/src/lib/servicedesk/document'
import type { SdContactDTO } from '@/types/sd-contact'
import { SdContactDetailSheet } from './sd-contact-detail-sheet'
import { SdContactFormSheet } from './sd-contact-form-sheet'

const COLUMNS: SdColumn<SdContactDTO>[] = [
  {
    id: 'name',
    header: 'Nome',
    sortKey: 'name',
    hideable: false,
    cell: (c) => <span className='font-medium'>{c.name}</span>,
  },
  {
    id: 'jobTitle',
    header: 'Cargo',
    sortKey: 'jobTitle',
    cell: (c) => c.jobTitle ?? <span className='text-muted-foreground'>—</span>,
  },
  {
    id: 'customers',
    header: 'Clientes/empresas',
    cell: (c) =>
      c.customers.length === 0 ? (
        <span className='text-muted-foreground'>—</span>
      ) : (
        <span className='flex flex-wrap items-center gap-1'>
          {c.customers.slice(0, 2).map((cu) => (
            <SdPill key={cu.id} className='bg-muted text-foreground'>
              {cu.isPrimary ? (
                <SteelIcon
                  icon={StarIcon}
                  strokeWidth={2}
                  className='size-3 fill-amber-400 text-amber-500'
                />
              ) : null}
              {cu.name}
            </SdPill>
          ))}
          {c.customers.length > 2 ? (
            <span className='text-muted-foreground text-xs'>
              +{c.customers.length - 2}
            </span>
          ) : null}
        </span>
      ),
  },
  {
    id: 'email',
    header: 'E-mail',
    sortKey: 'email',
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
          className='whitespace-nowrap text-emerald-600 hover:underline'
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
    id: 'user',
    header: 'Usuário',
    defaultHidden: true,
    cell: (c) =>
      c.user?.name ?? <span className='text-muted-foreground'>—</span>,
  },
  {
    id: 'active',
    header: 'Situação',
    cell: (c) =>
      c.active ? (
        <SdPill className='bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'>
          Ativo
        </SdPill>
      ) : (
        <SdPill className='bg-zinc-500/10 text-zinc-500'>Inativo</SdPill>
      ),
  },
]

export function SdContactsView({
  workspaceId,
  slug,
}: {
  workspaceId: string
  slug: string
}) {
  const table = useSdTableState({
    sort: 'name',
    filters: {
      active: '' as '' | 'true' | 'false',
      customerId: '',
      customerLabel: '',
    },
  })
  const query: SdContactsQuery = {
    q: table.q,
    page: table.page,
    pageSize: table.pageSize,
    sort: table.sort as SdContactsQuery['sort'],
    order: table.order,
    active: table.filters.active ? table.filters.active === 'true' : undefined,
    customerId: table.filters.customerId || undefined,
  }
  const { data, isLoading, error } = useSdContacts(workspaceId, query)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [form, setForm] = useState<{
    open: boolean
    contact: SdContactDTO | null
  }>({ open: false, contact: null })

  const createButton = (
    <Button size='sm' onClick={() => setForm({ open: true, contact: null })}>
      <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
      Novo contato
    </Button>
  )

  return (
    <>
      <SdDataTable
        storageKey='contacts'
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
        searchPlaceholder='Nome, cargo, e-mail, telefone…'
        isLoading={isLoading}
        error={error ? error.message : null}
        onRowClick={(row) => setDetailId(row.id)}
        activeFilterCount={
          table.activeFilterCount - (table.filters.customerLabel ? 1 : 0)
        }
        onClearFilters={table.clearFilters}
        filters={
          <>
            <SdFilterField label='Cliente ou empresa'>
              <SdCustomerPicker
                workspaceId={workspaceId}
                value={table.filters.customerId || null}
                selectedLabel={table.filters.customerLabel || null}
                allowCreate={false}
                placeholder='Todos'
                onChange={(option) => {
                  table.setFilter('customerId', option?.id ?? '')
                  table.setFilter('customerLabel', option?.label ?? '')
                }}
              />
            </SdFilterField>
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
          </>
        }
        actions={createButton}
        emptyTitle='Nenhum contato encontrado'
        emptyDescription='Cadastre o primeiro contato ou ajuste a busca e os filtros.'
        emptyAction={createButton}
      />

      <SdContactDetailSheet
        workspaceId={workspaceId}
        slug={slug}
        contactId={detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null)
        }}
        onEdit={(contact) => setForm({ open: true, contact })}
      />

      <SdContactFormSheet
        workspaceId={workspaceId}
        open={form.open}
        contact={form.contact}
        onOpenChange={(open) => setForm((f) => ({ ...f, open }))}
        onSaved={(saved) => {
          if (!form.contact) setDetailId(saved.id)
        }}
      />
    </>
  )
}
