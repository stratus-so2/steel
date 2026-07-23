import { describe, expect, it } from 'vitest'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('CRM forms CRUD', () => {
  it('should create, update and delete a form', async () => {
    const { user, workspace } = await authenticatedOwner()

    const created = await postJson(
      `/api/workspaces/${workspace.id}/crm/forms`,
      {
        name: 'Contato',
        action: 'LEAD',
        fields: [
          {
            key: 'name',
            label: 'Nome',
            type: 'text',
            required: true,
            mapping: { target: 'lead', attribute: 'name' },
          },
        ],
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const createdBody = await created.json()
    expect(createdBody.data.publicToken).toBeTruthy()

    const updated = await patchJson(
      `/api/workspaces/${workspace.id}/crm/forms/${createdBody.data.id}`,
      { name: 'Contato 2' },
      user.cookie,
    )
    expect(updated.status).toBe(200)

    const deleted = await deleteJson(
      `/api/workspaces/${workspace.id}/crm/forms/${createdBody.data.id}`,
      user.cookie,
    )
    expect(deleted.status).toBe(200)
  })
})

describe('CRM form publish and public submit', () => {
  it('should publish a form and accept a public submission that creates a lead', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/forms`,
        {
          name: 'Contato',
          action: 'LEAD',
          fields: [
            {
              key: 'full_name',
              label: 'Nome',
              type: 'text',
              mapping: { target: 'lead', attribute: 'name' },
            },
            {
              key: 'work_email',
              label: 'E-mail',
              type: 'email',
              mapping: { target: 'lead', attribute: 'email' },
            },
          ],
        },
        user.cookie,
      )
    ).json()

    const beforePublish = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    expect(beforePublish.status).toBe(422)

    await postJson(
      `/api/workspaces/${workspace.id}/crm/forms/${created.data.id}/publish`,
      {},
      user.cookie,
    )

    const publicForm = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    expect(publicForm.status).toBe(200)

    const submitRes = await fetch(
      `${BASE_URL}/api/crm/forms/${created.data.publicToken}/submit`,
      {
        method: 'POST',
        headers: defaultHeaders,
        body: JSON.stringify({
          values: { full_name: 'Jane Doe', work_email: 'jane@acme.com' },
        }),
      },
    )
    expect(submitRes.status).toBe(201)
    const submitBody = await submitRes.json()
    expect(submitBody.data.createdLeadId).toBeTruthy()

    const submissions = await getJson(
      `/api/workspaces/${workspace.id}/crm/forms/${created.data.id}/submissions`,
      user.cookie,
    )
    const submissionsBody = await submissions.json()
    expect(submissionsBody.data).toHaveLength(1)

    const leads = await getJson(
      `/api/workspaces/${workspace.id}/crm/leads`,
      user.cookie,
    )
    const leadsBody = await leads.json()
    const createdLead = leadsBody.data.find(
      (l: { id: string }) => l.id === submitBody.data.createdLeadId,
    )
    expect(createdLead).toBeTruthy()
    expect(createdLead.name).toBe('Jane Doe')
    expect(createdLead.emails).toEqual(['jane@acme.com'])
  })
})

describe('CRM form builder + public pages (SSR)', () => {
  it('should render the builder page and the public form page without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/forms`,
        { name: 'Página de teste', action: 'LEAD' },
        user.cookie,
      )
    ).json()

    const builderPage = await fetch(
      `${BASE_URL}/${workspace.slug}/crm/forms/${created.data.id}`,
      { headers: { ...defaultHeaders, Cookie: user.cookie } },
    )
    expect(builderPage.status).toBe(200)
    const builderHtml = await builderPage.text()
    expect(builderHtml).not.toContain('Application error')

    await postJson(
      `/api/workspaces/${workspace.id}/crm/forms/${created.data.id}/publish`,
      {},
      user.cookie,
    )

    const publicPage = await fetch(
      `${BASE_URL}/f/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    expect(publicPage.status).toBe(200)
    const publicHtml = await publicPage.text()
    expect(publicHtml).not.toContain('Application error')
    expect(publicHtml).toContain('Página de teste')
  })

  it('should not render the form for an unpublished (draft) form', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/forms`,
        { name: 'Rascunho Único XPTO', action: 'LEAD' },
        user.cookie,
      )
    ).json()

    const publicPage = await fetch(
      `${BASE_URL}/f/${created.data.publicToken}`,
      { headers: defaultHeaders },
    )
    const html = await publicPage.text()
    // notFound() renderiza o boundary global (app/not-found.tsx) em vez do
    // formulário — o nome do formulário rascunho nunca deve vazar.
    expect(html).not.toContain('Rascunho Único XPTO')
  })
})
