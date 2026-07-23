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

describe('GET /api/workspaces/[id]/crm/email-templates', () => {
  it('should return 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/email-templates`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('should return 403 when user is not a workspace member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-templates`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })
})

describe('POST /api/workspaces/[id]/crm/email-templates', () => {
  it('should create an email template', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-templates`,
      {
        name: 'Boas-vindas',
        subject: 'Bem-vindo!',
        contentHtml: '<p>Olá</p>',
      },
      user.cookie,
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.data.name).toBe('Boas-vindas')
  })
})

describe('PATCH & DELETE /api/workspaces/[id]/crm/email-templates/[templateId]', () => {
  it('should update and delete a template', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/email-templates`,
        {
          name: 'Boas-vindas',
          subject: 'Bem-vindo!',
          contentHtml: '<p>Olá</p>',
        },
        user.cookie,
      )
    ).json()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${created.data.id}`,
      { subject: 'Bem-vindo a bordo!' },
      user.cookie,
    )
    expect(updated.status).toBe(200)
    const updatedBody = await updated.json()
    expect(updatedBody.data.subject).toBe('Bem-vindo a bordo!')

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${created.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)

    const list = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-templates`,
      user.cookie,
    )
    const listBody = await list.json()
    expect(
      listBody.data.find((t: { id: string }) => t.id === created.data.id),
    ).toBeUndefined()
  })
})
