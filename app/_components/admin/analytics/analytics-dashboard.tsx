'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type {
  AnalyticsAccessDTO,
  AnalyticsErrorsDTO,
  AnalyticsJobsDTO,
  AnalyticsMeta,
  AnalyticsOverviewDTO,
  AnalyticsResultDTO,
  AnalyticsRouteDetailDTO,
  AnalyticsRoutesDTO,
  ErrorSample,
  RouteStat,
  TrafficPoint,
} from '@/src/schemas/admin-analytics.schema'
import {
  AdminPanel,
  DENSE_TABLE,
  EmptyState,
  formatDateTime,
  formatNumber,
  formatRelative,
  StatTile,
  StatusPill,
} from '../shell/admin-ui'
import {
  BarList,
  COLOR,
  formatMs,
  formatPercent,
  Legend,
  PanelBody,
  TimeSeriesChart,
} from './analytics-charts'
import { analyticsHref } from './analytics-filters'

const SOURCE_LABEL: Record<AnalyticsMeta['source'], string> = {
  axiom: 'Axiom',
  fixtures: 'dados simulados',
  unconfigured: 'não configurado',
}

function MetaLine({ meta }: { meta: AnalyticsMeta }) {
  return (
    <p className='flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-xs'>
      <span>
        {formatDateTime(meta.from)} → {formatDateTime(meta.to)} · baldes de{' '}
        <span className='font-mono'>{meta.bin}</span>
      </span>
      <span>
        Fonte: {SOURCE_LABEL[meta.source]}
        {meta.cached ? ' · em cache (até 45 s)' : ''}
      </span>
      {meta.source === 'fixtures' && (
        <StatusPill tone='warn'>Simulado · ANALYTICS_FIXTURES</StatusPill>
      )}
    </p>
  )
}

function statusTone(status: number) {
  if (status >= 500) return 'bad' as const
  if (status >= 400) return 'warn' as const
  if (status >= 300) return 'info' as const
  return 'ok' as const
}

function StatusCode({ status }: { status: number }) {
  return <StatusPill tone={statusTone(status)}>{status}</StatusPill>
}

function RouteLink({ route, method }: { route: string; method?: string }) {
  const searchParams = useSearchParams()
  return (
    <Link
      href={analyticsHref(searchParams, { view: 'route', route })}
      className='inline-flex min-w-0 max-w-full items-center gap-1.5 hover:underline'
      title={route}
    >
      {method && (
        <span className='shrink-0 font-mono text-[10px] text-muted-foreground'>
          {method}
        </span>
      )}
      <span className='truncate font-mono'>{route}</span>
    </Link>
  )
}

const trafficSeries = [
  { id: 'Req/min', color: COLOR.requests, value: (p: TrafficPoint) => p.rpm },
]
const errorSeries = [
  {
    id: '4xx',
    color: COLOR.e4,
    value: (p: { errors4xx: number }) => p.errors4xx,
  },
  {
    id: '5xx',
    color: COLOR.e5,
    value: (p: { errors5xx: number }) => p.errors5xx,
    dashed: true,
  },
]
const latencySeries = [
  { id: 'p50', color: COLOR.p50, value: (p: TrafficPoint) => p.p50 },
  { id: 'p95', color: COLOR.p95, value: (p: TrafficPoint) => p.p95 },
  {
    id: 'p99',
    color: COLOR.p99,
    value: (p: TrafficPoint) => p.p99,
    dashed: true,
  },
]

