'use client'

import {
  Alert02Icon,
  ArrowUpRight01Icon,
  BulbIcon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  InformationCircleIcon,
  SparklesIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { toast } from 'sonner'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useCrmCompetitorAnalysis,
  useCrmCompetitorIdeas,
} from '@/src/hooks/use-crm-competitor-analysis'
import {
  CRM_SOCIAL_POST_FORMAT_LABELS,
  type CrmCompetitorMetricsRange,
} from '@/src/schemas/crm-competitor.schema'
import { CRM_SOCIAL_PLATFORM_LABELS } from '@/src/schemas/crm-social.schema'
import type {
  CrmCompetitorAnalysisDTO,
  CrmCompetitorIdeaDTO,
  CrmCompetitorInsightDTO,
  CrmPostDaypartDTO,
  CrmPostStatsDTO,
  CrmSocialPostDTO,
} from '@/types/crm-competitor'

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const dateFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  timeZone: 'America/Sao_Paulo',
})
const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

const RANGE_OPTIONS = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
] as const

/**
 * Series colors for "you vs. competitor". Validated with the dataviz palette
 * checker against both the light and the dark surface (CVD and contrast
 * pass), so the same pair serves both themes. Identity never relies on color
 * alone: every chart has a legend and the values written next to the bars.
 */
const SERIES = {
  own: { label: 'Você', color: '#009689' },
  competitor: { label: 'Concorrente', color: '#f54900' },
} as const

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const DAYPART_LABELS: Record<CrmPostDaypartDTO, string> = {
  DAWN: 'Madrugada',
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  EVENING: 'Noite',
}

