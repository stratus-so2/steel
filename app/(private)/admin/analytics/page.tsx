import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/app/_components/admin/analytics/analytics-dashboard'
import { AnalyticsFilters } from '@/app/_components/admin/analytics/analytics-filters'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { ErrorState } from '@/app/_components/admin/shell/admin-ui'
import { getAuthSession } from '@/src/lib/auth-session'
import { AnalyticsQuerySchema } from '@/src/schemas/admin-analytics.schema'
import { AdminAnalyticsService } from '@/src/services/admin-analytics.service'
import { AdminWorkspaceService } from '@/src/services/admin-workspace.service'

// Página de sessão (admin): bloqueia de propósito; `loading.tsx` cobre.
export const instant = false

export const metadata: Metadata = {
  title: 'Analytics | Admin | Steel',
  description: 'Tráfego, rotas, erros, acessos e filas a partir dos logs',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const raw = Object.fromEntries(
    Object.entries(await searchParams).map(([k, v]) => [
      k,
      Array.isArray(v) ? v[0] : v,
    ]),
  )
  // Filtro inválido na URL (link antigo/editado): cai nos padrões.
  const parsed = AnalyticsQuerySchema.safeParse(raw)
  const query = parsed.success
    ? parsed.data.view === 'route' && !parsed.data.route
      ? { ...parsed.data, view: 'routes' as const }
      : parsed.data
    : AnalyticsQuerySchema.parse({})

  const [result, workspaces] = await Promise.all([
    AdminAnalyticsService.get(session.value.user.id, query),
    AdminWorkspaceService.listWorkspaces(session.value.user.id),
  ])

  return (
    <AdminPage>
      <AdminPageHeader
        title='Analytics'
        crumbs={[{ label: 'Analytics' }]}
        description='Requisições, rotas, erros e acessos a partir dos logs no Axiom; filas BullMQ ao vivo.'
      />
      <AnalyticsFilters
        query={query}
        workspaces={
          workspaces.ok
            ? workspaces.value.map(({ id, name, slug }) => ({ id, name, slug }))
            : []
        }
      />
      {result.ok ? (
        <AnalyticsDashboard result={result.value} />
      ) : (
        <ErrorState
          message={`Não foi possível carregar o Analytics: ${result.error.message}`}
        />
      )}
    </AdminPage>
  )
}