function TrafficCharts({
  panel,
  meta,
}: {
  panel: AnalyticsOverviewDTO['series']
  meta: AnalyticsMeta
}) {
  return (
    <div className='grid gap-4 xl:grid-cols-2'>
      <AdminPanel title='Requisições por minuto' className='xl:col-span-2'>
        <PanelBody panel={panel}>
          {(points) => (
            <TimeSeriesChart
              points={points}
              series={trafficSeries}
              range={meta.range}
              format={(v) => formatNumber(Math.round(v * 10) / 10)}
              ariaLabel='Requisições por minuto no período'
            />
          )}
        </PanelBody>
      </AdminPanel>
      <AdminPanel
        title='Erros por balde'
        actions={
          <Legend
            items={[
              { label: '4xx', color: COLOR.e4 },
              { label: '5xx', color: COLOR.e5, dashed: true },
            ]}
          />
        }
      >
        <PanelBody panel={panel}>
          {(points) => (
            <TimeSeriesChart
              points={points}
              series={errorSeries}
              range={meta.range}
              ariaLabel='Erros 4xx e 5xx no período'
            />
          )}
        </PanelBody>
      </AdminPanel>
      <AdminPanel
        title='Latência'
        actions={
          <Legend
            items={[
              { label: 'p50', color: COLOR.p50 },
              { label: 'p95', color: COLOR.p95 },
              { label: 'p99', color: COLOR.p99, dashed: true },
            ]}
          />
        }
      >
        <PanelBody panel={panel}>
          {(points) => (
            <TimeSeriesChart
              points={points}
              series={latencySeries}
              range={meta.range}
              format={formatMs}
              ariaLabel='Latência p50, p95 e p99 no período'
            />
          )}
        </PanelBody>
      </AdminPanel>
    </div>
  )
}

function OverviewView({ data }: { data: AnalyticsOverviewDTO }) {
  const totals = data.totals
  return (
    <div className='space-y-4'>
      {totals.ok ? (
        <div className='grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6'>
          <StatTile
            label='Requisições'
            value={formatNumber(totals.data.requests)}
            hint={`${formatNumber(Math.round((totals.data.requests / ((new Date(data.meta.to).getTime() - new Date(data.meta.from).getTime()) / 60_000)) * 10) / 10)} /min em média`}
          />
          <StatTile
            label='Erros 4xx'
            value={formatNumber(totals.data.errors4xx)}
            hint={formatPercent(totals.data.errors4xx, totals.data.requests)}
            tone={totals.data.errors4xx > 0 ? 'warning' : 'default'}
          />
          <StatTile
            label='Erros 5xx'
            value={formatNumber(totals.data.errors5xx)}
            hint={formatPercent(totals.data.errors5xx, totals.data.requests)}
            tone={totals.data.errors5xx > 0 ? 'danger' : 'default'}
          />
          <StatTile
            label='Latência p95'
            value={formatMs(totals.data.p95)}
            hint={`p50 ${formatMs(totals.data.p50)} · p99 ${formatMs(totals.data.p99)}`}
          />
          <StatTile
            label='Usuários únicos'
            value={formatNumber(totals.data.users)}
            hint='com sessão nas rotas de API'
          />
          <StatTile
            label='Workspaces únicos'
            value={formatNumber(totals.data.workspaces)}
            hint='com requisição no período'
          />
        </div>
      ) : (
        <PanelBody panel={totals}>{() => null}</PanelBody>
      )}
      <TrafficCharts panel={data.series} meta={data.meta} />
    </div>
  )
}

function RouteTable({
  title,
  description,
  rows,
  metric,
}: {
  title: string
  description: string
  rows: RouteStat[]
  metric: 'requests' | 'p95' | 'errors'
}) {
  return (
    <AdminPanel title={title} description={description} flush>
      {rows.length === 0 ? (
        <EmptyState title='Nada no período' />
      ) : (
        <div className='overflow-x-auto'>
          <Table className={DENSE_TABLE}>
            <TableHeader>
              <TableRow>
                <TableHead>Rota</TableHead>
                <TableHead className='text-right'>Req.</TableHead>
                <TableHead className='text-right'>4xx</TableHead>
                <TableHead className='text-right'>5xx</TableHead>
                <TableHead className='text-right'>p95</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={`${row.method} ${row.route}`}>
                  <TableCell className='max-w-[22rem]'>
                    <RouteLink route={row.route} method={row.method} />
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      metric === 'requests' && 'font-semibold',
                    )}
                  >
                    {formatNumber(row.requests)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      row.errors4xx > 0
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-muted-foreground',
                    )}
                  >
                    {formatNumber(row.errors4xx)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      row.errors5xx > 0
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                      metric === 'errors' && 'font-semibold',
                    )}
                  >
                    {formatNumber(row.errors5xx)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right font-mono tabular-nums',
                      metric === 'p95' && 'font-semibold',
                    )}
                  >
                    {formatMs(row.p95)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AdminPanel>
  )
}

