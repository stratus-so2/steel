import { describe, expect, it } from 'vitest'
import { seedCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

async function seedCompetitorWithPosts() {
  const { user, workspace } = await authenticatedOwner()
  const competitor = await seedCrmCompetitor(workspace.id, user.id, {
    followersCount: 1000,
  })
  await prisma.crmCompetitorPost.createMany({
    data: [
      {
        competitorId: competitor.id,
        externalId: 'm1',
        format: 'REELS',
        caption: 'Instalação #fibra',
        likeCount: 90,
        commentsCount: 10,
        publishedAt: new Date(Date.now() - 2 * 86_400_000),
      },
      {
        competitorId: competitor.id,
        externalId: 'm2',
        format: 'IMAGE',
        caption: 'Promo #fibra',
        likeCount: 10,
        commentsCount: 0,
        publishedAt: new Date(Date.now() - 3 * 86_400_000),
      },
    ],
  })
  return { user, workspace, competitor }
}

describe('GET /api/workspaces/[id]/crm/competitors/[competitorId]/analysis', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/competitors/c1/analysis`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace, competitor } = await seedCompetitorWithPosts()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/competitors/${competitor.id}/analysis`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('should return 422 for an invalid range', async () => {
    const { user, workspace, competitor } = await seedCompetitorWithPosts()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/competitors/${competitor.id}/analysis?range=1y`,
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('should compute the post-based comparison for a member', async () => {
    const { user, workspace, competitor } = await seedCompetitorWithPosts()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/competitors/${competitor.id}/analysis?range=7d`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.range).toBe('7d')
    expect(data.competitorStats.postsCount).toBe(2)
    expect(data.competitorStats.avgInteractions).toBe(55)
    expect(data.competitorStats.engagementRate).toBe(5.5)
    expect(data.competitorStats.hashtags[0]).toMatchObject({ tag: 'fibra' })
    expect(data.ownAccount).toBeNull()
  })
})

describe('/api/workspaces/[id]/crm/competitors/[competitorId]/ideas', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/competitors/c1/ideas`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return null before any generation', async () => {
    const { user, workspace, competitor } = await seedCompetitorWithPosts()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/competitors/${competitor.id}/ideas`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data).toBeNull()
  })

  it('should return 404 for a competitor of another workspace', async () => {
    const mine = await seedCompetitorWithPosts()
    const theirs = await seedCompetitorWithPosts()

    const res = await getJson(
      `/api/workspaces/${mine.workspace.id}/crm/competitors/${theirs.competitor.id}/ideas`,
      mine.user.cookie,
    )
    expect(res.status).toBe(404)
  })

  it('should reject an invalid range before calling the AI', async () => {
    const { user, workspace, competitor } = await seedCompetitorWithPosts()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/competitors/${competitor.id}/ideas`,
      { range: '1y' },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })
})
