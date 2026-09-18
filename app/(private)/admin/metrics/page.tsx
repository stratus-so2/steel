import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AdminMetricsDashboard } from '@/app/_components/admin/metrics/admin-metrics-dashboard'
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
    <div className='w-full space-y-4 overflow-y-auto p-6'>
      <div>
        <h1 className='font-semibold text-lg'>Métricas</h1>
        <p className='text-muted-foreground text-sm'>
          Visão geral da plataforma
        </p>
      </div>
      {result.ok ? (
        <AdminMetricsDashboard
          metrics={result.value}
          days={recentUsageDays(
            new Date(result.value.generatedAt),
            result.value.windowDays,
          )}
        />
      ) : (
        <p className='text-muted-foreground text-sm'>
          Não foi possível carregar as métricas.
        </p>
      )}
    </div>
  )
}
