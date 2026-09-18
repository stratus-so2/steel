import { AdminPage } from '@/app/_components/admin/shell/admin-page'
import { TableSkeleton } from '@/app/_components/admin/shell/admin-ui'

export default function AdminLoading() {
  return (
    <AdminPage>
      <div className='space-y-2'>
        <div className='h-3 w-24 animate-pulse rounded bg-muted' />
        <div className='h-6 w-48 animate-pulse rounded bg-muted' />
      </div>
      <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6'>
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className='h-21 animate-pulse rounded-lg border border-border bg-muted/40'
          />
        ))}
      </div>
      <div className='rounded-lg border border-border'>
        <TableSkeleton rows={6} />
      </div>
    </AdminPage>
  )
}
