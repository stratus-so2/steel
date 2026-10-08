import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  getJson,
} from '@/src/__tests__/helpers/e2e'

const path = (id: string, slug: string) =>
  `/api/workspaces/${id}/slug-availability?slug=${encodeURIComponent(slug)}`

describe('GET /api/workspaces/[id]/slug-availability', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await getJson(path('some-id', 'acme'))
    expect(res.status).toBe(401)
  })

  it('should return 403 for a non-member and for a MEMBER', async () => {
    const [{ workspace }, stranger] = await Promise.all([
      authenticatedOwner(),
      createAuthenticatedUser(),
    ])
    const member = await addMember(workspace.id, 'MEMBER')

    expect(
      (await getJson(path(workspace.id, 'novo'), stranger.cookie)).status,
    ).toBe(403)
    expect(
      (await getJson(path(workspace.id, 'novo'), member.cookie)).status,
    ).toBe(403)
  })

  it('should return 422 without a slug', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/slug-availability`,
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should report free, current, taken and reserved slugs', async () => {
    const { user, workspace } = await authenticatedOwner()
    const { workspace: other } = await authenticatedOwner()
    const admin = await addMember(workspace.id, 'ADMIN')

    const check = async (slug: string, cookie = user.cookie) => {
      const res = await getJson(path(workspace.id, slug), cookie)
      expect(res.status).toBe(200)
      return (await res.json()).data
    }

    expect(await check(`livre-${createId().slice(0, 8)}`)).toMatchObject({
      available: true,
      reason: null,
    })
    expect(await check(workspace.slug, admin.cookie)).toMatchObject({
      available: true,
      reason: 'current',
    })
    expect(await check(other.slug)).toMatchObject({
      available: false,
      reason: 'taken',
    })
    expect(await check('admin')).toMatchObject({
      available: false,
      reason: 'reserved',
    })
    expect(await check('com espaço')).toMatchObject({
      available: false,
      reason: 'invalid',
    })
  })
})
