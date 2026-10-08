'use client'

import { Download01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { type ReactNode, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  productivityExportUrl,
  useProductivity,
  type WorklogPeriodFilter,
} from '@/src/hooks/use-worklogs'
import type {
  IndicatorSetDTO,
  ProductivityDTO,
  ProductivityTrendWeekDTO,
} from '@/types/worklog'
import { isPeriodReady, PeriodFilter, PersonFilter } from './worklog-filters'
import {
  formatDayKey,
  formatDayMonth,
  formatDecimal,
  formatHours,
  formatInteger,
  formatMinutes,
  formatMoney,
  formatPercent,
} from './worklog-format'

/**
 * Tab "Produtividade": separate indicators — no combined score and no
 * ranking (people are listed alphabetically and the table is not
 * sortable). Members only ever receive their own numbers from the API.
 */

interface Indicator {
  key: string
  label: string
  hint: string
  /** `null` = the module of this indicator is off. */
  value: (set: IndicatorSetDTO) => string | null
}

interface Group {
  title: string
  indicators: Indicator[]
}

const sd =
  (fn: (s: NonNullable<IndicatorSetDTO['serviceDesk']>) => string) =>
  (set: IndicatorSetDTO) =>
    set.serviceDesk ? fn(set.serviceDesk) : null

export const INDICATOR_GROUPS: Group[] = [
  {
    title: 'Esforço',
    indicators: [
      {
        key: 'hours',
        label: 'Horas registradas',
        hint: 'Soma dos apontamentos fechados nos chamados.',
        value: sd((s) => formatHours(s.loggedMinutes)),
      },
      {
        key: 'utilization',
        label: 'Utilização',
        hint: 'Horas registradas ÷ horas de expediente do período até hoje.',
        value: sd((s) => formatPercent(s.utilization)),
      },
    ],
  },
  {
    title: 'Faturamento',
    indicators: [
      {
        key: 'billable',
        label: 'Horas faturáveis',
        hint: 'Parte das horas registradas marcada como faturável.',
        value: sd((s) => formatPercent(s.billableShare)),
      },
      {
        key: 'billed',
        label: 'Valor faturado',
        hint: 'Valor apurado dos apontamentos faturáveis (contratos).',
        value: sd((s) => formatMoney(s.billedAmount)),
      },
    ],
  },
  {
    title: 'Volume',
    indicators: [
      {
        key: 'tickets',
        label: 'Chamados resolvidos',
        hint: 'Chamados do responsável resolvidos no período (ServiceDesk).',
        value: sd((s) => formatInteger(s.ticketsResolved)),
      },
      {
        key: 'tasks',
        label: 'Tarefas concluídas',
        hint: 'Tarefas do CRM marcadas como concluídas no período.',
        value: (set) =>
          set.crm ? formatInteger(set.crm.tasksCompleted) : null,
      },
      {
        key: 'won',
        label: 'Negócios ganhos',
        hint: 'Oportunidades do CRM em etapa de ganho com fechamento no período.',
        value: (set) =>
          set.crm
            ? `${formatInteger(set.crm.opportunitiesWon)} · ${formatMoney(set.crm.wonAmount)}`
            : null,
      },
      {
        key: 'conversations',
        label: 'Conversas atendidas',
        hint: 'Conversas do WhatsApp em que a pessoa respondeu (sem contar a IA).',
        value: (set) =>
          set.communication
            ? formatInteger(set.communication.conversationsHandled)
            : null,
      },
    ],
  },
  {
    title: 'Eficiência',
    indicators: [
      {
        key: 'per-ticket',
        label: 'Horas por chamado resolvido',
        hint: 'Tempo apontado nos chamados resolvidos ÷ quantidade.',
        value: sd((s) => formatMinutes(s.minutesPerResolvedTicket)),
      },
      {
        key: 'first-response',
        label: 'Primeira resposta (média)',
        hint: 'Da abertura à primeira resposta, em horas úteis.',
        value: sd((s) => formatMinutes(s.avgFirstResponseMinutes)),
      },
      {
        key: 'resolution',
        label: 'Resolução (média)',
        hint: 'Da abertura à resolução, em horas úteis.',
        value: sd((s) => formatMinutes(s.avgResolutionMinutes)),
      },
    ],
  },
  {
    title: 'Qualidade',
    indicators: [
      {
        key: 'sla',
        label: 'Dentro do SLA',
        hint: 'Chamados resolvidos com prazo que cumpriram resposta e resolução.',
        value: sd((s) => formatPercent(s.slaCompliance)),
      },
      {
        key: 'reopen',
        label: 'Reabertura',
        hint: 'Chamados resolvidos que já foram reabertos.',
        value: sd((s) => formatPercent(s.reopenRate)),
      },
    ],
  },
  {
    title: 'Confiabilidade dos dados',
    indicators: [
      {
        key: 'timer',
        label: 'Horas pelo cronômetro',
        hint: 'Parte das horas apontadas com o cronômetro (o resto é manual).',
        value: sd((s) => formatPercent(s.timerShare)),
      },
      {
        key: 'gaps',
        label: 'Dias úteis sem registro',
        hint: 'Dias de expediente sem nenhum apontamento (equipe: média por pessoa).',
        value: sd((s) =>
          s.daysWithoutEntries === null
            ? '—'
            : `${formatDecimal(s.daysWithoutEntries)} de ${s.businessDays}`,
        ),
      },
    ],
  },
]

function IndicatorTile({
  indicator,
  current,
  previous,
}: {
  indicator: Indicator
  current: string
  previous: string | null
}) {
  return (
    <div className='min-w-0 rounded-xl border border-border/80 bg-card px-4 py-3'>
      <p className='text-muted-foreground text-xs'>{indicator.label}</p>
      <p className='mt-1 break-words font-semibold text-xl'>{current}</p>
      <p className='mt-0.5 text-muted-foreground text-xs'>
        Período anterior: {previous ?? '—'}
      </p>
      <p className='mt-1 text-muted-foreground text-xs'>{indicator.hint}</p>
    </div>
  )
}

function Indicators({
  current,
  previous,
}: {
  current: IndicatorSetDTO
  previous: IndicatorSetDTO
}) {
  const groups = INDICATOR_GROUPS.map((group) => ({
    ...group,
    indicators: group.indicators.filter(
      (indicator) => indicator.value(current) !== null,
    ),
  })).filter((group) => group.indicators.length > 0)

  if (groups.length === 0) {
    return (
      <p className='rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground text-sm'>
        Nenhum módulo com indicadores está habilitado neste workspace.
      </p>
    )
  }
  return (
    <div className='space-y-5'>
      {groups.map((group) => (
        <section key={group.title} className='space-y-2'>
          <h3 className='font-medium text-sm'>{group.title}</h3>
          <div className='grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
            {group.indicators.map((indicator) => (
              <IndicatorTile
                key={indicator.key}
                indicator={indicator}
                current={indicator.value(current) as string}
                previous={indicator.value(previous)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

const TREND_COLUMNS: {
  key: Exclude<keyof ProductivityTrendWeekDTO, 'weekStart'>
  label: string
  format: (value: number) => string
}[] = [
  { key: 'loggedMinutes', label: 'Horas', format: formatHours },
  { key: 'ticketsResolved', label: 'Chamados', format: formatInteger },
  { key: 'tasksCompleted', label: 'Tarefas', format: formatInteger },
  { key: 'opportunitiesWon', label: 'Negócios', format: formatInteger },
  { key: 'conversationsHandled', label: 'Conversas', format: formatInteger },
]

function Trend({ weeks }: { weeks: ProductivityTrendWeekDTO[] }) {
  const columns = TREND_COLUMNS.filter((column) =>
    weeks.some((week) => week[column.key] !== null),
  )
  if (weeks.length === 0 || columns.length === 0) return null
  return (
    <section className='space-y-2'>
      <h3 className='font-medium text-sm'>Semana a semana</h3>
      <div className='overflow-x-auto rounded-xl border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b text-left text-muted-foreground text-xs'>
              <th className='px-3 py-2 font-normal'>Semana de</th>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className='px-3 py-2 text-right font-normal'
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.weekStart} className='border-b last:border-0'>
                <td className='whitespace-nowrap px-3 py-2'>
                  {formatDayMonth(week.weekStart)}
                </td>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className='whitespace-nowrap px-3 py-2 text-right tabular-nums'
                  >
                    {column.format(week[column.key] ?? 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

const PEOPLE_COLUMNS = [
  'hours',
  'utilization',
  'billable',
  'tickets',
  'tasks',
  'conversations',
  'sla',
  'gaps',
]

function PeopleTable({
  dto,
  onPick,
}: {
  dto: ProductivityDTO
  onPick: (userId: string) => void
}) {
  const indicators = INDICATOR_GROUPS.flatMap((g) => g.indicators).filter(
    (indicator) =>
      PEOPLE_COLUMNS.includes(indicator.key) &&
      dto.people.some((p) => indicator.value(p.current) !== null),
  )
  return (
    <section className='space-y-2'>
      <h3 className='font-medium text-sm'>Por pessoa</h3>
      <p className='text-muted-foreground text-xs'>
        Em ordem alfabética. Clique numa pessoa para ver todos os indicadores
        dela.
      </p>
      <div className='overflow-x-auto rounded-xl border'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b text-left text-muted-foreground text-xs'>
              <th className='px-3 py-2 font-normal'>Pessoa</th>
              {indicators.map((indicator) => (
                <th
                  key={indicator.key}
                  className='px-3 py-2 text-right font-normal'
                >
                  {indicator.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dto.people.map((person) => (
              <tr key={person.user.id} className='border-b last:border-0'>
                <td className='px-3 py-2'>
                  <button
                    type='button'
                    className='text-left hover:underline'
                    onClick={() => onPick(person.user.id)}
                  >
                    {person.user.name}
                  </button>
                </td>
                {indicators.map((indicator) => (
                  <td
                    key={indicator.key}
                    className='whitespace-nowrap px-3 py-2 text-right tabular-nums'
                  >
                    {indicator.value(person.current) ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function Subject({ dto }: { dto: ProductivityDTO }): ReactNode {
  if (dto.team) {
    return (
      <Indicators current={dto.team.current} previous={dto.team.previous} />
    )
  }
  const person = dto.people[0]
  return person ? (
    <Indicators current={person.current} previous={person.previous} />
  ) : null
}

export function ProductivityPanel({ workspaceId }: { workspaceId: string }) {
  const [filter, setFilter] = useState<WorklogPeriodFilter>({
    period: 'last_30_days',
  })
  const ready = isPeriodReady(filter)
  const query = useProductivity(workspaceId, filter, ready)
  const dto = query.data

  return (
    <div className='space-y-5'>
      <div className='flex flex-wrap items-end gap-2'>
        <PeriodFilter
          value={filter}
          onChange={setFilter}
          idPrefix='productivity'
        />
        {dto?.members ? (
          <PersonFilter
            people={dto.members}
            value={filter.userId}
            onChange={(userId) => setFilter({ ...filter, userId })}
            allLabel='Equipe inteira'
          />
        ) : null}
        <Button
          variant='outline'
          className='w-full sm:ml-auto sm:w-auto'
          nativeButton={false}
          render={
            <a href={productivityExportUrl(workspaceId, filter)} download />
          }
          aria-disabled={!ready}
        >
          <SteelIcon icon={Download01Icon} size={14} />
          Baixar CSV
        </Button>
      </div>

      <div className='rounded-lg border border-dashed px-4 py-3 text-muted-foreground text-xs'>
        Indicadores separados, sem nota geral e sem ranking. Vêm só do que as
        pessoas já registram no trabalho — apontamentos, chamados, tarefas,
        negócios e respostas no WhatsApp. Não há monitoramento de tela, teclado
        ou tempo ocioso.
        {dto
          ? dto.canViewTeam
            ? ' Dono e administradores veem a equipe; cada membro vê só os próprios números.'
            : ' Você vê só os seus números.'
          : null}
      </div>

      {query.isError ? (
        <p className='text-destructive text-sm'>{query.error.message}</p>
      ) : !dto ? (
        <div
          className='grid gap-3 sm:grid-cols-2'
          data-testid='productivity-loading'
        >
          <Skeleton className='h-24 w-full' />
          <Skeleton className='h-24 w-full' />
        </div>
      ) : (
        <>
          <p className='text-muted-foreground text-xs'>
            {dto.team
              ? `Equipe (${formatInteger(dto.team.people)} pessoas)`
              : (dto.people[0]?.user.name ?? '')}{' '}
            · {formatDayKey(dto.period.from)} a {formatDayKey(dto.period.to)},
            comparado com {formatDayKey(dto.period.previousFrom)} a{' '}
            {formatDayKey(dto.period.previousTo)} · expediente:{' '}
            {dto.calendar.name}
          </p>
          <Subject dto={dto} />
          <Trend weeks={dto.trend} />
          {dto.team ? (
            <PeopleTable
              dto={dto}
              onPick={(userId) => setFilter({ ...filter, userId })}
            />
          ) : null}
        </>
      )}
    </div>
  )
}
