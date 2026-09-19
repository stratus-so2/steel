'use client'

import { Cancel01Icon, RefreshIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  ANALYTICS_ENVIRONMENTS,
  ANALYTICS_RANGES,
  ANALYTICS_STATUS_CLASSES,
  type AnalyticsQuery,
  type AnalyticsView,
} from '@/src/schemas/admin-analytics.schema'

export interface WorkspaceOption {
  id: string
  name: string
  slug: string
}

const TABS: { view: AnalyticsView; label: string }[] = [
  { view: 'overview', label: 'Visão geral' },
  { view: 'routes', label: 'Rotas' },
  { view: 'errors', label: 'Erros' },
  { view: 'access', label: 'Acessos' },
  { view: 'jobs', label: 'Jobs' },
]

const RANGE_LABEL: Record<(typeof ANALYTICS_RANGES)[number], string> = {
  '15m': '15 min',
  '1h': '1 h',
  '24h': '24 h',
  '7d': '7 d',
  '30d': '30 d',
}

const ENV_LABEL: Record<(typeof ANALYTICS_ENVIRONMENTS)[number], string> = {
  production: 'Produção',
  development: 'Desenvolvimento',
  test: 'Teste',
}

const ALL = '__all__'

/** Monta a URL do painel trocando só as chaves informadas. */
export function analyticsHref(
  current: URLSearchParams,
  patch: Partial<Record<keyof AnalyticsQuery, string | undefined>>,
): string {
  const params = new URLSearchParams(current)
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || value === '' || value === ALL) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }
  const query = params.toString()
  return query ? `/admin/analytics?${query}` : '/admin/analytics'
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
  width = 'w-40',
}: {
  label: string
  value: string | undefined
  options: { value: string; label: string }[]
  onChange: (value: string) => void
  width?: string
}) {
  const current = options.find((o) => o.value === value)
  return (
    <Select value={value ?? ALL} onValueChange={(v) => onChange(String(v))}>
      <SelectTrigger
        size='sm'
        className={cn('min-w-0', width)}
        aria-label={label}
      >
        <span className='truncate text-xs'>
          <span className='text-muted-foreground'>{label}: </span>
          {current?.label ?? 'Todos'}
        </span>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false} className='max-h-72'>
        <SelectItem value={ALL}>Todos</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

/**
 * Abas + filtros do painel, tudo na URL (`?view=&range=&workspace=&route=
 * &status=&env=`): recarregar ou compartilhar o link mantém a visão. Cada
 * troca navega (o Server Component refaz as consultas).
 */
export function AnalyticsFilters({
  query,
  workspaces,
}: {
  query: AnalyticsQuery
  workspaces: WorkspaceOption[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  const go = (patch: Parameters<typeof analyticsHref>[1]) =>
    startTransition(() => router.push(analyticsHref(searchParams, patch)))

  const activeTab = query.view === 'route' ? 'routes' : query.view
  const hasFilters = Boolean(
    query.workspace || query.route || query.status || query.env,
  )

  return (
    <div className='space-y-3' aria-busy={pending}>
      <nav
        aria-label='Abas do Analytics'
        className='-mx-1 flex gap-1 overflow-x-auto border-border border-b px-1 [scrollbar-width:none]'
      >
        {TABS.map((tab) => (
          <Link
            key={tab.view}
            href={analyticsHref(searchParams, {
              view: tab.view,
              // O detalhe de rota é da aba Rotas; nas outras vira filtro.
              ...(tab.view === 'routes' && query.view === 'route'
                ? { route: undefined }
                : {}),
            })}
            aria-current={activeTab === tab.view ? 'page' : undefined}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-sm transition-colors',
              activeTab === tab.view
                ? 'border-foreground font-medium text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <div className='flex flex-wrap items-center gap-2'>
        <fieldset
          aria-label='Intervalo'
          className='m-0 flex min-w-0 overflow-hidden rounded-md border border-border p-0'
        >
          {ANALYTICS_RANGES.map((range) => (
            <button
              key={range}
              type='button'
              onClick={() => go({ range })}
              aria-pressed={query.range === range}
              className={cn(
                'h-7 border-border border-l px-2.5 font-mono text-xs first:border-l-0',
                query.range === range
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {RANGE_LABEL[range]}
            </button>
          ))}
        </fieldset>

        {query.view !== 'jobs' && (
          <>
            <FilterSelect
              label='Workspace'
              value={query.workspace}
              width='w-48'
              options={workspaces.map((w) => ({ value: w.id, label: w.name }))}
              onChange={(workspace) => go({ workspace })}
            />
            <FilterSelect
              label='Status'
              value={query.status}
              width='w-32'
              options={ANALYTICS_STATUS_CLASSES.map((s) => ({
                value: s,
                label: s,
              }))}
              onChange={(status) => go({ status })}
            />
            <FilterSelect
              label='Ambiente'
              value={query.env}
              options={ANALYTICS_ENVIRONMENTS.map((e) => ({
                value: e,
                label: ENV_LABEL[e],
              }))}
              onChange={(env) => go({ env })}
            />
          </>
        )}

        {query.route && query.view !== 'route' && (
          <span className='inline-flex h-7 max-w-full items-center gap-1 rounded-md border border-border bg-muted px-2 font-mono text-xs'>
            <span className='truncate' title={query.route}>
              {query.route}
            </span>
            <button
              type='button'
              aria-label='Remover filtro de rota'
              onClick={() => go({ route: undefined })}
              className='text-muted-foreground hover:text-foreground'
            >
              <SteelIcon icon={Cancel01Icon} size={12} strokeWidth={2} />
            </button>
          </span>
        )}

        <div className='ml-auto flex items-center gap-2'>
          {hasFilters && (
            <Link
              href={analyticsHref(new URLSearchParams(), {
                view: query.view === 'route' ? 'routes' : query.view,
                range: query.range,
              })}
              className='text-muted-foreground text-xs hover:text-foreground'
            >
              Limpar filtros
            </Link>
          )}
          <Button
            variant='outline'
            size='sm'
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <SteelIcon
              icon={RefreshIcon}
              strokeWidth={2}
              className={cn(pending && 'animate-spin')}
            />
            Atualizar
          </Button>
        </div>
      </div>
    </div>
  )
}
