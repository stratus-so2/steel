import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminMetricsDashboard } from '@/app/_components/admin/metrics/admin-metrics-dashboard'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { ErrorState } from '@/app/_components/admin/shell/admin-ui'
import { getAuthSession } from '@/src/lib/auth-session'
import { recentUsageDays } from '@/src/lib/usage/module-usage'
import { AdminMetricsService } from '@/src/services/admin-metrics.service'

export const metadata: Metadata = {
  title: 'Métricas | Admin | Steel',
  description: 'Clientes ativos, MRR, cancelamentos e uso por módulo',
}

export default async function AdminMetricsPage() {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const result = await AdminMetricsService.getOverview(session.value.user.id)

  return (
    <AdminPage>
      <AdminPageHeader
        title='Métricas'
        crumbs={[{ label: 'Métricas' }]}
        description='Clientes ativos, MRR, cancelamentos e uso por módulo'
      />
      {result.ok ? (
        <AdminMetricsDashboard
          metrics={result.value}
          days={recentUsageDays(
            new Date(result.value.generatedAt),
            result.value.windowDays,
          )}
        />
      ) : (
        <ErrorState message='Não foi possível carregar as métricas.' />
      )}
    </AdminPage>
  )
}