function RoutesView({ data }: { data: AnalyticsRoutesDTO }) {
  return (
    <PanelBody panel={data.routes}>
      {(routes) => {
        const top = routes.slice(0, 15)
        const slowest = [...routes]
          .filter((r) => r.requests >= 3 && r.p95 !== null)
          .sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0))
          .slice(0, 15)
        const failing = [...routes]
          .filter((r) => r.errors4xx + r.errors5xx > 0)
          .sort(
            (a, b) => b.errors5xx - a.errors5xx || b.errors4xx - a.errors4xx,
          )
          .slice(0, 15)
        return (
          <div className='grid gap-4 2xl:grid-cols-2'>
            <RouteTable
              title='Mais acessadas'
              description='Por volume de requisições · clique para o detalhe'
              rows={top}
              metric='requests'
            />
            <RouteTable
              title='Mais lentas (p95)'
              description='Rotas com ao menos 3 requisições'
              rows={slowest}
              metric='p95'
            />
            <RouteTable
              title='Mais erros'
              description='5xx primeiro, depois 4xx'
              rows={failing}
              metric='errors'
            />
            <p className='text-muted-foreground text-xs 2xl:col-span-2'>
              {formatNumber(routes.length)} rota(s) no período. Ids (cuid2,
              uuid, números), slugs de workspace e tokens de links públicos
              viram <span className='font-mono'>[id]</span>,{' '}
              <span className='font-mono'>[workspace]</span> e{' '}
              <span className='font-mono'>[token]</span> para as requisições da
              mesma rota se agruparem.
            </p>
          </div>
        )
      }}
    </PanelBody>
  )
}

