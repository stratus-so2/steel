import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

function kb(workspaceId: string, path = '') {
  return `/api/workspaces/${workspaceId}/servicedesk/knowledge${path}`
}

describe('GET /api/workspaces/[id]/servicedesk/knowledge', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${kb('some-id')}`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(kb(workspace.id), stranger.cookie)
    expect(res.status).toBe(403)
  })
})

describe('knowledge base lifecycle (agent/admin)', () => {
  it('creates, edits, publishes, searches, votes, comments, moves and deletes', async () => {
    const { user, workspace } = await authenticatedOwner()
    const ws = workspace.id
    const category = await prisma.sdCategory.create({
      data: { workspaceId: ws, level: 'CATEGORY', name: 'Rede' },
    })

    const parentRes = await postJson(kb(ws), { title: 'Rede' }, user.cookie)
    expect(parentRes.status).toBe(201)
    const parent = (await parentRes.json()).data

    const created = await postJson(
      kb(ws),
      { title: 'VPN corporativa', categoryId: category.id, tags: ['VPN'] },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const article = (await created.json()).data
    expect(article).toMatchObject({ status: 'DRAFT', tags: ['vpn'] })

    const saved = await patchJson(
      kb(ws, `/${article.id}`),
      {
        content: [
          {
            type: 'p',
            children: [{ text: 'Reinicie o cliente de acesso remoto' }],
          },
        ],
        visibility: 'PORTAL',
      },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    expect((await saved.json()).data.visibility).toBe('PORTAL')

    const invalid = await patchJson(
      kb(ws, `/${article.id}`),
      { coverImage: 'javascript:alert(1)' },
      user.cookie,
    )
    expect(invalid.status).toBe(422)

    const published = await patchJson(
      kb(ws, `/${article.id}/status`),
      { status: 'PUBLISHED' },
      user.cookie,
    )
    expect(published.status).toBe(200)
    expect((await published.json()).data.publishedAt).not.toBeNull()

    const search = await getJson(kb(ws, '/search?q=remoto'), user.cookie)
    expect(search.status).toBe(200)
    const results = (await search.json()).data
    expect(results.map((r: { id: string }) => r.id)).toEqual([article.id])
    expect(results[0].excerpt).toContain('remoto')

    const categories = await getJson(kb(ws, '/categories'), user.cookie)
    expect((await categories.json()).data).toEqual([
      expect.objectContaining({ id: category.id, articleCount: 1 }),
    ])

    const view = await postJson(kb(ws, `/${article.id}/view`), {}, user.cookie)
    expect((await view.json()).data).toEqual({ viewCount: 1, counted: true })
    const again = await postJson(kb(ws, `/${article.id}/view`), {}, user.cookie)
    expect((await again.json()).data.counted).toBe(false)

    const vote = await putJson(
      kb(ws, `/${article.id}/vote`),
      { helpful: true },
      user.cookie,
    )
    expect((await vote.json()).data).toEqual({
      helpfulCount: 1,
      notHelpfulCount: 0,
      myVote: 'up',
    })
    const detail = await getJson(kb(ws, `/${article.id}`), user.cookie)
    expect((await detail.json()).data.myVote).toBe('up')

    const related = await getJson(kb(ws, `/${article.id}/related`), user.cookie)
    expect(related.status).toBe(200)

    const comment = await postJson(
      kb(ws, `/${article.id}/comments`),
      {
        markId: 'm1',
        content: [{ type: 'p', children: [{ text: 'Revisar' }] }],
      },
      user.cookie,
    )
    expect(comment.status).toBe(201)
    const commentId = (await comment.json()).data.id
    const resolved = await patchJson(
      kb(ws, `/${article.id}/comments/${commentId}/resolve`),
      { resolved: true },
      user.cookie,
    )
    expect((await resolved.json()).data.resolved).toBe(true)
    const comments = await getJson(
      kb(ws, `/${article.id}/comments`),
      user.cookie,
    )
    expect((await comments.json()).data).toHaveLength(1)
    const removedComment = await deleteJson(
      kb(ws, `/${article.id}/comments/${commentId}`),
      user.cookie,
    )
    expect(removedComment.status).toBe(200)

    const moved = await patchJson(
      kb(ws, `/${article.id}/move`),
      { parentId: parent.id, position: 0 },
      user.cookie,
    )
    expect((await moved.json()).data.parentId).toBe(parent.id)
    const cycle = await patchJson(
      kb(ws, `/${parent.id}/move`),
      { parentId: article.id, position: 0 },
      user.cookie,
    )
    expect(cycle.status).toBe(422)
    expect((await cycle.json()).error.code).toBe('SD_KB_ARTICLE_MOVE_INVALID')

    const archived = await patchJson(
      kb(ws, `/${parent.id}/archive`),
      {},
      user.cookie,
    )
    expect(archived.status).toBe(200)
    const trash = await getJson(kb(ws, '?archived=true'), user.cookie)
    expect(
      (await trash.json()).data.map((a: { id: string }) => a.id).sort(),
    ).toEqual([article.id, parent.id].sort())
    const restored = await patchJson(
      kb(ws, `/${parent.id}/restore`),
      {},
      user.cookie,
    )
    expect((await restored.json()).data.archivedAt).toBeNull()

    const removed = await deleteJson(kb(ws, `/${parent.id}`), user.cookie)
    expect(removed.status).toBe(200)
    const gone = await getJson(kb(ws, `/${article.id}`), user.cookie)
    expect(gone.status).toBe(404)
  })

  it('uploads media to the private bucket and serves it back', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await postJson(
      kb(workspace.id),
      { title: 'Mídia' },
      user.cookie,
    )
    const article = (await created.json()).data

    const form = new FormData()
    form.append(
      'file',
      new Blob([Uint8Array.from([137, 80, 78, 71])], { type: 'image/png' }),
      'logo.png',
    )
    const upload = await fetch(
      `${BASE_URL}${kb(workspace.id, `/${article.id}/media`)}`,
      {
        method: 'POST',
        headers: { Origin: BASE_URL, Cookie: user.cookie },
        body: form,
      },
    )
    expect(upload.status).toBe(201)
    const media = (await upload.json()).data
    expect(media.url).toMatch(/\/media\/[a-z0-9]+\.png$/)

    const download = await fetch(`${BASE_URL}${media.url}`, {
      headers: { Cookie: user.cookie },
    })
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toBe('image/png')

    const bad = new FormData()
    bad.append('file', new Blob(['<script>'], { type: 'text/html' }), 'x.html')
    const rejected = await fetch(
      `${BASE_URL}${kb(workspace.id, `/${article.id}/media`)}`,
      {
        method: 'POST',
        headers: { Origin: BASE_URL, Cookie: user.cookie },
        body: bad,
      },
    )
    expect(rejected.status).toBe(422)
  })
})

describe('knowledge base for requesters (members without department)', () => {
  it('only sees published portal articles and cannot edit', async () => {
    const { user, workspace } = await authenticatedOwner()
    const requester = await addMember(workspace.id, 'MEMBER')
    const ws = workspace.id

    const internal = await prisma.sdKbArticle.create({
      data: {
        workspaceId: ws,
        title: 'Interno',
        content: [],
        status: 'PUBLISHED',
      },
    })
    const portal = await prisma.sdKbArticle.create({
      data: {
        workspaceId: ws,
        title: 'Portal',
        content: [],
        status: 'PUBLISHED',
        visibility: 'PORTAL',
      },
    })

    const list = await getJson(kb(ws), requester.cookie)
    expect(list.status).toBe(200)
    expect((await list.json()).data.map((a: { id: string }) => a.id)).toEqual([
      portal.id,
    ])
    expect(
      (await getJson(kb(ws, `/${internal.id}`), requester.cookie)).status,
    ).toBe(404)
    expect(
      (await getJson(kb(ws, `/${portal.id}`), requester.cookie)).status,
    ).toBe(200)

    const vote = await putJson(
      kb(ws, `/${portal.id}/vote`),
      { helpful: false },
      requester.cookie,
    )
    expect((await vote.json()).data.myVote).toBe('down')

    const create = await postJson(kb(ws), { title: 'x' }, requester.cookie)
    expect(create.status).toBe(403)
    expect((await create.json()).error.code).toBe('SD_NOT_AGENT')
    const comments = await getJson(
      kb(ws, `/${portal.id}/comments`),
      requester.cookie,
    )
    expect(comments.status).toBe(403)

    // Admin continua vendo tudo.
    const adminList = await getJson(kb(ws), user.cookie)
    expect((await adminList.json()).data).toHaveLength(2)
  })
})
