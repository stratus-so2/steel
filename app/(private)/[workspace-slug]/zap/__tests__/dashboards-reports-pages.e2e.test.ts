import { describe, expect, it } from 'vitest'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'

describe('WhatsApp dashboards/reports pages', () => {
  it('should render /zap/dashboards without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(`${BASE_URL}/${workspace.slug}/zap/dashboards`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it('should render /zap/reports without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()

    const res = await fetch(`${BASE_URL}/${workspace.slug}/zap/reports`, {
      headers: { ...defaultHeaders, Cookie: user.cookie },
    })

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it('should render a whatsapp dashboard detail page without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()

    const createRes = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/dashboards`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, Cookie: user.cookie },
        body: JSON.stringify({ title: 'Painel de teste' }),
      },
    )
    const dashboard = (await createRes.json()).data

    const res = await fetch(
      `${BASE_URL}/${workspace.slug}/zap/dashboards/${dashboard.id}`,
      { headers: { ...defaultHeaders, Cookie: user.cookie } },
    )

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })

  it('should render a whatsapp report builder page without a server error', async () => {
    const { user, workspace } = await authenticatedOwner()

    const createRes = await fetch(
      `${BASE_URL}/api/workspaces/${workspace.id}/whatsapp/reports`,
      {
        method: 'POST',
        headers: { ...defaultHeaders, Cookie: user.cookie },
        body: JSON.stringify({
          name: 'Relatório de teste',
          source: 'whatsapp_conversation',
          columns: ['contactName'],
        }),
      },
    )
    const report = (await createRes.json()).data

    const res = await fetch(
      `${BASE_URL}/${workspace.slug}/zap/reports/${report.id}`,
      { headers: { ...defaultHeaders, Cookie: user.cookie } },
    )

    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).not.toContain('Application error')
  })
})
