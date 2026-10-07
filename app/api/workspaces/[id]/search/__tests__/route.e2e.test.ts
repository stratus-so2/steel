import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import type { SearchDocumentInput } from '@/src/lib/search/search-document'
import { codesFor } from '@/src/lib/search/search-query'
import { SearchDocumentRepository } from '@/src/repositories/search-document.repository'

const url = (ws: string, qs: string) => `/api/workspaces/${ws}/search?${qs}`

function doc(
  workspaceId: string,
  overrides: Partial<SearchDocumentInput>,
): SearchDocumentInput {
  return {
    workspaceId,
    entityType: 'sd-ticket',
    entityId: 'x',
    module: 'SERVICE_DESK',
    audience: 'PARTIES',
    title: 'x',
    subtitle: null,
    body: null,
    keywords: '',
    codes: [],
    userIds: [],
    path: '/servicedesk/tickets/1',
    updatedAt: new Date(),
    ...overrides,
  }
}

async function searchUntil(
  path: string,
  cookie: string,
  done: (ids: string[]) => boolean,
) {
  let ids: string[] = []
  for (let i = 0; i < 20; i++) {
    const res = await getJson(path, cookie)
    const body = await res.json()
    ids = body.data.results.map((r: { id: string }) => r.id)
    if (done(ids)) return body.data
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`search never matched: ${ids.join(',')}`)
}

describe('GET /api/workspaces/[id]/search', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}/api/workspaces/x/search?q=a`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-member and 422 for bad params', async () => {
    const { user, workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    expect(
      (await getJson(url(workspace.id, 'q=agro'), stranger.cookie)).status,
    ).toBe(403)
    expect((await getJson(url(workspace.id, 'q='), user.cookie)).status).toBe(
      422,
    )
    expect(
      (await getJson(url(workspace.id, 'q=a&types=nope'), user.cookie)).status,
    ).toBe(422)
  })

  it('should find a record right after it is created (index hook)', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/tasks`,
      { title: 'Renovar contrato da Agropecuária Boa Vista' },
      user.cookie,
    )
    const task = (await created.json()).data

    const data = await searchUntil(
      url(workspace.id, 'q=agropecuaria%20boa'),
      user.cookie,
      (ids) => ids.includes(task.id),
    )
    expect(data.results[0]).toMatchObject({
      type: 'crm-task',
      id: task.id,
      group: 'Tarefas',
      href: `/${workspace.slug}/crm/tasks?record=${task.id}`,
    })
  })

  it('should never show a requester tickets or internal articles of others', async () => {
    const { user: owner, workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    await SearchDocumentRepository.upsertMany([
      doc(workspace.id, {
        entityId: 'theirs',
        title: 'Servidor de arquivos fora do ar',
        keywords: 'INC-000001 1',
        codes: codesFor(['INC-000001', '1']),
        userIds: [owner.id],
      }),
      doc(workspace.id, {
        entityType: 'sd-kb-article',
        entityId: 'internal',
        audience: 'AGENTS',
        title: 'Servidor: runbook interno',
      }),
      doc(workspace.id, {
        entityType: 'sd-kb-article',
        entityId: 'portal',
        audience: 'PUBLIC',
        title: 'Servidor: como pedir acesso',
      }),
    ])

    const forRequester = await (
      await getJson(url(workspace.id, 'q=servidor'), requester.cookie)
    ).json()
    expect(forRequester.data.results.map((r: { id: string }) => r.id)).toEqual([
      'portal',
    ])

    const forOwner = await (
      await getJson(url(workspace.id, 'q=INC-000001'), owner.cookie)
    ).json()
    expect(forOwner.data.results[0].id).toBe('theirs')

    const filtered = await (
      await getJson(
        url(workspace.id, 'q=servidor&types=sd-kb-article&limit=5'),
        owner.cookie,
      )
    ).json()
    expect(
      filtered.data.results.map((r: { id: string }) => r.id).sort(),
    ).toEqual(['internal', 'portal'])
  })
})
