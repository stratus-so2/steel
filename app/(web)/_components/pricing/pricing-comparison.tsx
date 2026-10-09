import {
  CheckIcon,
  MinusSignIcon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import { COMPETITOR_COMPARISON } from '@/src/config/competitor-comparison'
import {
  COMPARISON_TEAM_SIZE,
  formatListPrice,
  steelComparisonPlans,
  teamMonthlyCost,
} from '@/src/lib/pricing/comparison'
import type {
  ComparisonBlock,
  ComparisonCatalog,
  CompetitorPlan,
  Currency,
  FeatureSupport,
} from '@/src/schemas/competitor-comparison.schema'

const SUPPORT_LABELS: Record<FeatureSupport, string> = {
  yes: 'Sim',
  plan: 'Em alguns planos',
  addon: 'À parte',
  'no-info': 'Não informado',
}

const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

/** `2026-10` → `outubro de 2026`. */
export function formatCheckedAt(checkedAt: string): string {
  const [year, month] = checkedAt.split('-').map(Number)
  return `${MONTHS[month - 1]} de ${year}`
}

function SupportCell({ value }: { value: FeatureSupport }) {
  return (
    <span className='inline-flex items-center justify-center gap-1.5 text-sm'>
      {value === 'yes' && (
        <SteelIcon icon={CheckIcon} size={18} strokeWidth={2} aria-hidden />
      )}
      {value === 'plan' && (
        <SteelIcon icon={PlusSignIcon} size={16} strokeWidth={2} aria-hidden />
      )}
      {(value === 'addon' || value === 'no-info') && (
        <SteelIcon
          icon={MinusSignIcon}
          size={16}
          strokeWidth={2}
          className='text-muted-foreground'
          aria-hidden
        />
      )}
      <span className={cn(value === 'yes' && 'sr-only')}>
        {SUPPORT_LABELS[value]}
      </span>
    </span>
  )
}

interface CostRow {
  product: string
  plan: CompetitorPlan
  currency: Currency
  steel?: boolean
}

function costRows(block: ComparisonBlock): CostRow[] {
  return [
    ...steelComparisonPlans().map((plan) => ({
      product: 'Steel',
      plan,
      currency: 'BRL' as const,
      steel: true,
    })),
    ...block.competitors.flatMap((competitor) =>
      competitor.plans.map((plan) => ({
        product: competitor.name,
        plan,
        currency: competitor.currency,
      })),
    ),
  ]
}

function ComparisonBlockView({
  block,
  checkedAt,
}: {
  block: ComparisonBlock
  checkedAt: string
}) {
  const headingId = `comparar-${block.module}`

  return (
    <section
      aria-labelledby={headingId}
      className='flex w-full flex-col gap-6 border border-border p-4 sm:p-6'
    >
      <h3 id={headingId} className='text-2xl font-normal'>
        {block.title}
      </h3>

      <div className='relative w-full overflow-x-auto'>
        <table className='w-full min-w-[640px] border-collapse text-sm'>
          <caption className='sr-only'>
            Recursos: Steel e {block.competitors.map((c) => c.name).join(', ')}
          </caption>
          <thead>
            <tr className='border-b border-border text-left'>
              <th scope='col' className='p-3 font-medium'>
                Recurso
              </th>
              <th scope='col' className='p-3 text-center font-medium'>
                Steel
              </th>
              {block.competitors.map((competitor) => (
                <th
                  key={competitor.id}
                  scope='col'
                  className='p-3 text-center font-medium'
                >
                  {competitor.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.features.map((feature) => (
              <tr key={feature.label} className='border-b border-border'>
                <th scope='row' className='p-3 text-left font-normal'>
                  {feature.label}
                </th>
                <td className='p-3 text-center'>
                  <SupportCell value={feature.steel} />
                </td>
                {block.competitors.map((competitor) => (
                  <td key={competitor.id} className='p-3 text-center'>
                    <SupportCell value={feature.competitors[competitor.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='relative w-full overflow-x-auto'>
        <table className='w-full min-w-[640px] border-collapse text-sm'>
          <caption className='sr-only'>Preços de lista</caption>
          <thead>
            <tr className='border-b border-border text-left'>
              <th scope='col' className='p-3 font-medium'>
                Produto e plano
              </th>
              <th scope='col' className='p-3 font-medium'>
                Preço de lista (cobrança anual)
              </th>
              <th scope='col' className='p-3 font-medium'>
                Custo para uma equipe de {COMPARISON_TEAM_SIZE}, por mês
              </th>
            </tr>
          </thead>
          <tbody>
            {costRows(block).map((row) => (
              <tr
                key={`${row.product}-${row.plan.name}`}
                className={cn('border-b border-border', row.steel && 'bg-card')}
              >
                <th scope='row' className='p-3 text-left font-normal'>
                  <span className='font-medium'>{row.product}</span>{' '}
                  {row.plan.name}
                  {row.plan.note && (
                    <span className='block text-xs text-muted-foreground'>
                      {row.plan.note}
                    </span>
                  )}
                </th>
                <td className='p-3'>
                  {formatListPrice(row.plan.price, row.currency)}
                </td>
                <td className='p-3'>
                  {teamMonthlyCost(row.plan.price, row.currency) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className='flex flex-col gap-2 text-xs text-muted-foreground'>
        <p>
          Um assento do Steel inclui ServiceDesk, CRM e Comunicação. Preços de
          lista em moeda original, sem conversão de câmbio e sem impostos.
        </p>
        {block.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
        <p>
          Fontes, consultadas em {formatCheckedAt(checkedAt)}:{' '}
          {block.competitors.map((competitor, index) => (
            <span key={competitor.id}>
              {index > 0 && ' · '}
              <a
                href={competitor.sourceUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='underline underline-offset-2'
              >
                {competitor.name}
              </a>
            </span>
          ))}
          .
        </p>
      </div>
    </section>
  )
}

interface PricingComparisonProps {
  catalog?: ComparisonCatalog
}

export function PricingComparison({
  catalog = COMPETITOR_COMPARISON,
}: PricingComparisonProps) {
  return (
    <section
      id='comparar'
      aria-labelledby='comparar-titulo'
      className='flex w-full flex-col gap-6 border-x border-border px-4 py-16 sm:px-6'
    >
      <div className='flex max-w-3xl flex-col gap-3'>
        <h2 id='comparar-titulo' className='text-3xl font-normal sm:text-4xl'>
          Um workspace no lugar de três assinaturas
        </h2>
        <p className='text-muted-foreground'>
          Atendimento, vendas e WhatsApp costumam ser três contratos diferentes.
          No Steel, os três módulos ficam no mesmo workspace e no mesmo assento.
          Abaixo, os recursos e os preços de lista publicados por outros
          produtos de cada categoria.
        </p>
        <p className='text-xs text-muted-foreground'>
          Legenda: <strong>Sim</strong> = informado na página pública do
          produto; <strong>Em alguns planos</strong> = só em parte dos planos;{' '}
          <strong>À parte</strong> = vendido separadamente;{' '}
          <strong>Não informado</strong> = não consta na página pública
          consultada.
        </p>
      </div>
      {catalog.blocks.map((block) => (
        <ComparisonBlockView
          key={block.module}
          block={block}
          checkedAt={catalog.checkedAt}
        />
      ))}
    </section>
  )
}