function fmt(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${nf.format(value)}${suffix}`
}

function Legend({ hasOwn }: { hasOwn: boolean }) {
  const items = hasOwn ? [SERIES.own, SERIES.competitor] : [SERIES.competitor]
  return (
    <div className='flex items-center gap-3 text-muted-foreground text-xs'>
      {items.map((item) => (
        <span key={item.label} className='flex items-center gap-1.5'>
          <span
            className='size-2.5 rounded-sm'
            style={{ backgroundColor: item.color }}
            aria-hidden
          />
          {item.label}
        </span>
      ))}
    </div>
  )
}

function KpiTile({
  title,
  own,
  competitor,
  hasOwn,
  hint,
}: {
  title: string
  own: string
  competitor: string
  hasOwn: boolean
  hint?: string
}) {
  return (
    <Card size='sm' className='gap-2 p-4'>
      <p className='text-muted-foreground text-xs'>{title}</p>
      <div className='flex items-end justify-between gap-3'>
        {hasOwn && (
          <div>
            <p className='font-semibold text-xl tabular-nums'>{own}</p>
            <p className='flex items-center gap-1 text-muted-foreground text-xs'>
              <span
                className='size-2 rounded-sm'
                style={{ backgroundColor: SERIES.own.color }}
                aria-hidden
              />
              {SERIES.own.label}
            </p>
          </div>
        )}
        <div className={hasOwn ? 'text-right' : undefined}>
          <p className='font-semibold text-xl tabular-nums'>{competitor}</p>
          <p
            className={`flex items-center gap-1 text-muted-foreground text-xs ${hasOwn ? 'justify-end' : ''}`}
          >
            <span
              className='size-2 rounded-sm'
              style={{ backgroundColor: SERIES.competitor.color }}
              aria-hidden
            />
            {SERIES.competitor.label}
          </p>
        </div>
      </div>
      {hint && <p className='text-muted-foreground text-xs'>{hint}</p>}
    </Card>
  )
}

type BarRow = {
  key: string
  label: string
  own: number | null
  competitor: number | null
  ownNote?: string
  competitorNote?: string
}

function Bar({
  value,
  max,
  color,
  note,
  seriesLabel,
  rowLabel,
}: {
  value: number | null
  max: number
  color: string
  note?: string
  seriesLabel: string
  rowLabel: string
}) {
  const width = value && max > 0 ? Math.max((value / max) * 100, 2) : 0
  const text =
    value === null && note ? note : `${fmt(value)}${note ? ` · ${note}` : ''}`
  return (
    <div
      className='group flex h-4 items-center gap-2'
      title={`${rowLabel} — ${seriesLabel}: ${text}`}
    >
      <div className='h-2.5 flex-1'>
        {width > 0 && (
          <div
            className='h-full rounded-r-sm transition-opacity group-hover:opacity-80'
            style={{ width: `${width}%`, backgroundColor: color }}
          />
        )}
      </div>
      <span className='w-28 shrink-0 text-right text-muted-foreground text-xs tabular-nums'>
        {text}
      </span>
    </div>
  )
}

/** Horizontal paired bars (you vs. competitor) on one shared scale. */
function PairedBars({ rows, hasOwn }: { rows: BarRow[]; hasOwn: boolean }) {
  const max = Math.max(
    0,
    ...rows.flatMap((r) => [hasOwn ? (r.own ?? 0) : 0, r.competitor ?? 0]),
  )
  return (
    <div className='space-y-2.5'>
      {rows.map((row) => (
        <div
          key={row.key}
          className='grid grid-cols-[6.5rem_1fr] items-center gap-3'
        >
          <span className='truncate text-xs'>{row.label}</span>
          <div className='space-y-[2px]'>
            {hasOwn && (
              <Bar
                value={row.own}
                max={max}
                color={SERIES.own.color}
                note={row.ownNote}
                seriesLabel={SERIES.own.label}
                rowLabel={row.label}
              />
            )}
            <Bar
              value={row.competitor}
              max={max}
              color={SERIES.competitor.color}
              note={row.competitorNote}
              seriesLabel={SERIES.competitor.label}
              rowLabel={row.label}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function postsNote(count: number): string {
  return count === 1 ? '1 post' : `${count} posts`
}

function formatRows(
  competitor: CrmPostStatsDTO,
  own: CrmPostStatsDTO | null,
): BarRow[] {
  const formats = new Set([
    ...competitor.formats.map((f) => f.format),
    ...(own?.formats.map((f) => f.format) ?? []),
  ])
  return [...formats].map((format) => {
    const c = competitor.formats.find((f) => f.format === format)
    const o = own?.formats.find((f) => f.format === format)
    return {
      key: format,
      label: CRM_SOCIAL_POST_FORMAT_LABELS[format],
      own: o?.avgInteractions ?? null,
      competitor: c?.avgInteractions ?? null,
      ownNote: postsNote(o?.postsCount ?? 0),
      competitorNote: postsNote(c?.postsCount ?? 0),
    }
  })
}

function weekdayRows(
  competitor: CrmPostStatsDTO,
  own: CrmPostStatsDTO | null,
): BarRow[] {
  return competitor.weekdays.map((c) => {
    const o = own?.weekdays[c.weekday]
    return {
      key: String(c.weekday),
      label: WEEKDAY_SHORT[c.weekday],
      own: o?.postsCount ?? null,
      competitor: c.postsCount,
    }
  })
}

function daypartRows(
  competitor: CrmPostStatsDTO,
  own: CrmPostStatsDTO | null,
): BarRow[] {
  return competitor.dayparts.map((c) => {
    const o = own?.dayparts.find((d) => d.daypart === c.daypart)
    return {
      key: c.daypart,
      label: DAYPART_LABELS[c.daypart],
      own: o?.avgInteractions ?? null,
      competitor: c.avgInteractions,
      ownNote: postsNote(o?.postsCount ?? 0),
      competitorNote: postsNote(c.postsCount),
    }
  })
}

const INSIGHT_ICON = {
  positive: CheckmarkCircle02Icon,
  negative: Alert02Icon,
  neutral: InformationCircleIcon,
} as const

const INSIGHT_LABEL = {
  positive: 'Vantagem sua',
  negative: 'Atenção',
  neutral: 'Observação',
} as const

function Insights({ insights }: { insights: CrmCompetitorInsightDTO[] }) {
  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle>Leituras do período</CardTitle>
        <CardDescription>
          Calculadas a partir dos posts coletados, sem IA.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            Ainda não há posts suficientes para comparar.
          </p>
        ) : (
          <ul className='space-y-2'>
            {insights.map((insight) => (
              <li key={insight.key} className='flex items-start gap-2 text-sm'>
                <SteelIcon
                  icon={INSIGHT_ICON[insight.tone]}
                  size={16}
                  className={
                    insight.tone === 'negative'
                      ? 'mt-0.5 shrink-0 text-destructive'
                      : 'mt-0.5 shrink-0 text-muted-foreground'
                  }
                  aria-label={INSIGHT_LABEL[insight.tone]}
                />
                <span>{insight.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function PostList({
  title,
  posts,
}: {
  title: string
  posts: CrmSocialPostDTO[]
}) {
  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {posts.length === 0 ? (
          <p className='text-muted-foreground text-xs'>Sem posts no período.</p>
        ) : (
          <ol className='space-y-3'>
            {posts.map((post) => (
              <li key={post.externalId} className='space-y-1'>
                <div className='flex items-center gap-2 text-xs'>
                  <Badge variant='secondary'>
                    {CRM_SOCIAL_POST_FORMAT_LABELS[post.format]}
                  </Badge>
                  <span className='text-muted-foreground'>
                    {dateFormat.format(new Date(post.publishedAt))}
                  </span>
                  <span className='ml-auto font-medium tabular-nums'>
                    {post.interactions !== null
                      ? `${nf.format(post.interactions)} interações`
                      : post.viewCount !== null
                        ? `${nf.format(post.viewCount)} views`
                        : '—'}
                  </span>
                </div>
                <p className='line-clamp-2 text-muted-foreground text-xs'>
                  {post.caption ?? 'Sem legenda'}
                </p>
                {post.permalink && (
                  <a
                    href={post.permalink}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='inline-flex items-center gap-1 text-primary text-xs hover:underline'
                  >
                    Abrir post
                    <SteelIcon icon={ArrowUpRight01Icon} size={12} />
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}

function Hashtags({
  competitor,
  own,
}: {
  competitor: CrmPostStatsDTO
  own: CrmPostStatsDTO | null
}) {
  const ownTags = new Set(own?.hashtags.map((h) => h.tag) ?? [])
  return (
    <Card size='sm'>
      <CardHeader>
        <CardTitle>Hashtags do concorrente</CardTitle>
        <CardDescription>
          Mais usadas no período, com a média de interações dos posts.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {competitor.hashtags.length === 0 ? (
          <p className='text-muted-foreground text-xs'>
            Nenhuma hashtag no período.
          </p>
        ) : (
          <ul className='space-y-1.5'>
            {competitor.hashtags.map((h) => (
              <li key={h.tag} className='flex items-center gap-2 text-xs'>
                <span className='font-medium'>#{h.tag}</span>
                {own && ownTags.has(h.tag) && (
                  <Badge variant='outline'>você também usa</Badge>
                )}
                <span className='ml-auto text-muted-foreground tabular-nums'>
                  {postsNote(h.postsCount)} · {fmt(h.avgInteractions)} média
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function IdeaCard({ idea }: { idea: CrmCompetitorIdeaDTO }) {
  const fullText = [
    idea.hook,
    '',
    idea.caption,
    '',
    idea.hashtags.map((t) => `#${t}`).join(' '),
  ].join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(fullText)
      toast.success('Legenda copiada.')
    } catch {
      toast.error('Não foi possível copiar.')
    }
  }

  return (
    <Card size='sm' className='gap-3'>
      <CardHeader>
        <CardTitle className='text-sm'>{idea.title}</CardTitle>
        <CardAction>
          <Badge variant='secondary'>
            {CRM_SOCIAL_POST_FORMAT_LABELS[idea.format]}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <div>
          <p className='text-muted-foreground text-xs'>Gancho</p>
          <p className='font-medium'>{idea.hook}</p>
        </div>
        <div>
          <p className='text-muted-foreground text-xs'>Legenda</p>
          <p className='whitespace-pre-line'>{idea.caption}</p>
        </div>
        {idea.hashtags.length > 0 && (
          <p className='text-primary text-xs'>
            {idea.hashtags.map((t) => `#${t}`).join(' ')}
          </p>
        )}
        <div className='rounded-md bg-muted p-2.5 text-xs'>
          <p className='mb-0.5 flex items-center gap-1 font-medium'>
            <SteelIcon icon={BulbIcon} size={12} />
            Por que deve funcionar
          </p>
          <p className='text-muted-foreground'>{idea.rationale}</p>
        </div>
        <Button variant='outline' size='sm' onClick={copy}>
          <SteelIcon icon={Copy01Icon} size={14} />
          Copiar legenda
        </Button>
      </CardContent>
    </Card>
  )
}

