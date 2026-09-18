import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminOverview } from '@/app/_components/admin/overview/admin-overview'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import {
  ErrorState,
  formatDateTime,
} from '@/app/_components/admin/shell/admin-ui'
import { RefreshButton } from '@/app/_components/admin/shell/refresh-button'
import { getAuthSession } from '@/src/lib/auth-session'
import { AdminOverviewService } from '@/src/services/admin-overview.service'

export const metadata: Metadata = {
  title: 'Visão geral | Admin | Steel',
  description: 'Saúde e números gerais da plataforma',
}

export default async function AdminOverviewPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminOverviewService.get(session.value.user.id)

  return (
    <AdminPage>
      <AdminPageHeader
        title='Visão geral'
        description={
          result.ok
            ? `Plataforma inteira · atualizado ${formatDateTime(result.value.generatedAt)}`
            : 'Plataforma inteira'
        }
        actions={<RefreshButton />}
      />
      {result.ok ? (
        <AdminOverview data={result.value} />
      ) : (
        <ErrorState message='Não foi possível carregar a visão geral.' />
      )}
    </AdminPage>
  )
}
