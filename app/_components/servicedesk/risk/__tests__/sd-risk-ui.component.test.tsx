import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import type { SdIncidentClusterDTO, SdTicketRiskDTO } from '@/types/sd-risk'
import { SdIncidentClusters } from '../sd-incident-clusters'
import {
  SD_RISK_TONE,
  SdRiskBadge,
  SdRiskFactorList,
  SdRiskWidget,
  sdRiskReason,
} from '../sd-risk-badge'

const WS = 'ws-1'
const SLUG = 'acme'
const NOW = new Date('2026-10-02T12:00:00.000Z')

function risk(overrides: Partial<SdTicketRiskDTO> = {}): SdTicketRiskDTO {
  return {
    level: 'HIGH',
    score: 74,
    factors: [
      {
        key: 'sla_consumed',
        label: 'Prazo já consumido',
        weight: 30,
        detail: '82% do prazo de resolução consumido (em horário útil)',
      },
      {
        key: 'unassigned',
        label: 'Sem responsável',
        weight: 12,
        detail: 'Sem responsável há 3 h',
      },
    ],
    breachEtaAt: '2026-10-02T15:00:00.000Z',
    computedAt: NOW.toISOString(),
    ...overrides,
  }
}

function cluster(
  overrides: Partial<SdIncidentClusterDTO> = {},
): SdIncidentClusterDTO {
  return {
    id: 'c1',
    signature: 'cat:-:-:fora-mail-servidor',
    title: 'Servidor de e-mail fora do ar',
    ticketCount: 3,
    firstSeenAt: '2026-09-29T12:00:00.000Z',
    lastSeenAt: NOW.toISOString(),
    tickets: [
      {
        id: 't1',
        number: 1,
        code: 'INC-000001',
        title: 'Servidor de e-mail fora do ar',
        phase: { name: 'Novo', color: null, category: 'NEW' },
        priority: null,
        createdAt: NOW.toISOString(),
      },
    ],
    problemTicket: null,
    dismissedAt: null,
    dismissedBy: null,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

describe('sdRiskReason', () => {
  it('junta os primeiros motivos numa frase', () => {
    expect(sdRiskReason(risk().factors)).toBe(
      '82% do prazo de resolução consumido (em horário útil) · Sem responsável há 3 h',
    )
  })

  it('limita quantos motivos entram', () => {
    expect(sdRiskReason(risk().factors, 1)).not.toContain('Sem responsável')
  })
})

describe('SdRiskBadge', () => {
  it('mostra a faixa, a nota e o motivo (nunca a nota sozinha)', () => {
    render(<SdRiskBadge risk={risk()} />)

    expect(screen.getByText('Risco alto · 74')).toBeTruthy()
    expect(
      screen.getByText(/Risco alto, nota 74 de 100: 82% do prazo/),
    ).toBeTruthy()
  })

  it('mostra só a nota no modo compacto, sem perder o motivo', () => {
    render(<SdRiskBadge risk={risk()} compact />)

    expect(screen.getByText('74')).toBeTruthy()
    expect(screen.getByText(/Sem responsável há 3 h/)).toBeTruthy()
  })

  it('não desenha selo sem previsão, sem motivo ou na faixa baixa', () => {
    const { container: empty } = render(<SdRiskBadge risk={null} />)
    expect(empty.innerHTML).toBe('')

    const { container: noReason } = render(
      <SdRiskBadge risk={risk({ factors: [] })} />,
    )
    expect(noReason.innerHTML).toBe('')

    const { container: low } = render(
      <SdRiskBadge risk={risk({ level: 'LOW', score: 12 })} />,
    )
    expect(low.innerHTML).toBe('')
  })

  it('desenha a faixa baixa quando a tela pede', () => {
    render(<SdRiskBadge risk={risk({ level: 'LOW', score: 12 })} showLow />)

    expect(screen.getByText('Risco baixo · 12')).toBeTruthy()
  })

  it('usa a cor da faixa e expõe o nível no dataset', () => {
    const { container } = render(<SdRiskBadge risk={risk()} />)
    const badge = container.querySelector('[data-risk-level="HIGH"]')

    expect(badge).not.toBeNull()
    expect(badge?.className).toContain('text-rose-700')
    // Legível no escuro (modo TV) e no claro.
    expect(SD_RISK_TONE.HIGH).toContain('dark:text-rose-300')
    expect(SD_RISK_TONE.MEDIUM).toContain('dark:text-amber-300')
    expect(SD_RISK_TONE.LOW).toContain('dark:text-emerald-300')
  })
})

describe('SdRiskFactorList', () => {
  it('lista cada fator com a frase e os pontos', () => {
    render(<SdRiskFactorList factors={risk().factors} />)

    expect(screen.getByText('Prazo já consumido')).toBeTruthy()
    expect(screen.getByText('+30')).toBeTruthy()
    expect(screen.getByText('+12')).toBeTruthy()
  })

  it('não desenha nada sem fator', () => {
    const { container } = render(<SdRiskFactorList factors={[]} />)

    expect(container.innerHTML).toBe('')
  })
})

describe('SdRiskWidget', () => {
  it('abre a nota, a previsão de estouro e os fatores', () => {
    render(<SdRiskWidget risk={risk()} now={NOW} />)

    expect(screen.getByLabelText('Risco preditivo')).toBeTruthy()
    expect(screen.getByText('74/100')).toBeTruthy()
    expect(screen.getByText('estoura em 3 h')).toBeTruthy()
    expect(screen.getByText(/Sem responsável há 3 h/)).toBeTruthy()
    expect(screen.getByText(/alto a partir de 70/)).toBeTruthy()
  })

  it('diz que não há fator quando a nota é zero', () => {
    render(
      <SdRiskWidget
        risk={risk({ level: 'LOW', score: 0, factors: [], breachEtaAt: null })}
        now={NOW}
      />,
    )

    expect(
      screen.getByText('Nenhum fator de risco neste chamado.'),
    ).toBeTruthy()
  })

  it('não desenha nada sem previsão', () => {
    const { container } = render(<SdRiskWidget risk={null} />)

    expect(container.innerHTML).toBe('')
  })
})

describe('SdIncidentClusters', () => {
  it('lista o grupo com os incidentes e as duas ações do agente', async () => {
    mockFetch([
      {
        match: '/servicedesk/risk/clusters',
        data: [cluster()],
      },
    ])
    renderWithQuery(<SdIncidentClusters workspaceId={WS} slug={SLUG} />)

    expect(await screen.findByText('3 incidentes')).toBeTruthy()
    expect(screen.getAllByText('Servidor de e-mail fora do ar')).toHaveLength(2)
    expect(screen.getByText('INC-000001')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Abrir problema/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Descartar/ })).toBeTruthy()
  })

  it('mostra o problema já aberto em vez das ações', async () => {
    mockFetch([
      {
        match: '/servicedesk/risk/clusters',
        data: [
          cluster({
            problemTicket: {
              id: 'prb',
              number: 7,
              code: 'PRB-000007',
              title: 'Causa raiz',
              type: 'PROBLEM',
            },
          }),
        ],
      },
    ])
    renderWithQuery(<SdIncidentClusters workspaceId={WS} slug={SLUG} />)

    expect(await screen.findByText('PRB-000007')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Abrir problema/ })).toBeNull()
  })

  it('mostra quem descartou a sugestão', async () => {
    mockFetch([
      {
        match: '/servicedesk/risk/clusters',
        data: [
          cluster({
            dismissedAt: NOW.toISOString(),
            dismissedBy: {
              id: 'u1',
              name: 'Ana Agente',
              email: 'ana@example.com',
              image: null,
            },
          }),
        ],
      },
    ])
    renderWithQuery(<SdIncidentClusters workspaceId={WS} slug={SLUG} />)

    expect(await screen.findByText(/Descartado por Ana Agente/)).toBeTruthy()
  })

  it('explica a régua quando não há incidente repetido', async () => {
    mockFetch([{ match: '/servicedesk/risk/clusters', data: [] }])
    renderWithQuery(<SdIncidentClusters workspaceId={WS} slug={SLUG} />)

    await waitFor(() =>
      expect(screen.getByText('Nenhum incidente repetido')).toBeTruthy(),
    )
    expect(screen.getByText(/três ocorrências/)).toBeTruthy()
  })
})
