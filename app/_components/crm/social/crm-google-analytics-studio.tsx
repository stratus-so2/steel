'use client'

import {
  EyeIcon,
  GoogleIcon,
  Pulse01Icon,
  UserMultipleIcon,
  WebDesign01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { ResponsiveLine } from '@nivo/line'
import { useState } from 'react'
import {
  CHART_THEME,
  formatAxisLabel,
  getFortnightKey,
  toNivoSeries,
} from '@/app/_components/crm/social/chart-utils'
import { SteelIcon } from '@/components/icon/icon'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  useCrmGoogleAnalyticsInsights,
  useCrmGoogleAnalyticsOverview,
} from '@/src/hooks/use-crm-social-google-analytics'
import type { CrmSocialGoogleAnalyticsInsightsRange } from '@/src/schemas/crm-social-google-analytics.schema'

const nf = new Intl.NumberFormat('pt-BR')

const RANGES: {
  value: CrmSocialGoogleAnalyticsInsightsRange
  label: string
}[] = [
  { value: '7d', label: '7 dias' },
  { value: '28d', label: '28 dias' },
  { value: '90d', label: '90 dias' },
]

const RECONNECT_CODES = new Set([
  'CRM_SOCIAL_CONNECTION_NOT_FOUND',
  'CRM_SOCIAL_SCOPE_MISSING',
  'CRM_SOCIAL_TOKEN_EXPIRED',
  'CRM_SOCIAL_NOT_CONFIGURED',
])

function StatCard({
  icon,
  label,
  value,
}: {
  icon: typeof EyeIcon
  label: string
  value: number
}) {
  return (
    <Card size='sm' className='gap-1 px-4 py-3'>
      <div className='flex items-center gap-1.5 text-muted-foreground text-xs'>
        <SteelIcon icon={icon} size={14} />
        {label}
      </div>
      <span className='font-heading font-semibold text-2xl tabular-nums tracking-tight'>
        {nf.format(value)}
      </span>
    </Card>
  )
}

function ReconnectNotice({
  workspaceId,
  message,
}: {
  workspaceId: string
  message: string
}) {
  return (
    <div className='mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center'>
      <div className='flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card/70 text-muted-foreground'>
        <SteelIcon icon={GoogleIcon} size={24} />
      </div>
      <div className='space-y-1.5'>
        <h2 className='font-heading font-semibold text-xl tracking-tight'>
          Conecte o Google Analytics
        </h2>
        <p className='text-muted-foreground text-sm'>{message}</p>
      </div>
      <a
        href={`/api/workspaces/${workspaceId}/crm/social/google_analytics/connect`}
        className={buttonVariants()}
      >
        Conectar Google Analytics
      </a>
    </div>
  )
}

