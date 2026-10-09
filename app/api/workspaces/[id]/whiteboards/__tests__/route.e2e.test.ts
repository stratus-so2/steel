import { describe, expect, it } from 'vitest'
import {
  seedWhiteboard,
  seedWhiteboardVersion,
  withoutWhiteboard,
} from '@/src/__tests__/factories/whiteboard.factory'
import {
  addMember,
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

const scene = {
  elements: [{ id: 'el-1', type: 'text', text: 'Ideia', x: 0, y: 0 }],
  appState: { viewBackgroundColor: '#ffffff' },
  files: {},
}

const base = (ws: string) => `/api/workspaces/${ws}/whiteboards`

describe('whiteboard routes — gate', () => {
  it('returns 401 without a session', async () => {
    expect((await getJson(base('ws'))).status).toBe(401)
  })

  it('returns 403 WHITEBOARD_DISABLED while the switch is off', async () => {
    const { user, workspace } = await withoutWhiteboard(authenticatedOwner())

    const res = await getJson(base(workspace.id), user.cookie)

    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('WHITEBOARD_DISABLED')
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const { user: stranger } = await authenticatedOwner()

    expect((await getJson(base(workspace.id), stranger.cookie)).status).toBe(
      403,
    )
  })
})

describe('whiteboard routes — boards', () => {
  it('creates, lists, opens, renames, duplicates and archives a board', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      base(workspace.id),
      { title: 'Retro' },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const board = (await created.json()).data
    expect(board.scene).toEqual({ elements: [], appState: {}, files: {} })

    const list = await (await getJson(base(workspace.id), user.cookie)).json()
    expect(list.data.map((b: { id: string }) => b.id)).toEqual([board.id])

    const opened = await getJson(
      `${base(workspace.id)}/${board.id}`,
      user.cookie,
    )
    expect(opened.status).toBe(200)

    const renamed = await patchJson(
      `${base(workspace.id)}/${board.id}`,
      { title: 'Retro Q4' },
      user.cookie,
    )
    expect((await renamed.json()).data.title).toBe('Retro Q4')

    const copy = await postJson(
      `${base(workspace.id)}/${board.id}/duplicate`,
      {},
      user.cookie,
    )
    expect(copy.status).toBe(201)
    expect((await copy.json()).data.title).toBe('Retro Q4 (cópia)')

    const archived = await patchJson(
      `${base(workspace.id)}/${board.id}/archive`,
      { archived: true },
      user.cookie,
    )
    expect((await archived.json()).data.archivedAt).not.toBeNull()

    const archivedList = await (
      await getJson(`${base(workspace.id)}?archived=true`, user.cookie)
    ).json()
    expect(archivedList.data).toHaveLength(1)
  })

  it('returns 422 for an invalid title or filter', async () => {
    const { user, workspace } = await authenticatedOwner()

    expect(
      (
        await postJson(
          base(workspace.id),
          { title: 'x'.repeat(121) },
          user.cookie,
        )
      ).status,
    ).toBe(422)
    expect(
      (await getJson(`${base(workspace.id)}?archived=maybe`, user.cookie))
        .status,
    ).toBe(422)
  })

  it('keeps a VIEWER read-only', async () => {
    const { user, workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')
    const board = await seedWhiteboard(workspace.id, user.id)

    expect(
      (await getJson(`${base(workspace.id)}/${board.id}`, viewer.cookie))
        .status,
    ).toBe(200)
    const res = await postJson(base(workspace.id), {}, viewer.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('WHITEBOARD_FORBIDDEN')

    const lock = await postJson(
      `${base(workspace.id)}/${board.id}/lock`,
      {},
      viewer.cookie,
    )
    expect((await lock.json()).data).toMatchObject({
      canEdit: false,
      readOnlyRole: true,
    })
  })

  it('stops a MEMBER from archiving someone else’s board', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const board = await seedWhiteboard(workspace.id, user.id)

    const res = await patchJson(
      `${base(workspace.id)}/${board.id}/archive`,
      { archived: true },
      member.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('whiteboard routes — save, lease and history', () => {
  it('saves with the revision, refuses stale saves and other editors', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const board = await seedWhiteboard(workspace.id, user.id)
    const url = `${base(workspace.id)}/${board.id}`

    const lock = await postJson(`${url}/lock`, {}, user.cookie)
    expect((await lock.json()).data.canEdit).toBe(true)

    const saved = await putJson(
      `${url}/scene`,
      { scene, baseRevision: 0 },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    expect((await saved.json()).data).toMatchObject({
      revision: 1,
      versionCreated: true,
    })

    const stale = await putJson(
      `${url}/scene`,
      { scene, baseRevision: 0 },
      user.cookie,
    )
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.code).toBe('WHITEBOARD_REVISION_CONFLICT')

    const theirs = await putJson(
      `${url}/scene`,
      { scene, baseRevision: 1 },
      member.cookie,
    )
    expect(theirs.status).toBe(409)
    expect((await theirs.json()).error.code).toBe('WHITEBOARD_LOCKED')

    const memberLock = await postJson(`${url}/lock`, {}, member.cookie)
    expect((await memberLock.json()).data).toMatchObject({
      canEdit: false,
      lock: { holder: { id: user.id } },
    })

    const released = await deleteJson(`${url}/lock`, user.cookie)
    expect((await released.json()).data).toEqual({ released: true })
    expect((await postJson(`${url}/lock`, {}, member.cookie)).status).toBe(200)
  })

  it('returns 422 for an invalid scene', async () => {
    const { user, workspace } = await authenticatedOwner()
    const board = await seedWhiteboard(workspace.id, user.id)

    const res = await putJson(
      `${base(workspace.id)}/${board.id}/scene`,
      { scene: { elements: [{ type: 'x' }] }, baseRevision: 0 },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('saves a named version, previews it and restores into a new version', async () => {
    const { user, workspace } = await authenticatedOwner()
    const board = await seedWhiteboard(workspace.id, user.id, { revision: 2 })
    const old = await seedWhiteboardVersion(board.id, user.id, {
      kind: 'MANUAL',
      name: 'v1',
      scene: { elements: [], appState: {}, files: {} },
    })
    const url = `${base(workspace.id)}/${board.id}/versions`

    const named = await postJson(url, { name: 'Entrega' }, user.cookie)
    expect(named.status).toBe(201)
    expect((await named.json()).data).toMatchObject({
      kind: 'MANUAL',
      name: 'Entrega',
      revision: 2,
    })

    const list = await (await getJson(url, user.cookie)).json()
    expect(list.data).toHaveLength(2)

    const preview = await getJson(`${url}/${old.id}`, user.cookie)
    expect((await preview.json()).data.scene.elements).toEqual([])

    const restored = await postJson(`${url}/${old.id}/restore`, {}, user.cookie)
    expect(restored.status).toBe(200)
    expect((await restored.json()).data).toMatchObject({
      revision: 3,
      scene: { elements: [] },
    })

    const after = await (await getJson(url, user.cookie)).json()
    expect(after.data[0]).toMatchObject({
      kind: 'RESTORE',
      restoredFromId: old.id,
    })
    expect(after.data).toHaveLength(3)
  })

  it('answers 404 for a version of another board', async () => {
    const { user, workspace } = await authenticatedOwner()
    const board = await seedWhiteboard(workspace.id, user.id)
    const other = await seedWhiteboard(workspace.id, user.id)
    const version = await seedWhiteboardVersion(other.id, user.id)

    const res = await getJson(
      `${base(workspace.id)}/${board.id}/versions/${version.id}`,
      user.cookie,
    )
    expect(res.status).toBe(404)
  })
})

describe('whiteboard routes — files and settings', () => {
  it('uploads and serves canvas images and the thumbnail', async () => {
    const { user, workspace } = await authenticatedOwner()
    const board = await seedWhiteboard(workspace.id, user.id)
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])

    const form = new FormData()
    form.set('fileId', 'abc123')
    form.set('file', new Blob([png], { type: 'image/png' }), 'a.png')
    const upload = await fetch(`${BASE_URL}${base(workspace.id)}/files`, {
      method: 'POST',
      headers: { Origin: BASE_URL, Cookie: user.cookie },
      body: form,
    })
    expect(upload.status).toBe(201)

    const image = await getJson(
      `${base(workspace.id)}/files/abc123`,
      user.cookie,
    )
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(image.headers.get('x-content-type-options')).toBe('nosniff')

    const thumb = await fetch(
      `${BASE_URL}${base(workspace.id)}/${board.id}/thumbnail`,
      {
        method: 'PUT',
        headers: {
          ...defaultHeaders,
          Cookie: user.cookie,
          'Content-Type': 'image/png',
        },
        body: png,
      },
    )
    expect(thumb.status).toBe(200)
    const row = await prisma.whiteboard.findUniqueOrThrow({
      where: { id: board.id },
    })
    expect(row.thumbnailAt).not.toBeNull()
    expect(
      (
        await getJson(
          `${base(workspace.id)}/${board.id}/thumbnail`,
          user.cookie,
        )
      ).status,
    ).toBe(200)
  })

  it('returns 404 for a missing image and 422 for a non-image', async () => {
    const { user, workspace } = await authenticatedOwner()

    expect(
      (await getJson(`${base(workspace.id)}/files/nope`, user.cookie)).status,
    ).toBe(404)

    const form = new FormData()
    form.set('fileId', 'doc')
    form.set('file', new Blob(['x'], { type: 'application/pdf' }), 'a.pdf')
    const res = await fetch(`${BASE_URL}${base(workspace.id)}/files`, {
      method: 'POST',
      headers: { Origin: BASE_URL, Cookie: user.cookie },
      body: form,
    })
    expect(res.status).toBe(422)
  })

  it('lets only OWNER/ADMIN flip the switch', async () => {
    const { user, workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const url = `/api/workspaces/${workspace.id}/whiteboard/settings`

    expect((await (await getJson(url, member.cookie)).json()).data).toEqual({
      enabled: true,
    })
    expect(
      (await patchJson(url, { enabled: false }, member.cookie)).status,
    ).toBe(403)
    const res = await patchJson(url, { enabled: false }, user.cookie)
    expect((await res.json()).data).toEqual({ enabled: false })
  })
})
