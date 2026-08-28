import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('GET /api/workspaces/[id]/crm/landing-pages', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/landing-pages`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST, PATCH & DELETE /api/workspaces/[id]/crm/landing-pages', () => {
  it('should create, update and delete a landing page', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages`,
      {
        title: 'Home',
        templateKey: 'agency',
        sections: [
          {
            type: 'HERO',
            order: 0,
            enabled: true,
            content: { type: 'HERO', title: 'Bem-vindo' },
          },
        ],
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.status).toBe('DRAFT')
    expect(createdBody.data.shareToken).toBeTruthy()
    expect(createdBody.data.sections).toHaveLength(1)

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages/${createdBody.data.id}`,
      { title: 'Home 2' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })

  it('should reject an unknown templateKey', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages`,
      { title: 'Home', templateKey: 'does-not-exist', sections: [] },
      user.cookie,
    )
    expect(created.status).toBe(404)
    const body = await created.json()
    expect(body.error.code).toBe('CRM_LANDING_PAGE_TEMPLATE_NOT_FOUND')
  })
})

describe('CRM landing page publish and public access', () => {
  it('should publish a page and serve it publicly with view tracking', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/landing-pages`,
        {
          title: 'Página Pública',
          templateKey: 'agency',
          sections: [
            {
              type: 'HERO',
              order: 0,
              enabled: true,
              content: { type: 'HERO', title: 'Olá' },
            },
          ],
        },
        user.cookie,
      )
    ).json()

    const beforePublish = await fetch(
      `${BASE_URL}/api/crm/landing-pages/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(beforePublish.status).toBe(404)

    const published = await postJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages/${created.data.id}/publish`,
      {},
      user.cookie,
    )
    expect(published.status).toBe(200)
    const publishedBody = await published.json()
    expect(publishedBody.data.status).toBe('PUBLISHED')

    const afterPublish = await fetch(
      `${BASE_URL}/api/crm/landing-pages/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(afterPublish.status).toBe(200)
    const afterPublishBody = await afterPublish.json()
    expect(afterPublishBody.data.title).toBe('Página Pública')
    expect(afterPublishBody.data.templateKey).toBe('agency')
    expect(afterPublishBody.data.sections).toHaveLength(1)

    const view = await fetch(
      `${BASE_URL}/api/crm/landing-pages/${created.data.shareToken}/view`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ viewId: 'v1', ctaClicks: 2 }),
      },
    )
    expect(view.status).toBe(200)

    const unpublished = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages/${created.data.id}/publish`,
      user.cookie,
    )
    expect(unpublished.status).toBe(200)

    const afterUnpublish = await fetch(
      `${BASE_URL}/api/crm/landing-pages/${created.data.shareToken}`,
      { headers: defaultHeaders },
    )
    expect(afterUnpublish.status).toBe(404)
  })
})

describe('CRM landing page builder + public page (SSR)', () => {
  it('should render the builder page and the public page without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/landing-pages`,
        {
          title: 'Página de teste SSR',
          templateKey: 'agency',
          sections: [
            {
              type: 'HERO',
              order: 0,
              enabled: true,
              content: { type: 'HERO', title: 'Título de teste SSR' },
            },
          ],
        },
        user.cookie,
      )
    ).json()

    const builderPage = await fetch(
      `${BASE_URL}/${workspace.slug}/crm/landing-pages/${created.data.id}`,
      { headers: { ...defaultHeaders, Cookie: user.cookie } },
    )
    expect(builderPage.status).toBe(200)
    const builderHtml = await builderPage.text()
    expect(builderHtml).not.toContain('Application error')

    await postJson(
      `/api/workspaces/${workspace.id}/crm/landing-pages/${created.data.id}/publish`,
      {},
      user.cookie,
    )

    const publicPage = await fetch(`${BASE_URL}/l/${created.data.shareToken}`, {
      headers: defaultHeaders,
    })
    expect(publicPage.status).toBe(200)
    const publicHtml = await publicPage.text()
    expect(publicHtml).not.toContain('Application error')
    expect(publicHtml).toContain('Título de teste SSR')
  })

  it('should not leak content for an unpublished (draft) page', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/landing-pages`,
        {
          title: 'Rascunho Único XPTO',
          templateKey: 'agency',
          sections: [
            {
              type: 'HERO',
              order: 0,
              enabled: true,
              content: { type: 'HERO', title: 'Rascunho Único XPTO' },
            },
          ],
        },
        user.cookie,
      )
    ).json()

    const publicPage = await fetch(`${BASE_URL}/l/${created.data.shareToken}`, {
      headers: defaultHeaders,
    })
    const html = await publicPage.text()
    expect(html).not.toContain('Rascunho Único XPTO')
  })
})
