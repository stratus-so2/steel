'use client'

import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveLine } from '@nivo/line'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AdminMetricsDTO } from '@/types/admin-metrics'
import type { ModuleKind } from '@/types/workspace-connection'

/**
 * Mesmo tema nivo dos widgets do CRM (herda a cor do texto, claro/escuro).
 * Cores validadas (CVD + contraste nos dois temas) e fixas por entidade:
 * CRM/cancelado = índigo, WhatsApp/expirado = âmbar.
 */
const THEME = {
  text: { fill: 'currentColor', fontSize: 11 },
  axis: {
    ticks: { text: { fill: 'currentColor' }, line: { stroke: 'transparent' } },
    legend: { text: { fill: 'currentColor', fontSize: 11 } },
    domain: { line: { stroke: 'currentColor', strokeOpacity: 0.15 } },
  },
  grid: { line: { stroke: 'currentColor', strokeOpacity: 0.08 } },
  legends: { text: { fill: 'currentColor' } },
  tooltip: {
    container: {
      background: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
      fontSize: 12,
    },
  },
} as const

const INDIGO = '#6366f1'
const AMBER = '#d97706'

const MODULE_LABEL: Record<ModuleKind, string> = {
  SERVICE_DESK: 'Service Desk',
  CRM: 'CRM',
  COMMUNICATION: 'WhatsApp',
}
const MODULE_COLOR: Partial<Record<ModuleKind, string>> = {
  CRM: INDIGO,
  COMMUNICATION: AMBER,
}

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
const num = new Intl.NumberFormat('pt-BR')

