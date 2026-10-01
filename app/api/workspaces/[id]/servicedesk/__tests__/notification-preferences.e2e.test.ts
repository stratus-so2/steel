import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  deleteJson,
  getJson,
  putJson,
} from '@/src/__tests__/helpers/e2e'
import { setupTabs } from '../tickets/[ticketId]/__tests__/sd-tab-e2e.helpers'

const api = (ws: string) =>
  `/api/workspaces/${ws}/servicedesk/notification-preferences`

interface EventRow {
  event: string
  agentOnly: boolean
  channels: string[]
  defaultChannels: string[]
  enabledChannels: string[]
  customized: boolean
}

function rows(body: {
  groups: { label: string; events: EventRow[] }[]
}): Map<string, EventRow> {
  return new Map(
    body.groups.flatMap((group) => group.events.map((e) => [e.event, e])),
  )
}

describe('servicedesk notification preferences', () => {
  it('returns the catalog defaults for an agent', async () => {
    const { workspace, agent } = await setupTabs()
    const res = await getJson(api(workspace.id), agent.cookie)
    expect(res.status).toBe(200)
    const body = (await res.json()).data
    expect(body.isAgent).toBe(true)
    expect(body.whatsappAvailable).toBe(false)
    expect(body.groups.map((g: { label: string }) => g.label)).toContain(
      'Conversas',
    )

    const index = rows(body)
    expect(index.get('ticket.assigned')).toMatchObject({
      defaultChannels: ['IN_APP', 'EMAIL'],
      enabledChannels: ['IN_APP', 'EMAIL'],
      customized: false,
    })
    // O resumo diário vem desligado.
    expect(index.get('digest.daily')?.enabledChannels).toEqual([])
  })

  it('saves a cell, keeps the rest and restores the defaults', async () => {
    const { workspace, agent } = await setupTabs()
    const url = api(workspace.id)

    const saved = await putJson(
      url,
      {
        items: [
          { event: 'ticket.assigned', channel: 'EMAIL', enabled: false },
          { event: 'digest.daily', channel: 'EMAIL', enabled: true },
        ],
      },
      agent.cookie,
    )
    expect(saved.status).toBe(200)
    const afterSave = rows((await saved.json()).data)
    expect(afterSave.get('ticket.assigned')).toMatchObject({
      enabledChannels: ['IN_APP'],
      customized: true,
    })
    expect(afterSave.get('digest.daily')?.enabledChannels).toEqual(['EMAIL'])
    // Quem não foi tocado segue no padrão.
    expect(afterSave.get('ticket.message')?.customized).toBe(false)

    // A leitura seguinte devolve o que foi salvo.
    const reread = rows((await (await getJson(url, agent.cookie)).json()).data)
    expect(reread.get('ticket.assigned')?.enabledChannels).toEqual(['IN_APP'])

    const restored = await deleteJson(url, agent.cookie)
    expect(restored.status).toBe(200)
    const afterRestore = rows((await restored.json()).data)
    expect(afterRestore.get('ticket.assigned')).toMatchObject({
      enabledChannels: ['IN_APP', 'EMAIL'],
      customized: false,
    })
    expect(afterRestore.get('digest.daily')?.enabledChannels).toEqual([])
  })

  it('accepts an empty payload without changing anything', async () => {
    const { workspace, agent } = await setupTabs()
    const res = await putJson(api(workspace.id), { items: [] }, agent.cookie)
    expect(res.status).toBe(200)
    expect(
      rows((await res.json()).data).get('ticket.message')?.customized,
    ).toBe(false)
  })

  it('rejects an unknown event and a channel the event does not offer', async () => {
    const { workspace, agent } = await setupTabs()
    const url = api(workspace.id)

    const badEvent = await putJson(
      url,
      { items: [{ event: 'nao.existe', channel: 'EMAIL', enabled: true }] },
      agent.cookie,
    )
    expect(badEvent.status).toBe(400)
    expect((await badEvent.json()).error.code).toBe('VALIDATION_ERROR')

    const badChannel = await putJson(
      url,
      {
        items: [
          { event: 'ticket.internal_note', channel: 'EMAIL', enabled: true },
        ],
      },
      agent.cookie,
    )
    expect(badChannel.status).toBe(422)
    expect((await badChannel.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('hides agent-only events from a requester and refuses to save them', async () => {
    const { workspace, requester } = await setupTabs()
    const url = api(workspace.id)

    const res = await getJson(url, requester.cookie)
    expect(res.status).toBe(200)
    const body = (await res.json()).data
    expect(body.isAgent).toBe(false)
    const index = rows(body)
    expect(index.has('ticket.message')).toBe(true)
    expect(index.has('sla.breached')).toBe(false)
    expect(index.has('digest.daily')).toBe(false)

    const denied = await putJson(
      url,
      { items: [{ event: 'sla.breached', channel: 'IN_APP', enabled: true }] },
      requester.cookie,
    )
    expect(denied.status).toBe(403)
    expect((await denied.json()).error.code).toBe('SD_NOT_AGENT')

    // O que é dele, salva.
    const allowed = await putJson(
      url,
      {
        items: [{ event: 'ticket.message', channel: 'EMAIL', enabled: false }],
      },
      requester.cookie,
    )
    expect(allowed.status).toBe(200)
  })

  it('needs a session and workspace membership', async () => {
    const { workspace } = await setupTabs()
    const url = api(workspace.id)

    expect((await getJson(url, '')).status).toBe(401)

    const outsider = await createAuthenticatedUser()
    expect((await getJson(url, outsider.cookie)).status).toBe(403)
    expect((await putJson(url, { items: [] }, outsider.cookie)).status).toBe(
      403,
    )
    expect((await deleteJson(url, outsider.cookie)).status).toBe(403)
  })
})
