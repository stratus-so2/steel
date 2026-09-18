'use client'

import { useEffect } from 'react'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { ErrorState } from '@/app/_components/admin/shell/admin-ui'
import { Button } from '@/components/ui/button'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <AdminPage>
      <AdminPageHeader title='Algo deu errado' />
      <ErrorState
        message={`Esta página do admin falhou ao carregar${error.digest ? ` (ref. ${error.digest})` : ''}.`}
        action={
          <Button size='sm' variant='outline' onClick={reset}>
            Tentar de novo
          </Button>
        }
      />
    </AdminPage>
  )
}