const MONTHS = [
  'jan',
  'fev',
  'mar',
  'abr',
  'mai',
  'jun',
  'jul',
  'ago',
  'set',
  'out',
  'nov',
  'dez',
]
const monthLabel = (month: string) => {
  const [y, m] = month.split('-')
  return `${MONTHS[Number(m) - 1]}/${y.slice(2)}`
}
const dayLabel = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const dateLabel = (day: string) =>
  `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

/** Métricas sem fonte de dados hoje — o que falta para existirem. */
const MISSING_SOURCES = [
  {
    title: 'Tickets por produto',
    need: 'Depende do domínio do ServiceDesk (hoje só a casca): tabela de tickets com workspace, produto/módulo e status.',
  },
  {
    title: 'Tempo de resposta',
    need: 'Precisa dos tickets com data de abertura e da primeira resposta do agente (SLA). Vem junto com o ServiceDesk.',
  },
  {
    title: 'Tempo de implantação',
    need: 'Precisa registrar marcos de onboarding por cliente (contrato assinado → módulo liberado → primeiro uso). O primeiro uso já sai de module_usage_daily; faltam a data de contrato e um "go-live" explícito.',
  },
  {
    title: 'NPS',
    need: 'Não há pesquisa de satisfação. Precisa de uma coleta (e-mail/in-app) com nota 0–10 por usuário e workspace, gravada em tabela própria.',
  },
] as const

function StatTile({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className='space-y-1'>
        <p className='text-muted-foreground text-xs'>{label}</p>
        <p className='font-heading font-semibold text-2xl tabular-nums'>
          {value}
        </p>
        <p className='text-muted-foreground text-xs'>{hint}</p>
      </CardContent>
    </Card>
  )
}

function Empty({ message }: { message: string }) {
  return (
    <div className='flex h-full items-center justify-center px-3 text-center text-muted-foreground text-sm'>
      {message}
    </div>
  )
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className='inline-block size-2.5 rounded-sm'
      style={{ backgroundColor: color }}
    />
  )
}

function ChurnChart({ data }: { data: AdminMetricsDTO['churnByMonth'] }) {
  const hasData = data.some((d) => d.cancelled + d.expired > 0)
  if (!hasData) {
    return <Empty message='Nenhum cancelamento nos últimos 12 meses.' />
  }
  const rows = data.map((d) => ({
    month: monthLabel(d.month),
    Canceladas: d.cancelled,
    Expiradas: d.expired,
  }))
  return (
    <ResponsiveBar
      data={rows}
      keys={['Canceladas', 'Expiradas']}
      indexBy='month'
      groupMode='stacked'
      margin={{ top: 12, right: 16, bottom: 28, left: 32 }}
      padding={0.35}
      innerPadding={2}
      colors={[INDIGO, AMBER]}
      borderRadius={3}
      enableLabel={false}
      axisBottom={{ tickSize: 0, tickPadding: 8 }}
      axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: 4, format: 'd' }}
      theme={THEME}
      role='img'
      ariaLabel='Assinaturas canceladas e expiradas por mês'
    />
  )
}

function UsageChart({
  days,
  daily,
}: {
  days: string[]
  daily: AdminMetricsDTO['usage']['daily']
}) {
  if (daily.length === 0) {
    return <Empty message='Ainda sem uso registrado na janela.' />
  }
  const modules: ModuleKind[] = ['CRM', 'COMMUNICATION']
  const byKey = new Map(daily.map((d) => [`${d.day}|${d.module}`, d]))
  const series = modules.map((module) => ({
    id: MODULE_LABEL[module],
    color: MODULE_COLOR[module] ?? INDIGO,
    data: days.map((day) => ({
      x: dayLabel(day),
      y: byKey.get(`${day}|${module}`)?.requests ?? 0,
    })),
  }))
  return (
    <ResponsiveLine
      data={series}
      margin={{ top: 12, right: 16, bottom: 28, left: 44 }}
      colors={(s) => s.color as string}
      curve='monotoneX'
      lineWidth={2}
      pointSize={0}
      enableSlices='x'
      yScale={{ type: 'linear', min: 0, max: 'auto' }}
      axisBottom={{
        tickSize: 0,
        tickPadding: 8,
        tickValues: days.filter((_, i) => i % 5 === 0).map(dayLabel),
      }}
      axisLeft={{ tickSize: 0, tickPadding: 8, tickValues: 4 }}
      theme={THEME}
      role='img'
    />
  )
}

export function AdminMetricsDashboard({
  metrics,
  days,
}: {
  metrics: AdminMetricsDTO
  /** Os dias da janela (`YYYY-MM-DD`, São Paulo), do mais antigo ao atual. */
  days: string[]
}) {
  const churnLast = metrics.churnByMonth.at(-1)
  const trackedSince = metrics.usage.trackedSince

  return (
    <div className='space-y-6'>
      <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        <StatTile
          label='Clientes ativos'
          value={num.format(metrics.activeClients)}
          hint={`com uso de CRM/WhatsApp nos últimos ${metrics.windowDays} dias, de ${num.format(metrics.totalWorkspaces)} workspaces`}
        />
        <StatTile
          label='Workspaces com login'
          value={num.format(metrics.workspacesWithLogin)}
          hint={`algum membro entrou nos últimos ${metrics.windowDays} dias`}
        />
        <StatTile
          label='MRR'
          value={brl.format(metrics.mrr.cents / 100)}
          hint={`${num.format(metrics.mrr.payingWorkspaces)} workspace(s) pagante(s) via AbacatePay`}
        />
        <StatTile
          label='Cancelamentos no mês'
          value={num.format(
            (churnLast?.cancelled ?? 0) + (churnLast?.expired ?? 0),
          )}
          hint={`${brl.format((churnLast?.lostMrrCents ?? 0) / 100)} de MRR perdido`}
        />
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Uso por módulo (requisições/dia)</CardTitle>
            <div className='flex gap-3 text-muted-foreground text-xs'>
              <span className='inline-flex items-center gap-1'>
                <Swatch color={INDIGO} /> CRM
              </span>
              <span className='inline-flex items-center gap-1'>
                <Swatch color={AMBER} /> WhatsApp
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className='h-64 text-muted-foreground'>
              <UsageChart days={days} daily={metrics.usage.daily} />
            </div>
            <p className='mt-2 text-muted-foreground text-xs'>
              {trackedSince
                ? `Registrado desde ${dateLabel(trackedSince)} · atualizado a cada 15 min.`
                : 'Coleta de uso ainda sem dados gravados (o worker consolida a cada 15 min).'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cancelamentos por mês</CardTitle>
            <div className='flex gap-3 text-muted-foreground text-xs'>
              <span className='inline-flex items-center gap-1'>
                <Swatch color={INDIGO} /> Canceladas
              </span>
              <span className='inline-flex items-center gap-1'>
                <Swatch color={AMBER} /> Expiradas
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className='h-64 text-muted-foreground'>
              <ChurnChart data={metrics.churnByMonth} />
            </div>
            <p className='mt-2 text-muted-foreground text-xs'>
              Assinaturas AbacatePay que terminaram como canceladas ou
              expiradas, pelo mês da última atualização.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className='grid gap-4 xl:grid-cols-2'>
        <Card>
          <CardHeader>
            <CardTitle>Uso por módulo ({metrics.windowDays} dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead className='text-right'>Requisições</TableHead>
                  <TableHead className='text-right'>Ações</TableHead>
                  <TableHead className='text-right'>Workspaces</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {metrics.usage.totals.map((total) => (
                  <TableRow key={total.module}>
                    <TableCell>{MODULE_LABEL[total.module]}</TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {num.format(total.requests)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {num.format(total.mutations)}
                    </TableCell>
                    <TableCell className='text-right tabular-nums'>
                      {num.format(total.workspaces)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className='mt-2 text-muted-foreground text-xs'>
              Ações = requisições de escrita. Service Desk ainda não tem API.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspaces mais ativos</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.usage.topWorkspaces.length === 0 ? (
              <p className='text-muted-foreground text-sm'>
                Ainda sem uso registrado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Workspace</TableHead>
                    <TableHead className='text-right'>Requisições</TableHead>
                    <TableHead className='text-right'>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.usage.topWorkspaces.map((ws) => (
                    <TableRow key={ws.workspaceId}>
                      <TableCell>
                        <Link
                          href={`/admin/workspaces/${ws.workspaceId}`}
                          className='font-medium text-sm hover:underline'
                        >
                          {ws.name}
                        </Link>
                        <p className='text-muted-foreground text-xs'>
                          {ws.slug}
                        </p>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {num.format(ws.requests)}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {num.format(ws.mutations)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className='space-y-2'>
        <h2 className='font-medium text-sm'>Ainda sem fonte de dados</h2>
        <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
          {MISSING_SOURCES.map((metric) => (
            <Card key={metric.title} className='border-dashed'>
              <CardContent className='space-y-1.5'>
                <div className='flex items-center justify-between gap-2'>
                  <p className='font-medium text-sm'>{metric.title}</p>
                  <Badge variant='secondary'>sem fonte de dados</Badge>
                </div>
                <p className='text-muted-foreground text-xs'>{metric.need}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
