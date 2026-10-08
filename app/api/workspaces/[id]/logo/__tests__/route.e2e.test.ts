import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

function imageForm(type = 'image/png') {
  const fd = new FormData()
  fd.append('file', new File([new Uint8Array([1, 2, 3])], 'logo', { type }))
  return fd
}

function upload(id: string, body: FormData, cookie?: string) {
  return fetch(`${BASE_URL}/api/workspaces/${id}/logo`, {
    method: 'POST',
    headers: { Origin: BASE_URL, ...(cookie ? { Cookie: cookie } : {}) },
    body,
    redirect: 'manual',
  })
}

function remove(id: string, cookie?: string) {
  return fetch(`${BASE_URL}/api/workspaces/${id}/logo`, {
    method: 'DELETE',
    headers: { Origin: BASE_URL, ...(cookie ? { Cookie: cookie } : {}) },
    redirect: 'manual',
  })
}

describe('POST /api/workspaces/[id]/logo', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    expect((await upload('some-id', imageForm())).status).toBe(401)
  })

  it('should return 403 for a non-member and for a MEMBER', async () => {
    const [{ workspace }, stranger] = await Promise.all([
      authenticatedOwner(),
      createAuthenticatedUser(),
    ])
    const member = await addMember(workspace.id, 'MEMBER')

    expect(
      (await upload(workspace.id, imageForm(), stranger.cookie)).status,
    ).toBe(403)
    expect(
      (await upload(workspace.id, imageForm(), member.cookie)).status,
    ).toBe(403)
  })

  it('should return 422 without a file', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await upload(workspace.id, new FormData(), user.cookie)
    expect(res.status).toBe(422)
  })

  it('should return 422 for an SVG', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await upload(
      workspace.id,
      imageForm('image/svg+xml'),
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})

describe('DELETE /api/workspaces/[id]/logo', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    expect((await remove('some-id')).status).toBe(401)
  })

  it('should return 403 for a VIEWER', async () => {
    const { workspace } = await authenticatedOwner()
    const viewer = await addMember(workspace.id, 'VIEWER')
    expect((await remove(workspace.id, viewer.cookie)).status).toBe(403)
  })

  it('should be a no-op for an ADMIN when there is no logo', async () => {
    const { workspace } = await authenticatedOwner()
    const admin = await addMember(workspace.id, 'ADMIN')

    const res = await remove(workspace.id, admin.cookie)
    expect(res.status).toBe(200)
    expect((await res.json()).data.logoUrl).toBeNull()
  })
})
