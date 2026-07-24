'use client'

import * as React from 'react'
import {
  formatValue,
  passesFilters,
  type Row,
  sortRows,
} from '@/app/_components/crm/dashboard/widget-data'
import {
  sourceResource,
  VIEW_SOURCE_FIELDS,
} from '@/app/_components/crm/dashboard/widget-meta'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCrmResourceList } from '@/src/hooks/use-crm-resource-list'
import type { ViewConfig } from '@/src/schemas/crm-dashboard.schema'

export function ViewWidget({
  workspaceId,
  config,
}: {
  workspaceId: string
  config: ViewConfig
}) {
  const { items, isLoading } = useCrmResourceList<Row>(
    workspaceId,
    sourceResource(config.source),
  )

  const fields = React.useMemo(() => {
    const all = VIEW_SOURCE_FIELDS[config.source] ?? []
    if (config.fields.length === 0) return all
    return all.filter((field) => config.fields.includes(field.key))
  }, [config.source, config.fields])

  const rows = React.useMemo(() => {
    const filtered = items.filter((row) => passesFilters(row, config.filters))
    return sortRows(filtered, config)
  }, [items, config])

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Carregando…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className='flex h-full items-center justify-center text-muted-foreground text-sm'>
        Nenhum registro.
      </div>
    )
  }

  return (
    <div className='h-full overflow-auto'>
      <Table>
        <TableHeader>
          <TableRow>
            {fields.map((field) => (
              <TableHead key={field.key} className='whitespace-nowrap'>
                {field.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={String(row.id)}>
              {fields.map((field) => (
                <TableCell key={field.key} className='whitespace-nowrap'>
                  {formatValue(row[field.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
