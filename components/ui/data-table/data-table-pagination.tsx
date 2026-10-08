'use client'

import { Muted } from '@/components/typography/text/muted'
import { Button } from '@/components/ui/button'

export interface DataTableItemLabel {
  one: string
  other: string
}

interface DataTablePaginationProps {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  itemLabel?: DataTableItemLabel
}

export function DataTablePagination({
  page,
  pageSize,
  total,
  onPageChange,
  itemLabel = { one: 'registro', other: 'registros' },
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const noun = total === 1 ? itemLabel.one : itemLabel.other

  return (
    <div className='flex flex-wrap items-center justify-between gap-2'>
      <Muted>
        {total === 0
          ? `Nenhum ${itemLabel.one}`
          : `Página ${page} de ${pageCount} · ${total} ${noun}`}
      </Muted>
      <div className='flex items-center gap-2'>
        <Button
          variant='outline'
          size='sm'
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <Button
          variant='outline'
          size='sm'
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  )
}
