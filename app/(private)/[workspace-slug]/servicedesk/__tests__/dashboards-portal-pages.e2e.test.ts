import { describe, expect, it } from 'vitest'
import { authenticatedOwner, defaultHeaders } from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

/**
 * Telas de painéis e do portal do solicitante. Como o app usa streaming
 * (Cache Components), o `notFound()` sai como o marcador RSC dentro de um
 * 200 — mesmo sinal usado pelo teste do guarda de módulo.
 */

const NOT_FOUND = 'NEXT_HTTP_ERROR_FALLBACK;404'

async function page(path: string, cookie: string): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { ...defaultHeaders, Cookie: cookie },
  })
  expect(res.status).toBe(200)
  return res.text()
}

describe('ServiceDesk dashboards pages', () => {
  it('renders the dashboards list for a module admin', async () => {
    const { user, workspace } = await authenticatedOwner()

    const html = await page(
      `/${workspace.slug}/servicedesk/dashboards`,
      user.cookie,
    )

    expect(html).not.toContain(NOT_FOUND)
    expect(html).not.toContain('Application error')
    expect(html).toContain('Painéis')
  })

  it('404s the TV mode of a dashboard that does not exist', async () => {
    const { user, workspace } = await authenticatedOwner()

    const html = await page(
      `/${workspace.slug}/servicedesk/dashboards/ghost/tv`,
      user.cookie,
    )

    expect(html).toContain(NOT_FOUND)
  })

  it('renders the editor and the TV mode of a real dashboard', async () => {
    const { user, workspace } = await authenticatedOwner()
    const dashboard = await prisma.crmDashboard.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        title: 'KPIs do turno',
        module: 'SERVICE_DESK',
      },
    })

    const editor = await page(
      `/${workspace.slug}/servicedesk/dashboards/${dashboard.id}`,
      user.cookie,
    )
    expect(editor).not.toContain(NOT_FOUND)
    expect(editor).toContain('KPIs do turno')

    const tv = await page(
      `/${workspace.slug}/servicedesk/dashboards/${dashboard.id}/tv`,
      user.cookie,
    )
    expect(tv).not.toContain(NOT_FOUND)
    expect(tv).toContain('Sair do modo TV')
  })

  it('hides dashboards of other modules behind the ServiceDesk routes', async () => {
    const { user, workspace } = await authenticatedOwner()
    const crmDashboard = await prisma.crmDashboard.create({
      data: {
        workspaceId: workspace.id,
        createdById: user.id,
        title: 'Funil do CRM',
        module: 'CRM',
      },
    })

    const html = await page(
      `/${workspace.slug}/servicedesk/dashboards/${crmDashboard.id}`,
      user.cookie,
    )

    expect(html).toContain(NOT_FOUND)
  })
})

describe('ServiceDesk requester portal pages', () => {
  it('welcomes the requester and offers the new ticket form', async () => {
    const { user, workspace } = await authenticatedOwner()

    const home = await page(
      `/${workspace.slug}/servicedesk/portal`,
      user.cookie,
    )
    expect(home).not.toContain(NOT_FOUND)
    expect(home).toContain('Portal do solicitante')

    const form = await page(
      `/${workspace.slug}/servicedesk/portal/new`,
      user.cookie,
    )
    expect(form).not.toContain(NOT_FOUND)
    expect(form).toContain('Abrir chamado')
  })

  it('renders the requester ticket page', async () => {
    const { user, workspace } = await authenticatedOwner()

    const html = await page(
      `/${workspace.slug}/servicedesk/portal/tickets/1`,
      user.cookie,
    )

    expect(html).not.toContain(NOT_FOUND)
    expect(html).toContain('Portal do solicitante')
  })

  it('shows the disabled notice when the portal is turned off', async () => {
    const { user, workspace } = await authenticatedOwner()
    await prisma.sdSettings.upsert({
      where: { workspaceId: workspace.id },
      create: {
        workspaceId: workspace.id,
        portalEnabled: false,
        ticketPrefixes: {
          INCIDENT: 'INC',
          SERVICE_REQUEST: 'REQ',
          CHANGE: 'CHG',
          PROBLEM: 'PRB',
        },
      },
      update: { portalEnabled: false },
    })

    const html = await page(
      `/${workspace.slug}/servicedesk/portal`,
      user.cookie,
    )

    expect(html).not.toContain(NOT_FOUND)
    expect(html).toContain('O portal está desativado')
  })
})
