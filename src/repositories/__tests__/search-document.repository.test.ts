import { describe, expect, it, vi } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import type {
  SearchDocumentInput,
  SearchDocumentQuery,
} from '@/src/lib/search/search-document'
import {
  SEARCH_ENTITY_TYPES,
  type SearchEntityType,
} from '@/src/lib/search/search-entities'
import { codesFor, parseSearchQuery } from '@/src/lib/search/search-query'
import { rankSearchHits } from '@/src/lib/search/search-ranking'
import { SearchDocumentRepository } from '../search-document.repository'

const T = new Date('2026-10-01T00:00:00.000Z')

function doc(
  workspaceId: string,
  entityId: string,
  overrides: Partial<SearchDocumentInput> = {},
): SearchDocumentInput {
  return {
    workspaceId,
    entityType: 'crm-lead',
    entityId,
    module: 'CRM',
    audience: 'PUBLIC',
    title: entityId,
    subtitle: null,
    body: null,
    keywords: '',
    codes: [],
    userIds: [],
    path: `/x/${entityId}`,
    updatedAt: T,
    ...overrides,
  }
}

function query(
  workspaceId: string,
  q: string,
  overrides: Partial<SearchDocumentQuery> = {},
): SearchDocumentQuery {
  const parsed = parseSearchQuery(q)
  return {
    workspaceId,
    userId: 'u1',
    text: parsed.text,
    codes: parsed.codes,
    tsquery: parsed.tsquery,
    types: [...SEARCH_ENTITY_TYPES],
    isSdAgent: true,
    candidateLimit: 50,
    ...overrides,
  }
}

async function ids(q: SearchDocumentQuery): Promise<string[]> {
  const hits = expectOk(await SearchDocumentRepository.search(q))
  return rankSearchHits(
    hits.map((h) => ({
      ...h,
      signals: {
        exact: h.exact,
        titlePrefix: h.titlePrefix,
        titlePhrase: h.titlePhrase,
        textRank: h.textRank,
        similarity: h.similarity,
        updatedAt: h.updatedAt,
        isMine: h.isMine,
      },
    })),
    new Date(),
    20,
  ).map((h) => h.entityId)
}