function Ideas({
  workspaceId,
  competitorId,
  range,
  hasPosts,
}: {
  workspaceId: string
  competitorId: string
  range: CrmCompetitorMetricsRange
  hasPosts: boolean
}) {
  const { ideaSet, isLoading, isGenerating, generate } = useCrmCompetitorIdeas(
    workspaceId,
    competitorId,
  )

  async function handleGenerate() {
    try {
      await generate(range)
      toast.success('Ideias geradas.')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar as ideias.',
      )
    }
  }

  return (
    <section className='space-y-3'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h2 className='flex items-center gap-1.5 font-medium text-sm'>
            <SteelIcon icon={SparklesIcon} size={16} className='text-primary' />
            Ideias de publicação
          </h2>
          <p className='text-muted-foreground text-xs'>
            Geradas pela Steel IA a partir desta análise. Cada geração consome a
            cota de IA do workspace.
          </p>
        </div>
        <Button
          size='sm'
          disabled={isGenerating || !hasPosts}
          onClick={handleGenerate}
        >
          <SteelIcon icon={SparklesIcon} size={14} />
          {isGenerating
            ? 'Gerando…'
            : ideaSet
              ? 'Gerar novas ideias'
              : 'Gerar ideias'}
        </Button>
      </div>

      {isLoading ? (
        <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
          <Skeleton className='h-64' />
          <Skeleton className='h-64' />
          <Skeleton className='h-64' />
        </div>
      ) : ideaSet && ideaSet.ideas.length > 0 ? (
        <>
          <p className='text-muted-foreground text-xs'>
            Geradas em {dateTimeFormat.format(new Date(ideaSet.createdAt))} com
            a janela de{' '}
            {RANGE_OPTIONS.find((o) => o.value === ideaSet.range)?.label}.
          </p>
          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-3'>
            {ideaSet.ideas.map((idea) => (
              <IdeaCard key={`${idea.title}-${idea.hook}`} idea={idea} />
            ))}
          </div>
        </>
      ) : (
        <Card size='sm' className='items-center p-6 text-center'>
          <p className='text-muted-foreground text-sm'>
            {hasPosts
              ? 'Nenhuma ideia gerada ainda para este concorrente.'
              : 'As ideias usam os posts coletados — aguarde a próxima sincronização.'}
          </p>
        </Card>
      )}
    </section>
  )
}

