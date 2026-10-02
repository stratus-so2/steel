import { describe, expect, it } from 'vitest'
import {
  createFakeSdIncidentCluster,
  createFakeSdRiskPrediction,
} from '@/src/__tests__/factories/sd-risk.factory'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdClusterTicketRow } from '@/src/repositories/sd-risk.repository'
import {
  toSdIncidentClusterDTO,
  toSdRiskFactorsDTO,
  toSdTicketRiskDTO,
} from '../sd-risk.mapper'

const DAY = 24 * 60 * 60 * 1000
const BASE = new Date('2026-10-02T12:00:00.000Z')

function ticketRow(
  overrides: Partial<SdClusterTicketRow> = {},
): SdClusterTicketRow {
  return {
    id: 't1',
    number: 1,
    type: 'INCIDENT',
    title: 'Servidor de e-mail fora do ar',
    createdAt: BASE,
    phase: { name: 'Em andamento', color: '#f97316', category: 'IN_PROGRESS' },
    priority: { id: 'p1', name: 'P1 – Crítica', color: '#ef4444' },
    ...overrides,
  }
}

describe('toSdRiskFactorsDTO', () => {
  it('passa os fatores conhecidos, do maior peso para o menor', () => {
    const factors = toSdRiskFactorsDTO([
      {
        key: 'unassigned',
        label: 'Sem responsável',
        weight: 12,
        detail: '3 h',
      },
      {
        key: 'sla_consumed',
        label: 'Prazo já consumido',
        weight: 30,
        detail: '82%',
      },
    ])

    expect(factors.map((f) => f.key)).toEqual(['sla_consumed', 'unassigned'])
  })

  it('descarta fator de chave desconhecida ou sem motivo', () => {
    const factors = toSdRiskFactorsDTO([
      {
        key: 'astrologia',
        label: 'Mercúrio retrógrado',
        weight: 50,
        detail: 'x',
      },
      { key: 'stale', label: 'Parado', weight: 5, detail: '   ' },
      { key: 'stale', label: 'Parado', weight: 5 },
      'não é objeto',
      null,
      { label: 'sem chave', weight: 1, detail: 'x' },
    ])

    expect(factors).toEqual([])
  })

  it('nunca deixa o peso passar do teto do fator nem ficar negativo', () => {
    const factors = toSdRiskFactorsDTO([
      { key: 'reopened', label: 'Reaberto', weight: 999, detail: 'duas vezes' },
      { key: 'history', label: 'Histórico', weight: -5, detail: 'cliente' },
    ])

    expect(factors.map((f) => f.weight)).toEqual([8, 0])
  })

  it('usa o rótulo do catálogo quando o salvo não é texto', () => {
    const factors = toSdRiskFactorsDTO([
      { key: 'priority', label: 42, weight: 12, detail: 'P1' },
    ])

    expect(factors[0].label).toBe('Prioridade alta')
  })

  it('devolve lista vazia para um json que não é array', () => {
    expect(toSdRiskFactorsDTO({ key: 'stale' })).toEqual([])
    expect(toSdRiskFactorsDTO(null)).toEqual([])
  })
})

describe('toSdTicketRiskDTO', () => {
  it('serializa a previsão com as datas em ISO', () => {
    const dto = toSdTicketRiskDTO(createFakeSdRiskPrediction())

    expect(dto).toMatchObject({ level: 'HIGH', score: 74 })
    expect(dto?.breachEtaAt).toBe('2026-10-02T18:00:00.000Z')
    expect(dto?.computedAt).toBe('2026-10-02T12:00:00.000Z')
    expect(dto?.factors).toHaveLength(1)
  })

  it('aceita previsão sem data de estouro', () => {
    const dto = toSdTicketRiskDTO(
      createFakeSdRiskPrediction({ breachEtaAt: null }),
    )

    expect(dto?.breachEtaAt).toBeNull()
  })

  it('devolve null sem previsão', () => {
    expect(toSdTicketRiskDTO(null)).toBeNull()
    expect(toSdTicketRiskDTO(undefined)).toBeNull()
  })
})

describe('toSdIncidentClusterDTO', () => {
  it('monta o grupo com os incidentes do mais recente para o mais antigo', () => {
    const dto = toSdIncidentClusterDTO(
      createFakeSdIncidentCluster({ ticketIds: ['t1', 't2'] }),
      {
        prefixes: DEFAULT_SD_TICKET_PREFIXES,
        tickets: [
          ticketRow({ id: 't1', number: 1 }),
          ticketRow({
            id: 't2',
            number: 2,
            createdAt: new Date(BASE.getTime() + DAY),
          }),
        ],
      },
    )

    expect(dto.tickets.map((t) => t.code)).toEqual(['INC-000002', 'INC-000001'])
    expect(dto.tickets[0].phase.name).toBe('Em andamento')
    expect(dto.tickets[0].priority?.name).toBe('P1 – Crítica')
    expect(dto.problemTicket).toBeNull()
    expect(dto.dismissedAt).toBeNull()
  })

  it('ignora id de chamado que não veio na consulta', () => {
    const dto = toSdIncidentClusterDTO(
      createFakeSdIncidentCluster({ ticketIds: ['t1', 'apagado'] }),
      { tickets: [ticketRow({ id: 't1' })] },
    )

    expect(dto.tickets).toHaveLength(1)
  })

  it('mostra o problema aberto a partir do grupo', () => {
    const dto = toSdIncidentClusterDTO(
      createFakeSdIncidentCluster({
        ticketIds: ['t1'],
        problemTicketId: 'prb',
      }),
      {
        tickets: [
          ticketRow({ id: 't1' }),
          ticketRow({
            id: 'prb',
            number: 7,
            type: 'PROBLEM',
            title: 'Problema no servidor de e-mail',
          }),
        ],
      },
    )

    expect(dto.problemTicket).toMatchObject({
      code: 'PRB-000007',
      type: 'PROBLEM',
    })
    // O problema não entra na lista de incidentes.
    expect(dto.tickets.map((t) => t.id)).toEqual(['t1'])
  })

  it('mostra quem descartou a sugestão', () => {
    const dto = toSdIncidentClusterDTO(
      createFakeSdIncidentCluster({
        dismissedAt: BASE,
        dismissedById: 'u1',
        dismissedBy: {
          id: 'u1',
          name: 'Ana Agente',
          email: 'ana@example.com',
          image: null,
        },
      }),
    )

    expect(dto.dismissedAt).toBe(BASE.toISOString())
    expect(dto.dismissedBy?.name).toBe('Ana Agente')
    expect(dto.tickets).toEqual([])
  })
})
