import { describe, expect, it } from 'vitest'
import {
  SD_CLUSTER_MAX_TERMS,
  SD_CLUSTER_MIN_TICKETS,
  type SdClusterTicketInput,
  sdClusterProblemDescription,
  sdGroupIncidents,
  sdIncidentSignature,
  sdIncidentsSince,
  sdIncidentTerms,
  sdNormalizeText,
} from '@/src/lib/servicedesk/incident-cluster'

/** Agrupamento determinístico de incidentes repetidos (ADR 0016). */

const DAY = 24 * 60 * 60 * 1000
const BASE = new Date('2026-10-02T12:00:00.000Z')

function incident(
  overrides: Partial<SdClusterTicketInput> = {},
): SdClusterTicketInput {
  return {
    id: 't1',
    title: 'Servidor de e-mail fora do ar',
    categoryId: 'cat1',
    subcategoryId: null,
    serviceId: null,
    createdAt: BASE,
    ...overrides,
  }
}

describe('sdNormalizeText', () => {
  it('should drop accents, case and punctuation', () => {
    expect(sdNormalizeText('Não há CONEXÃO (VPN)!!')).toBe('nao ha conexao vpn')
  })

  it('should collapse the blanks', () => {
    expect(sdNormalizeText('  e-mail   caiu  ')).toBe('e mail caiu')
  })
})

describe('sdIncidentTerms', () => {
  it('should keep only the significant terms, sorted', () => {
    expect(sdIncidentTerms('Servidor de e-mail fora do ar')).toEqual([
      'fora',
      'mail',
      'servidor',
    ])
  })

  it('should read the same title written in another order', () => {
    expect(sdIncidentTerms('E-mail fora do ar no servidor')).toEqual(
      sdIncidentTerms('Servidor de e-mail fora do ar'),
    )
  })

  it('should drop stopwords, short words, numbers and repetitions', () => {
    expect(
      sdIncidentTerms('URGENTE: erro no ramal 1234 do ramal da sala'),
    ).toEqual(['ramal', 'sala'])
  })

  it('should cap the number of terms in the signature', () => {
    expect(
      sdIncidentTerms(
        'impressora financeiro travada papel rede andar segundo predio',
      ),
    ).toHaveLength(SD_CLUSTER_MAX_TERMS)
  })

  it('should return nothing for a title with no signal', () => {
    expect(sdIncidentTerms('urgente!!! preciso de ajuda')).toEqual([])
  })
})

describe('sdIncidentSignature', () => {
  it('should join the catalog and the terms', () => {
    expect(
      sdIncidentSignature({
        title: 'Servidor de e-mail fora do ar',
        categoryId: 'cat1',
        subcategoryId: 'sub2',
        serviceId: 'srv3',
      }),
    ).toBe('cat1:sub2:srv3:fora-mail-servidor')
  })

  it('should mark the missing catalog levels', () => {
    expect(
      sdIncidentSignature({
        title: 'Impressora travada',
        categoryId: null,
        subcategoryId: null,
        serviceId: null,
      }),
    ).toBe('-:-:-:impressora-travada')
  })

  it('should separate tickets of different services', () => {
    const a = sdIncidentSignature({
      title: 'Impressora travada',
      categoryId: 'c',
      subcategoryId: null,
      serviceId: 's1',
    })
    const b = sdIncidentSignature({
      title: 'Impressora travada',
      categoryId: 'c',
      subcategoryId: null,
      serviceId: 's2',
    })

    expect(a).not.toBe(b)
  })

  it('should refuse a title without significant terms', () => {
    expect(
      sdIncidentSignature({
        title: 'ajuda!!',
        categoryId: 'c',
        subcategoryId: null,
        serviceId: null,
      }),
    ).toBeNull()
  })
})

describe('sdGroupIncidents', () => {
  it('should group the repeated incidents past the threshold', () => {
    const groups = sdGroupIncidents([
      incident({ id: 'a', createdAt: new Date(BASE.getTime() - 2 * DAY) }),
      incident({ id: 'b', title: 'E-mail fora do ar no servidor' }),
      incident({
        id: 'c',
        title: 'Servidor de e-mail fora',
        createdAt: new Date(BASE.getTime() - DAY),
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].ticketIds).toEqual(['a', 'c', 'b'])
    expect(groups[0].tickets).toHaveLength(3)
    expect(groups[0].title).toBe('E-mail fora do ar no servidor')
    expect(groups[0].firstSeenAt.getTime()).toBe(BASE.getTime() - 2 * DAY)
    expect(groups[0].lastSeenAt.getTime()).toBe(BASE.getTime())
  })

  it('should ignore a pair below the threshold', () => {
    const groups = sdGroupIncidents([
      incident({ id: 'a' }),
      incident({ id: 'b' }),
    ])

    expect(SD_CLUSTER_MIN_TICKETS).toBe(3)
    expect(groups).toEqual([])
  })

  it('should accept a custom threshold', () => {
    const groups = sdGroupIncidents(
      [incident({ id: 'a' }), incident({ id: 'b' })],
      2,
    )

    expect(groups).toHaveLength(1)
  })

  it('should skip the incidents with no signature', () => {
    const groups = sdGroupIncidents(
      [
        incident({ id: 'a', title: 'ajuda!!' }),
        incident({ id: 'b', title: 'ajuda!!' }),
      ],
      1,
    )

    expect(groups).toEqual([])
  })

  it('should return the most recent group first', () => {
    const groups = sdGroupIncidents(
      [
        incident({ id: 'a', title: 'Impressora travada' }),
        incident({ id: 'b', title: 'Impressora travada' }),
        incident({
          id: 'c',
          title: 'Link caiu',
          createdAt: new Date(BASE.getTime() + DAY),
        }),
        incident({
          id: 'd',
          title: 'Link caiu',
          createdAt: new Date(BASE.getTime() + DAY),
        }),
      ],
      2,
    )

    expect(groups.map((g) => g.title)).toEqual([
      'Link caiu',
      'Impressora travada',
    ])
  })
})

describe('sdIncidentsSince', () => {
  it('should count only what came after the moment', () => {
    const group = {
      tickets: [
        incident({ id: 'a', createdAt: new Date(BASE.getTime() - DAY) }),
        incident({ id: 'b', createdAt: new Date(BASE.getTime() + DAY) }),
        incident({ id: 'c', createdAt: new Date(BASE.getTime() + 2 * DAY) }),
      ],
    }

    expect(sdIncidentsSince(group, BASE)).toBe(2)
  })
})

describe('sdClusterProblemDescription', () => {
  it('should write the incidents into the problem description', () => {
    const html = sdClusterProblemDescription(
      {
        ticketIds: ['a', 'b', 'c'],
        firstSeenAt: BASE,
        lastSeenAt: BASE,
      },
      ['INC-000001', 'INC-000002', 'INC-000003'],
    )

    expect(html).toContain('3 incidentes parecidos')
    expect(html).toContain('INC-000002')
  })

  it('should fall back to the ids when no code was resolved', () => {
    const html = sdClusterProblemDescription(
      { ticketIds: ['a'], firstSeenAt: BASE, lastSeenAt: BASE },
      [],
    )

    expect(html).toContain('a')
  })
})
