import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
  patchJson,
  postJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

async function createBuilderTemplate(workspaceId: string, cookie: string) {
  const res = await postJson(
    `/api/workspaces/${workspaceId}/crm/email-templates`,
    {
      name: 'Newsletter de outubro',
      subject: 'Oi {{primeiro_nome|cliente}}',
      builderLayout: 'newsletter',
    },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data
}

describe('visual e-mail builder — templates', () => {
  it('creates a BUILDER template from a gallery layout and reads it back', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createBuilderTemplate(workspace.id, user.cookie)
    expect(created.kind).toBe('BUILDER')
    expect(created.builderDocument.layout).toBe('newsletter')
    expect(created.contentHtml).toContain('{{unsubscribe_url}}')

    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${created.id}`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data.id).toBe(created.id)
  })

  it('autosaves content edits and refuses structural changes', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createBuilderTemplate(workspace.id, user.cookie)
    const doc = created.builderDocument
    const path = `/api/workspaces/${workspace.id}/crm/email-templates/${created.id}`

    const edited = {
      ...doc,
      sections: doc.sections.map(
        (s: { id: string; props: Record<string, unknown> }) =>
          s.id === 'hero'
            ? { ...s, props: { ...s.props, heading: 'Título novo' } }
            : s,
      ),
    }
    const saved = await patchJson(
      path,
      { builderDocument: edited },
      user.cookie,
    )
    expect(saved.status).toBe(200)
    expect((await saved.json()).data.contentHtml).toContain('Título novo')

    const removed = await patchJson(
      path,
      { builderDocument: { ...doc, sections: doc.sections.slice(0, -1) } },
      user.cookie,
    )
    expect(removed.status).toBe(422)
    expect((await removed.json()).error.code).toBe(
      'CRM_EMAIL_BUILDER_STRUCTURE_LOCKED',
    )
  })

  it('rejects a builder document on a legacy template', async () => {
    const { user, workspace } = await authenticatedOwner()
    const legacy = await (
      await postJson(
        `/api/workspaces/${workspace.id}/crm/email-templates`,
        { name: 'Livre', subject: 'Oi', contentHtml: '<p>Oi</p>' },
        user.cookie,
      )
    ).json()
    const builder = await createBuilderTemplate(workspace.id, user.cookie)
    const res = await patchJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${legacy.data.id}`,
      { builderDocument: builder.builderDocument },
      user.cookie,
    )
    expect(res.status).toBe(409)
  })

  it('renders a template for a sample contact', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createBuilderTemplate(workspace.id, user.cookie)
    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${created.id}/render`,
      {
        sample: { email: 'ana@exemplo.com', name: 'Ana Costa' },
        campaignLink: 'https://acme.com.br/promo?utm_source=email',
      },
      user.cookie,
    )
    expect(res.status).toBe(200)
    const body = (await res.json()).data
    expect(body.subject).toBe('Oi Ana')
    expect(body.html).toContain('https://acme.com.br/promo?utm_source=email')
    expect(body.html).toContain('/unsubscribe/')
    expect(body.text).toContain('Descadastrar')
  })

  it('validates the render body', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createBuilderTemplate(workspace.id, user.cookie)
    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-templates/${created.id}/render`,
      { campaignLink: 'not a url' },
      user.cookie,
    )
    expect(res.status).toBe(422)
  })

  it('sends a test e-mail to the caller (dry run) and forbids viewers', async () => {
    const { user, workspace } = await authenticatedOwner()
    const created = await createBuilderTemplate(workspace.id, user.cookie)
    const path = `/api/workspaces/${workspace.id}/crm/email-templates/${created.id}/test-send`

    const res = await postJson(path, {}, user.cookie)
    expect(res.status).toBe(200)
    expect((await res.json()).data.to).toBe(user.email)

    const viewer = await addMember(workspace.id, 'VIEWER')
    const denied = await postJson(path, {}, viewer.cookie)
    expect(denied.status).toBe(403)
  })
})

describe('visual e-mail builder — campaigns', () => {
  it('creates a campaign from a builder template with the campaign link', async () => {
    const { user, workspace } = await authenticatedOwner()
    const template = await createBuilderTemplate(workspace.id, user.cookie)
    const res = await postJson(
      `/api/workspaces/${workspace.id}/crm/email-campaigns`,
      {
        subject: 'Oi {{primeiro_nome|cliente}}',
        templateId: template.id,
        campaignLink: 'https://acme.com.br/promo?utm_source=email',
        fromAddress: 'marketing@example.com',
        recipientScope: 'SELECTED',
        extraEmails: ['lead@example.com'],
      },
      user.cookie,
    )
    expect(res.status).toBe(201)
    const campaign = (await res.json()).data
    expect(campaign.templateId).toBe(template.id)
    expect(campaign.campaignLink).toBe(
      'https://acme.com.br/promo?utm_source=email',
    )
    expect(campaign.contentHtml).toContain('{{unsubscribe_url}}')
  })
})

describe('visual e-mail builder — brand and links', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(
      `${BASE_URL}/api/workspaces/some-id/crm/email-brand`,
      { headers: defaultHeaders },
    )
    expect(res.status).toBe(401)
  })

  it('reads the default brand, saves it and reads it back', async () => {
    const { user, workspace } = await authenticatedOwner()
    const path = `/api/workspaces/${workspace.id}/crm/email-brand`

    const initial = (await (await getJson(path, user.cookie)).json()).data
    expect(initial.saved).toBe(false)
    expect(initial.companyName).toBe(workspace.name)

    const brand = {
      companyName: 'Acme Ltda.',
      logoUrl: '',
      primaryColor: '#0F766E',
      address: 'Av. Paulista, 1000',
      website: 'https://acme.com.br',
    }
    const saved = await putJson(path, brand, user.cookie)
    expect(saved.status).toBe(200)
    expect((await saved.json()).data).toMatchObject({ ...brand, saved: true })

    const invalid = await putJson(
      path,
      { ...brand, primaryColor: 'azul' },
      user.cookie,
    )
    expect(invalid.status).toBe(422)
  })

  it('forbids non-members from reading the brand', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-brand`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('lists link targets (empty workspace)', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await getJson(
      `/api/workspaces/${workspace.id}/crm/email-builder/links`,
      user.cookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ landingPages: [], forms: [] })
  })

  it('rejects an unsupported image upload', async () => {
    const { user, workspace } = await authenticatedOwner()
    const res = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/crm/email-builder/images`,
      {
        method: 'POST',
        headers: {
          ...defaultHeaders,
          Cookie: user.cookie,
          'Content-Type': 'image/gif',
        },
        body: new Uint8Array([71, 73, 70]),
      },
    )
    expect(res.status).toBe(422)
  })
})