export function CrmGoogleAnalyticsStudio({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [range, setRange] =
    useState<CrmSocialGoogleAnalyticsInsightsRange>('28d')

  const overviewQuery = useCrmGoogleAnalyticsOverview(workspaceId)
  const insightsQuery = useCrmGoogleAnalyticsInsights(workspaceId, range)

  const overview = overviewQuery.data
  const insights = insightsQuery.data

  const overviewErrorCode = (overviewQuery.error as { code?: string } | null)
    ?.code
  const insightsErrorCode = (insightsQuery.error as { code?: string } | null)
    ?.code

  if (overviewQuery.isLoading && !overview) {
    return (
      <div className='mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6'>
        <Skeleton className='h-20 w-full' />
        <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
          <Skeleton className='h-20' />
          <Skeleton className='h-20' />
          <Skeleton className='h-20' />
          <Skeleton className='h-20' />
        </div>
        <Skeleton className='h-72 w-full' />
      </div>
    )
  }

  if (
    !overview &&
    overviewQuery.error &&
    RECONNECT_CODES.has(overviewErrorCode ?? '')
  ) {
    return (
      <div className='px-4 py-6 sm:px-6'>
        <ReconnectNotice
          workspaceId={workspaceId}
          message={overviewQuery.error.message}
        />
      </div>
    )
  }

  if (!overview) {
    return (
      <div className='px-4 py-6 text-center text-muted-foreground text-sm sm:px-6'>
        {overviewQuery.error?.message ??
          'Não foi possível carregar a propriedade.'}
        <div className='mt-3'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => overviewQuery.refetch()}
          >
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const insightsNeedsReconnect =
    !insights &&
    insightsQuery.error &&
    RECONNECT_CODES.has(insightsErrorCode ?? '')

  return (
    <div className='mx-auto w-full max-w-5xl px-4 py-6 sm:px-6'>
      <header className='mb-6 flex items-center gap-4'>
        <div className='flex size-16 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400'>
          <SteelIcon icon={GoogleIcon} size={28} />
        </div>
        <div className='min-w-0'>
          <h2 className='truncate font-heading font-semibold text-xl tracking-tight'>
            {overview.propertyName}
          </h2>
          {overview.accountName ? (
            <p className='truncate text-muted-foreground text-sm'>
              {overview.accountName}
            </p>
          ) : null}
        </div>
      </header>

      <Tabs defaultValue='overview'>
        <div className='mb-6 border-b border-border/60'>
          <TabsList variant='line' className='w-full justify-start'>
            <TabsTrigger value='overview'>Visão Geral</TabsTrigger>
            <TabsTrigger value='analytics'>Analytics</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value='overview' className='space-y-4'>
          <div className='grid grid-cols-2 gap-3 sm:grid-cols-4'>
            <StatCard
              icon={UserMultipleIcon}
              label='Usuários ativos (28d)'
              value={overview.totals.activeUsers}
            />
            <StatCard
              icon={Pulse01Icon}
              label='Sessões (28d)'
              value={overview.totals.sessions}
            />
            <StatCard
              icon={WebDesign01Icon}
              label='Páginas vistas (28d)'
              value={overview.totals.screenPageViews}
            />
            <StatCard
              icon={EyeIcon}
              label='Eventos (28d)'
              value={overview.totals.eventCount}
            />
          </div>
        </TabsContent>

        <TabsContent value='analytics' className='space-y-4'>
          <div className='flex items-center justify-between gap-3'>
            <h3 className='font-heading font-semibold text-lg tracking-tight'>
              Análises
            </h3>
            <Tabs
              value={range}
              onValueChange={(v) =>
                setRange(v as CrmSocialGoogleAnalyticsInsightsRange)
              }
            >
              <TabsList>
                {RANGES.map((r) => (
                  <TabsTrigger key={r.value} value={r.value}>
                    {r.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {insightsNeedsReconnect ? (
            <Card className='px-4 py-6 text-center text-muted-foreground text-sm'>
              {insightsQuery.error?.message}
            </Card>
          ) : insights ? (
            <>
              <div className='grid grid-cols-1 gap-3 sm:grid-cols-4'>
                <StatCard
                  icon={UserMultipleIcon}
                  label='Usuários ativos'
                  value={insights.totals.activeUsers}
                />
                <StatCard
                  icon={Pulse01Icon}
                  label='Sessões'
                  value={insights.totals.sessions}
                />
                <StatCard
                  icon={WebDesign01Icon}
                  label='Páginas vistas'
                  value={insights.totals.screenPageViews}
                />
                <StatCard
                  icon={EyeIcon}
                  label='Eventos'
                  value={insights.totals.eventCount}
                />
              </div>
              <Card className='h-72 p-2 text-muted-foreground'>
                {insights.series.length > 0 ? (
                  (() => {
                    const gk = range === '90d' ? getFortnightKey : null
                    const s1 = toNivoSeries(
                      insights.series,
                      (p) => p.activeUsers,
                      gk,
                    )
                    const ticks: string[] | number = gk ? s1.map((d) => d.x) : 7
                    return (
                      <ResponsiveLine
                        data={[{ id: 'Usuários ativos', data: s1 }]}
                        margin={{ top: 36, right: 20, bottom: 48, left: 52 }}
                        colors={['#f97316']}
                        curve='monotoneX'
                        enableArea
                        areaOpacity={0.12}
                        pointSize={range === '7d' ? 5 : range === '28d' ? 3 : 0}
                        pointColor={{ from: 'color' }}
                        useMesh
                        xScale={{ type: 'point' }}
                        yScale={{ type: 'linear', min: 0, max: 'auto' }}
                        axisBottom={{
                          tickSize: 0,
                          tickPadding: 8,
                          tickRotation: -45,
                          tickValues: ticks,
                          format: formatAxisLabel,
                        }}
                        axisLeft={{ tickSize: 0, tickPadding: 8 }}
                        theme={CHART_THEME}
                      />
                    )
                  })()
                ) : (
                  <div className='flex h-full items-center justify-center text-sm'>
                    Sem dados no período.
                  </div>
                )}
              </Card>
            </>
          ) : (
            <Skeleton className='h-72 w-full' />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