function Header({
  analysis,
  range,
  onRangeChange,
}: {
  analysis: CrmCompetitorAnalysisDTO | null
  range: CrmCompetitorMetricsRange
  onRangeChange: (range: CrmCompetitorMetricsRange) => void
}) {
  const competitor = analysis?.competitor
  const name = competitor?.displayName || competitor?.handle || ''
  return (
    <div className='flex flex-wrap items-center gap-4'>
      {competitor ? (
        <div className='flex min-w-0 flex-1 basis-72 items-center gap-3'>
          <Avatar className='size-12'>
            {competitor.avatarUrl && (
              <AvatarImage src={competitor.avatarUrl} alt={name} />
            )}
            <AvatarFallback>{name.replace('@', '').slice(0, 2)}</AvatarFallback>
          </Avatar>
          <div className='min-w-0'>
            <p className='truncate font-semibold'>{name}</p>
            <p className='flex flex-wrap items-center gap-x-2 text-muted-foreground text-xs'>
              <span>{competitor.handle}</span>
              <span>·</span>
              <span>{CRM_SOCIAL_PLATFORM_LABELS[competitor.platform]}</span>
              <span>·</span>
              <span>{fmt(competitor.followersCount)} seguidores</span>
              {competitor.lastSyncedAt && (
                <>
                  <span>·</span>
                  <span>
                    sincronizado em{' '}
                    {dateTimeFormat.format(new Date(competitor.lastSyncedAt))}
                  </span>
                </>
              )}
            </p>
          </div>
          {competitor.profileUrl && (
            <Button
              variant='ghost'
              size='sm'
              nativeButton={false}
              render={
                <a
                  href={competitor.profileUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                >
                  Abrir perfil
                  <SteelIcon icon={ArrowUpRight01Icon} size={14} />
                </a>
              }
            />
          )}
        </div>
      ) : (
        <Skeleton className='h-12 w-72' />
      )}
      <div className='ml-auto'>
        <Select
          value={range}
          onValueChange={(value) =>
            onRangeChange(value as CrmCompetitorMetricsRange)
          }
        >
          <SelectTrigger size='sm' className='w-28'>
            <SelectValue>
              {(value: string) =>
                RANGE_OPTIONS.find((option) => option.value === value)?.label
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {RANGE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

/**
 * Full competitor analysis: post-based comparison with the own account
 * (no AI) and AI post ideas on demand. The list's side panel keeps the
 * basics; this screen is the deep dive.
 */
export function CrmCompetitorAnalysis({
  workspaceId,
  competitorId,
}: {
  workspaceId: string
  competitorId: string
}) {
  const [range, setRange] = useState<CrmCompetitorMetricsRange>('30d')
  const { data, isLoading, error } = useCrmCompetitorAnalysis(
    workspaceId,
    competitorId,
    range,
  )

  const competitorStats = data?.competitorStats
  const own = data?.ownAccount?.stats ?? null
  const hasOwn = own !== null
  const hasPosts = (competitorStats?.postsCount ?? 0) > 0
  const showViews =
    competitorStats?.avgViews != null || (own?.avgViews ?? null) !== null

  return (
    <div className='mx-auto w-full max-w-6xl space-y-6'>
      <Header analysis={data} range={range} onRangeChange={setRange} />

      {error && <p className='text-destructive text-sm'>{error}</p>}

      {isLoading && !data ? (
        <div className='grid gap-3 md:grid-cols-4'>
          {['a', 'b', 'c', 'd'].map((k) => (
            <Skeleton key={k} className='h-24' />
          ))}
        </div>
      ) : data && competitorStats ? (
        <div
          className={`space-y-6 transition-opacity ${isLoading ? 'opacity-60' : ''}`}
        >
          {!hasOwn && (
            <p className='text-muted-foreground text-xs'>
              Conecte uma conta de{' '}
              {CRM_SOCIAL_PLATFORM_LABELS[data.competitor.platform]} no CRM para
              comparar com a sua.
            </p>
          )}

          <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
            <KpiTile
              title='Posts por semana'
              own={fmt(own?.postsPerWeek ?? null)}
              competitor={fmt(competitorStats.postsPerWeek)}
              hasOwn={hasOwn}
              hint={`${competitorStats.postsCount} posts do concorrente no período`}
            />
            <KpiTile
              title='Interações médias por post'
              own={fmt(own?.avgInteractions ?? null)}
              competitor={fmt(competitorStats.avgInteractions)}
              hasOwn={hasOwn}
              hint='Curtidas + comentários'
            />
            <KpiTile
              title='Taxa de engajamento'
              own={fmt(own?.engagementRate ?? null, '%')}
              competitor={fmt(competitorStats.engagementRate, '%')}
              hasOwn={hasOwn}
              hint='Interações médias ÷ seguidores'
            />
            {showViews ? (
              <KpiTile
                title='Visualizações médias'
                own={fmt(own?.avgViews ?? null)}
                competitor={fmt(competitorStats.avgViews)}
                hasOwn={hasOwn}
              />
            ) : (
              <KpiTile
                title='Tamanho médio da legenda'
                own={fmt(own?.avgCaptionLength ?? null, ' car.')}
                competitor={fmt(competitorStats.avgCaptionLength, ' car.')}
                hasOwn={hasOwn}
              />
            )}
          </div>

          {competitorStats.hiddenLikesCount > 0 && (
            <p className='text-muted-foreground text-xs'>
              {competitorStats.hiddenLikesCount} post(s) do concorrente com
              curtidas ocultas — entram só com os comentários.
            </p>
          )}

          {!hasPosts ? (
            <Card size='sm' className='items-center p-6 text-center'>
              <p className='text-muted-foreground text-sm'>
                Nenhum post coletado neste período. A coleta roda junto com a
                sincronização diária (ou pelo botão “Sincronizar agora” na lista
                de concorrentes).
              </p>
            </Card>
          ) : (
            <>
              <Insights insights={data.insights} />

              <div className='grid gap-3 lg:grid-cols-2'>
                <Card size='sm'>
                  <CardHeader>
                    <CardTitle>Formatos</CardTitle>
                    <CardDescription>
                      Interações médias por formato.
                    </CardDescription>
                    <CardAction>
                      <Legend hasOwn={hasOwn} />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <PairedBars
                      rows={formatRows(competitorStats, own)}
                      hasOwn={hasOwn}
                    />
                  </CardContent>
                </Card>
                <Card size='sm'>
                  <CardHeader>
                    <CardTitle>Horários</CardTitle>
                    <CardDescription>
                      Interações médias por período do dia, no horário de
                      Brasília: madrugada 0h–6h, manhã 6h–12h, tarde 12h–18h,
                      noite 18h–24h.
                    </CardDescription>
                    <CardAction>
                      <Legend hasOwn={hasOwn} />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <PairedBars
                      rows={daypartRows(competitorStats, own)}
                      hasOwn={hasOwn}
                    />
                  </CardContent>
                </Card>
                <Card size='sm'>
                  <CardHeader>
                    <CardTitle>Dias da semana</CardTitle>
                    <CardDescription>
                      Quantidade de posts por dia.
                    </CardDescription>
                    <CardAction>
                      <Legend hasOwn={hasOwn} />
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <PairedBars
                      rows={weekdayRows(competitorStats, own)}
                      hasOwn={hasOwn}
                    />
                  </CardContent>
                </Card>
                <Hashtags competitor={competitorStats} own={own} />
              </div>

              <div className='grid gap-3 lg:grid-cols-2'>
                <PostList
                  title='Posts do concorrente com mais interações'
                  posts={competitorStats.topPosts}
                />
                {own && (
                  <PostList
                    title='Seus posts com mais interações'
                    posts={own.topPosts}
                  />
                )}
              </div>
            </>
          )}

          <Ideas
            workspaceId={workspaceId}
            competitorId={competitorId}
            range={range}
            hasPosts={hasPosts}
          />
        </div>
      ) : null}
    </div>
  )
}