describe('SearchDocumentRepository', () => {
  it('should rank the exact ticket code above fuzzy and text matches', async () => {
    const ws = await seedWorkspace()
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'ticket', {
          entityType: 'sd-ticket',
          module: 'SERVICE_DESK',
          audience: 'PARTIES',
          title: 'Impressora parada',
          keywords: 'INC-000123 123',
          codes: codesFor(['INC-000123', '123']),
        }),
        doc(ws.id, 'other', {
          entityType: 'sd-ticket',
          module: 'SERVICE_DESK',
          title: 'Chamado inc 000123 duplicado',
          keywords: 'INC-000124 124',
          codes: codesFor(['INC-000124', '124']),
        }),
      ]),
    )

    expect((await ids(query(ws.id, 'INC-000123')))[0]).toBe('ticket')
    expect((await ids(query(ws.id, '#123')))[0]).toBe('ticket')
    expect((await ids(query(ws.id, 'inc123')))[0]).toBe('ticket')
  })

  it('should match accents, prefixes, stems and typos', async () => {
    const ws = await seedWorkspace()
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'agro', {
          title: 'Agro Telecom',
          entityType: 'crm-company',
        }),
        doc(ws.id, 'agronomia', {
          title: 'Consultoria em agronomia',
          entityType: 'crm-company',
        }),
        doc(ws.id, 'chamado', {
          title: 'Abrir chamado da impressão',
          entityType: 'sd-ticket',
          module: 'SERVICE_DESK',
        }),
        doc(ws.id, 'body', {
          title: 'Sem relação',
          body: 'O cliente relatou que a impressora não imprime',
        }),
      ]),
    )

    // Prefix on the title wins over a word in the middle.
    const agro = await ids(query(ws.id, 'agro'))
    expect(agro[0]).toBe('agro')
    expect(agro).toContain('agronomia')
    // Accent-insensitive + stemming.
    expect(await ids(query(ws.id, 'impressao'))).toContain('chamado')
    expect(await ids(query(ws.id, 'imprimem'))).toContain('body')
    // Typo tolerance (trigram word similarity).
    expect(await ids(query(ws.id, 'chamdo'))).toEqual(['chamado'])
    expect(await ids(query(ws.id, 'agor telecom'))).toContain('agro')
    // Nothing related.
    expect(await ids(query(ws.id, 'xyzxyz'))).toEqual([])
    // Only punctuation: no tsquery, matching falls back to codes/trigrams.
    expect(await ids(query(ws.id, '!!'))).toEqual([])
  })

  it('should boost records of the user inside the same tier', async () => {
    const ws = await seedWorkspace()
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'theirs', { title: 'Proposta Agro' }),
        doc(ws.id, 'mine', { title: 'Proposta Agro', userIds: ['u1'] }),
      ]),
    )
    expect(await ids(query(ws.id, 'proposta'))).toEqual(['mine', 'theirs'])
  })

  it('should filter by allowed types, audience and workspace', async () => {
    const [ws, other] = await Promise.all([seedWorkspace(), seedWorkspace()])
    const sd = { module: 'SERVICE_DESK' as const }
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'lead', { title: 'Servidor lead' }),
        doc(ws.id, 'internal', {
          ...sd,
          entityType: 'sd-kb-article',
          audience: 'AGENTS',
          title: 'Servidor interno',
        }),
        doc(ws.id, 'portal', {
          ...sd,
          entityType: 'sd-kb-article',
          audience: 'PUBLIC',
          title: 'Servidor portal',
        }),
        doc(ws.id, 'own-ticket', {
          ...sd,
          entityType: 'sd-ticket',
          audience: 'PARTIES',
          title: 'Servidor caiu',
          userIds: ['u1'],
        }),
        doc(ws.id, 'their-ticket', {
          ...sd,
          entityType: 'sd-ticket',
          audience: 'PARTIES',
          title: 'Servidor lento',
          userIds: ['u2'],
        }),
        doc(other.id, 'foreign', { title: 'Servidor de outro workspace' }),
      ]),
    )

    const requester = await ids(
      query(ws.id, 'servidor', {
        isSdAgent: false,
        types: ['sd-ticket', 'sd-kb-article'] as SearchEntityType[],
      }),
    )
    expect(requester.sort()).toEqual(['own-ticket', 'portal'])

    const agent = await ids(query(ws.id, 'servidor'))
    expect(agent.sort()).toEqual([
      'internal',
      'lead',
      'own-ticket',
      'portal',
      'their-ticket',
    ])

    expect(await ids(query(ws.id, 'servidor', { types: [] }))).toEqual([])
    expect(await ids(query(ws.id, '', {}))).toEqual([])
  })

  it('should refresh a document on upsert and remove it', async () => {
    const ws = await seedWorkspace()
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'l1', { title: 'Nome antigo' }),
      ]),
    )
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'l1', { title: 'Nome novo' }),
      ]),
    )
    expect(await ids(query(ws.id, 'antigo'))).toEqual([])
    expect(await ids(query(ws.id, 'novo'))).toEqual(['l1'])

    expect(
      expectOk(
        await SearchDocumentRepository.removeMany(ws.id, 'crm-lead', ['l1']),
      ),
    ).toBe(1)
    expect(await ids(query(ws.id, 'novo'))).toEqual([])
    expect(
      expectOk(
        await SearchDocumentRepository.removeMany(ws.id, 'crm-lead', []),
      ),
    ).toBe(0)
    expect(expectOk(await SearchDocumentRepository.upsertMany([]))).toBe(0)
  })

  it('should drop only documents indexed before the cutoff', async () => {
    const ws = await seedWorkspace()
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'old', { title: 'Velho' }),
      ]),
    )
    const cutoff = expectOk(await SearchDocumentRepository.now())
    expectOk(
      await SearchDocumentRepository.upsertMany([
        doc(ws.id, 'new', { title: 'Velho novo' }),
      ]),
    )

    expect(
      expectOk(
        await SearchDocumentRepository.removeStale(ws.id, 'crm-lead', cutoff),
      ),
    ).toBe(1)
    expect(await ids(query(ws.id, 'velho'))).toEqual(['new'])
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await SearchDocumentRepository.upsertMany([doc('missing-ws', 'x')]),
      'DATABASE_ERROR',
    )
    const ws = await seedWorkspace()
    expectErr(
      await SearchDocumentRepository.search({
        ...query(ws.id, 'x'),
        tsquery: 'broken &',
      }),
      'DATABASE_ERROR',
    )
    const exec = vi
      .spyOn(prisma, '$executeRaw')
      .mockRejectedValue(new Error('down'))
    expectErr(
      await SearchDocumentRepository.removeMany(ws.id, 'crm-lead', ['x']),
      'DATABASE_ERROR',
    )
    expectErr(
      await SearchDocumentRepository.removeStale(ws.id, 'crm-lead', new Date()),
      'DATABASE_ERROR',
    )
    exec.mockRestore()
    const raw = vi.spyOn(prisma, '$queryRaw').mockRejectedValue(new Error('x'))
    expectErr(await SearchDocumentRepository.now(), 'DATABASE_ERROR')
    raw.mockRestore()
  })
})