function ErrorSamplesTable({ samples }: { samples: ErrorSample[] }) {
  if (samples.length === 0) return <EmptyState title='Nenhum erro no período' />
  return (
    <div className='overflow-x-auto'>
      <Table className={DENSE_TABLE}>
        <TableHeader>
          <TableRow>
            <TableHead>Quando</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Rota</TableHead>
            <TableHead>Código · mensagem</TableHead>
            <TableHead className='text-right'>Duração</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {samples.map((s, i) => (
            <TableRow key={`${s.t}-${i}`}>
              <TableCell
                suppressHydrationWarning
                className='whitespace-nowrap text-muted-foreground'
                title={formatDateTime(s.t)}
              >
                {formatRelative(s.t)}
              </TableCell>
              <TableCell>
                <StatusCode status={s.status} />
              </TableCell>
              <TableCell className='max-w-[18rem]'>
                <RouteLink route={s.route} method={s.method} />
              </TableCell>
              <TableCell className='max-w-[26rem]'>
                <span
                  className='block truncate'
                  title={[s.code, s.message].filter(Boolean).join(' · ')}
                >
                  {s.code && <span className='font-mono'>{s.code}</span>}
                  {s.code && s.message && (
                    <span className='text-muted-foreground'> · </span>
                  )}
                  <span className='text-muted-foreground'>
                    {s.message ?? (s.code ? '' : '—')}
                  </span>
                </span>
              </TableCell>
              <TableCell className='text-right font-mono tabular-nums'>
                {formatMs(s.durationMs)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function RouteDetailView({ data }: { data: AnalyticsRouteDetailDTO }) {
  const searchParams = useSearchParams()
  return (
    <div className='space-y-4'>
      <div className='flex flex-wrap items-center gap-2 text-sm'>
        <Link
          href={analyticsHref(searchParams, {
            view: 'routes',
            route: undefined,
          })}
          className='text-muted-foreground hover:text-foreground'
        >
          ← Rotas
        </Link>
        <span className='truncate font-mono font-medium' title={data.route}>
          {data.route}
        </span>
      </div>
      <TrafficCharts panel={data.series} meta={data.meta} />
      <div className='grid gap-4 xl:grid-cols-3'>
        <AdminPanel title='Status' description='Respostas por código'>
          <PanelBody panel={data.statuses}>
            {(statuses) => {
              const total = statuses.reduce((s, x) => s + x.count, 0)
              return (
                <BarList
                  label='Respostas por status'
                  items={statuses.map((s) => ({
                    key: String(s.status),
                    label: (
                      <span className='inline-flex items-center gap-2'>
                        <StatusCode status={s.status} />
                        <span className='text-muted-foreground'>
                          {formatPercent(s.count, total)}
                        </span>
                      </span>
                    ),
                    value: s.count,
                  }))}
                />
              )
            }}
          </PanelBody>
        </AdminPanel>
        <AdminPanel
          title='Erros recentes'
          description='Últimos 20 · mensagens limpas e truncadas'
          flush
          className='xl:col-span-2'
        >
          <div className={data.recentErrors.ok ? undefined : 'p-4'}>
            <PanelBody panel={data.recentErrors}>
              {(samples) => <ErrorSamplesTable samples={samples} />}
            </PanelBody>
          </div>
        </AdminPanel>
      </div>
    </div>
  )
}

function ErrorsView({ data }: { data: AnalyticsErrorsDTO }) {
  return (
    <div className='space-y-4'>
      <AdminPanel
        title='Tendência de erros'
        actions={
          <Legend
            items={[
              { label: '4xx', color: COLOR.e4 },
              { label: '5xx', color: COLOR.e5, dashed: true },
            ]}
          />
        }
      >
        <PanelBody panel={data.trend}>
          {(points) => (
            <TimeSeriesChart
              points={points}
              series={errorSeries}
              range={data.meta.range}
              ariaLabel='Erros 4xx e 5xx no período'
            />
          )}
        </PanelBody>
      </AdminPanel>
      <AdminPanel
        title='Agrupados'
        description='Por status, código, rota e mensagem'
        flush
      >
        <div className={data.groups.ok ? undefined : 'p-4'}>
          <PanelBody panel={data.groups}>
            {(groups) =>
              groups.length === 0 ? (
                <EmptyState title='Nenhum erro no período' />
              ) : (
                <div className='overflow-x-auto'>
                  <Table className={DENSE_TABLE}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Código · mensagem</TableHead>
                        <TableHead>Rota</TableHead>
                        <TableHead className='text-right'>Qtd.</TableHead>
                        <TableHead className='text-right'>Último</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((g, i) => (
                        <TableRow key={`${g.status}-${g.code}-${g.route}-${i}`}>
                          <TableCell>
                            <StatusCode status={g.status} />
                          </TableCell>
                          <TableCell className='max-w-[24rem]'>
                            <span
                              className='block truncate'
                              title={[g.code, g.message]
                                .filter(Boolean)
                                .join(' · ')}
                            >
                              <span className='font-mono'>{g.code ?? '—'}</span>
                              {g.message && (
                                <span className='text-muted-foreground'>
                                  {' '}
                                  · {g.message}
                                </span>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className='max-w-[18rem]'>
                            <RouteLink route={g.route} />
                          </TableCell>
                          <TableCell className='text-right font-mono font-semibold tabular-nums'>
                            {formatNumber(g.count)}
                          </TableCell>
                          <TableCell
                            suppressHydrationWarning
                            className='whitespace-nowrap text-right text-muted-foreground'
                            title={formatDateTime(g.lastSeen)}
                          >
                            {formatRelative(g.lastSeen)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            }
          </PanelBody>
        </div>
      </AdminPanel>
      <AdminPanel
        title='Amostras recentes'
        description='Linhas de log sem IP, e-mail ou corpo; mensagens truncadas'
        flush
      >
        <div className={data.samples.ok ? undefined : 'p-4'}>
          <PanelBody panel={data.samples}>
            {(samples) => <ErrorSamplesTable samples={samples} />}
          </PanelBody>
        </div>
      </AdminPanel>
    </div>
  )
}

function AccessView({ data }: { data: AnalyticsAccessDTO }) {
  const geoMissing =
    data.countries.ok &&
    data.countries.data.length === 0 &&
    data.totals.ok &&
    data.totals.data.pageViews > 0
  return (
    <div className='space-y-4'>
      {data.totals.ok ? (
        <div className='grid grid-cols-3 gap-3'>
          <StatTile
            label='Usuários únicos'
            value={formatNumber(data.totals.data.users)}
            hint='sessões nas rotas de API'
          />
          <StatTile
            label='Workspaces únicos'
            value={formatNumber(data.totals.data.workspaces)}
          />
          <StatTile
            label='Page views'
            value={formatNumber(data.totals.data.pageViews)}
            hint='navegações vistas pelo proxy'
          />
        </div>
      ) : (
        <PanelBody panel={data.totals}>{() => null}</PanelBody>
      )}
      <AdminPanel
        title='Usuários e workspaces ativos'
        description='Distintos por balde'
        actions={
          <Legend
            items={[
              { label: 'Usuários', color: COLOR.users },
              { label: 'Workspaces', color: COLOR.workspaces, dashed: true },
            ]}
          />
        }
      >
        <PanelBody panel={data.activity}>
          {(points) => (
            <TimeSeriesChart
              points={points}
              series={[
                { id: 'Usuários', color: COLOR.users, value: (p) => p.users },
                {
                  id: 'Workspaces',
                  color: COLOR.workspaces,
                  value: (p) => p.workspaces,
                  dashed: true,
                },
              ]}
              range={data.meta.range}
              ariaLabel='Usuários e workspaces ativos no período'
            />
          )}
        </PanelBody>
      </AdminPanel>
      {geoMissing && (
        <p className='rounded-md border border-border bg-muted/50 px-3 py-2 text-muted-foreground text-xs'>
          Sem país/cidade nos logs do período: configure{' '}
          <span className='font-mono'>GEOIP_DB_PATH</span> (GeoLite2 City) e o{' '}
          <span className='font-mono'>X-Forwarded-For</span> no nginx — ver
          docs/admin-analytics.md.
        </p>
      )}
      <div className='grid gap-4 lg:grid-cols-2'>
        <AdminPanel
          title='Países'
          description='Page views · derivado do IP, que não é gravado'
        >
          <PanelBody panel={data.countries}>
            {(rows) => (
              <BarList
                label='Page views por país'
                items={rows.map((r) => ({
                  key: r.country,
                  label: (
                    <>
                      {r.countryCode && (
                        <span className='mr-1.5 font-mono text-muted-foreground'>
                          {r.countryCode}
                        </span>
                      )}
                      {r.country}
                    </>
                  ),
                  value: r.count,
                }))}
              />
            )}
          </PanelBody>
        </AdminPanel>
        <AdminPanel title='Cidades' description='Page views'>
          <PanelBody panel={data.cities}>
            {(rows) => (
              <BarList
                label='Page views por cidade'
                items={rows.map((r) => ({
                  key: `${r.city}-${r.country}`,
                  label: (
                    <>
                      {r.city}{' '}
                      <span className='text-muted-foreground'>
                        · {r.country}
                      </span>
                    </>
                  ),
                  value: r.count,
                }))}
              />
            )}
          </PanelBody>
        </AdminPanel>
      </div>
      <div className='grid gap-4 lg:grid-cols-3'>
        {(
          [
            ['Navegador', data.browsers],
            ['Sistema', data.os],
            ['Dispositivo', data.devices],
          ] as const
        ).map(([title, panel]) => (
          <AdminPanel key={title} title={title} description='Page views'>
            <PanelBody panel={panel}>
              {(rows) => {
                const total = rows.reduce((s, r) => s + r.count, 0)
                return (
                  <BarList
                    label={`Page views por ${title.toLowerCase()}`}
                    items={rows.map((r) => ({
                      key: r.name,
                      label: (
                        <>
                          {r.name}{' '}
                          <span className='text-muted-foreground'>
                            {formatPercent(r.count, total)}
                          </span>
                        </>
                      ),
                      value: r.count,
                    }))}
                  />
                )
              }}
            </PanelBody>
          </AdminPanel>
        ))}
      </div>
    </div>
  )
}

function JobsView({ data }: { data: AnalyticsJobsDTO }) {
  return (
    <div className='space-y-4'>
      <AdminPanel
        title='Filas (BullMQ)'
        description='Contadores ao vivo do Redis · cache de 15 s'
        flush
      >
        <div className={data.queues.ok ? undefined : 'p-4'}>
          <PanelBody panel={data.queues}>
            {(queues) => (
              <div className='overflow-x-auto'>
                <Table className={DENSE_TABLE}>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fila</TableHead>
                      <TableHead className='text-right'>Aguardando</TableHead>
                      <TableHead className='text-right'>Ativos</TableHead>
                      <TableHead className='text-right'>Agendados</TableHead>
                      <TableHead className='text-right'>Falhas</TableHead>
                      <TableHead className='text-right'>Concluídos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queues.map((q) => (
                      <TableRow key={q.name}>
                        <TableCell className='font-mono'>{q.name}</TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatNumber(q.waiting)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatNumber(q.active)}
                        </TableCell>
                        <TableCell className='text-right font-mono text-muted-foreground tabular-nums'>
                          {formatNumber(q.delayed)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right font-mono tabular-nums',
                            q.failed > 0
                              ? 'text-destructive'
                              : 'text-muted-foreground',
                          )}
                        >
                          {formatNumber(q.failed)}
                        </TableCell>
                        <TableCell className='text-right font-mono text-muted-foreground tabular-nums'>
                          {formatNumber(q.completed)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </PanelBody>
        </div>
      </AdminPanel>
      <AdminPanel
        title='Falhas recentes'
        description='As 5 últimas de cada fila · detalhes e retry em /jobs'
        flush
        actions={
          <Link
            href='/jobs'
            className='text-muted-foreground text-xs hover:text-foreground'
          >
            Abrir /jobs
          </Link>
        }
      >
        <div className={data.failures.ok ? undefined : 'p-4'}>
          <PanelBody panel={data.failures}>
            {(failures) =>
              failures.length === 0 ? (
                <EmptyState title='Nenhuma falha retida' />
              ) : (
                <div className='overflow-x-auto'>
                  <Table className={DENSE_TABLE}>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quando</TableHead>
                        <TableHead>Fila · job</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead className='text-right'>Tentativas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {failures.map((f, i) => (
                        <TableRow key={`${f.queue}-${f.jobId ?? i}`}>
                          <TableCell
                            suppressHydrationWarning
                            className='whitespace-nowrap text-muted-foreground'
                            title={formatDateTime(f.failedAt)}
                          >
                            {f.failedAt ? formatRelative(f.failedAt) : '—'}
                          </TableCell>
                          <TableCell className='max-w-[16rem]'>
                            <span
                              className='block truncate font-mono'
                              title={`${f.queue} · ${f.jobName} #${f.jobId ?? '?'}`}
                            >
                              {f.queue}{' '}
                              <span className='text-muted-foreground'>
                                · {f.jobName}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell className='max-w-[28rem]'>
                            <span
                              className='block truncate text-muted-foreground'
                              title={f.reason ?? undefined}
                            >
                              {f.reason ?? '—'}
                            </span>
                          </TableCell>
                          <TableCell className='text-right font-mono tabular-nums'>
                            {f.attempts}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            }
          </PanelBody>
        </div>
      </AdminPanel>
    </div>
  )
}

export function AnalyticsUnconfigured() {
  return (
    <AdminPanel title='Configure o AXIOM_QUERY_TOKEN'>
      <div className='space-y-3 text-sm'>
        <p className='text-muted-foreground'>
          O painel consulta os logs de requisição no Axiom e precisa de um token
          de API só de leitura. As abas de logs ficam vazias até lá; a aba{' '}
          <span className='font-medium text-foreground'>Jobs</span> já funciona.
        </p>
        <ol className='list-decimal space-y-1 pl-5 text-muted-foreground'>
          <li>
            No Axiom:{' '}
            <span className='text-foreground'>
              Settings → API tokens → New API token
            </span>
            .
          </li>
          <li>
            Permissão só de <span className='text-foreground'>Query</span> no
            dataset de{' '}
            <span className='font-mono'>NEXT_PUBLIC_AXIOM_DATASET</span>.
          </li>
          <li>
            Grave em <span className='font-mono'>AXIOM_QUERY_TOKEN</span> no{' '}
            <span className='font-mono'>.env</span> (produção: nos secrets do
            deploy) e reinicie o app.
          </li>
        </ol>
        <p className='text-muted-foreground text-xs'>
          Em desenvolvimento,{' '}
          <span className='font-mono'>ANALYTICS_FIXTURES=true</span> serve dados
          simulados. Detalhes em docs/admin-analytics.md.
        </p>
      </div>
    </AdminPanel>
  )
}

export function AnalyticsDashboard({ result }: { result: AnalyticsResultDTO }) {
  return (
    <div className='space-y-4'>
      <MetaLine meta={result.meta} />
      {'unconfigured' in result ? (
        <AnalyticsUnconfigured />
      ) : result.view === 'overview' ? (
        <OverviewView data={result} />
      ) : result.view === 'routes' ? (
        <RoutesView data={result} />
      ) : result.view === 'route' ? (
        <RouteDetailView data={result} />
      ) : result.view === 'errors' ? (
        <ErrorsView data={result} />
      ) : result.view === 'access' ? (
        <AccessView data={result} />
      ) : (
        <JobsView data={result} />
      )}
    </div>
  )
}
