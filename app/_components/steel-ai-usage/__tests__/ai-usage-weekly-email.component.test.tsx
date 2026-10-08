import { render } from 'react-email'
import { describe, expect, it } from 'vitest'
import {
  AiUsageWeekly,
  type AiUsageWeeklyEmailProps,
} from '@/components/emails/steel-ai/ai-usage-weekly'

const base = AiUsageWeekly.PreviewProps

function props(
  overrides: Partial<AiUsageWeeklyEmailProps['report']> = {},
  rest: Partial<AiUsageWeeklyEmailProps> = {},
): AiUsageWeeklyEmailProps {
  return { ...base, ...rest, report: { ...base.report, ...overrides } }
}

async function text(input: AiUsageWeeklyEmailProps): Promise<string> {
  return render(<AiUsageWeekly {...input} />, { plainText: true })
}

async function html(input: AiUsageWeeklyEmailProps): Promise<string> {
  return render(<AiUsageWeekly {...input} />)
}

describe('<AiUsageWeekly /> e-mail', () => {
  it('renders the week spend, the change and the month progress in pt-BR', async () => {
    const out = await text(props())
    expect(out).toContain('Consumo do Steel AI na semana')
    expect(out).toContain('Olá, Ana.')
    expect(out).toContain('Stratus')
    expect(out).toContain('28/09 – 04/10')
    expect(out).toMatch(/US\$\s18,42/)
    expect(out).toMatch(/▲ \+30,6% em relação à semana anterior: US\$\s14,10/)
    expect(out).toContain('Mês de outubro, até 04/10')
    expect(out).toMatch(/de US\$\s50,00 da cota mensal \(22,6%\)/)
    expect(out).toMatch(/o mês deve fechar em US\$\s87,58/)
    expect(out).toContain('Atenção: a projeção passa da cota.')
  })

  it('lists the tops and the Steel Agents activity', async () => {
    const out = await text(props())
    expect(out).toContain('Modelos que mais gastaram')
    expect(out).toContain('1. Claude Sonnet')
    expect(out).toContain('Recursos que mais gastaram')
    expect(out).toContain('Por módulo')
    expect(out).toContain('Pessoas que mais usaram')
    expect(out).toContain('bruno@example.com')
    expect(out).toContain('42 execuções e 17 ações executadas na semana.')
    expect(out).toContain(
      '3 aprovações aguardando decisão na caixa de entrada.',
    )
  })

  it('links the CTAs and the opt-out to absolute URLs', async () => {
    const out = await html(props())
    expect(out).toContain(
      'href="https://steel.stratustelecom.com.br/stratus/ai/usage"',
    )
    expect(out).toContain(
      'href="https://steel.stratustelecom.com.br/stratus/ai/analytics"',
    )
    expect(out).toContain(
      'href="https://steel.stratustelecom.com.br/stratus/settings/steel-intelligence"',
    )
    expect(out).toContain('Ver o uso')
    expect(out).toContain('Abrir as análises')
    expect(out).toContain('lang="pt-BR"')
  })

  it('describes a drop, a closed month and singular agent counts', async () => {
    const out = await text(
      props(
        {
          weekUsd: 5,
          previousWeekUsd: 10,
          changePercent: -50,
          month: {
            ...base.report.month,
            start: '2026-09-01T00:00:00.000Z',
            asOf: '2026-09-30',
            days: 30,
            elapsedDays: 30,
            usedUsd: 40,
            usedShare: 0.8,
            projectedUsd: 40,
            projectionExceedsQuota: false,
          },
          agents: { runs: 1, actions: 1, pendingApprovals: 1 },
          topMembers: [],
        },
        { username: undefined },
      ),
    )
    expect(out).not.toContain('Olá,')
    expect(out).toMatch(/▼ −50% em relação à semana anterior/)
    expect(out).toContain('Mês de setembro (fechado)')
    expect(out).not.toContain('No ritmo atual')
    expect(out).not.toContain('Atenção')
    expect(out).toContain('1 execução e 1 ação executada na semana.')
    expect(out).toContain('1 aprovação aguardando decisão')
    expect(out).toContain('Só automações usaram IA nesta semana.')
  })

  it('handles no comparison base, a flat week, no quota and no agents', async () => {
    const noBase = await text(
      props({ previousWeekUsd: 0, changePercent: null, agents: null }),
    )
    expect(noBase).toContain('Sem consumo na semana anterior para comparar.')
    expect(noBase).not.toContain('na semana.')

    const flat = await text(
      props({
        changePercent: 0,
        previousWeekUsd: 18.42,
        agents: { runs: 2, actions: 0, pendingApprovals: 0 },
      }),
    )
    expect(flat).toMatch(/Igual à semana anterior: US\$\s18,42/)
    expect(flat).not.toContain('aguardando decisão')

    const noQuota = await text(
      props({
        month: {
          ...base.report.month,
          quotaUsd: 0,
          usedShare: null,
          projectionExceedsQuota: false,
        },
        topModels: [],
      }),
    )
    expect(noQuota).toContain('sem cota mensal definida')
    expect(noQuota).toContain('Nenhum consumo nesta semana.')
  })

  it('paints the quota bar by how much is used', async () => {
    const at = (usedShare: number) =>
      html(props({ month: { ...base.report.month, usedShare } }))
    expect(await at(0)).not.toContain('width:0%')
    expect(await at(0.5)).toContain('background-color:#2893cc')
    expect(await at(0.9)).toContain('background-color:#d97706')
    const full = await at(1.2)
    expect(full).toContain('width:100%')
    expect(full).toContain('background-color:#dc2626')
  })
})
