import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { setupTabs, tabApi } from './sd-tab-e2e.helpers'

describe('ticket followers', () => {
  it('follows and unfollows the ticket (idempotent both ways)', async () => {
    const { workspace, agent, ticket } = await setupTabs()
    const base = `${tabApi(workspace.id, ticket.id)}/followers`

    const empty = await getJson(base, agent.cookie)
    expect(empty.status).toBe(200)
    expect((await empty.json()).data).toEqual({ items: [], following: false })

    const follow = await postJson(base, {}, agent.cookie)
    expect(follow.status).toBe(200)
    const body = (await follow.json()).data
    expect(body.following).toBe(true)
    expect(body.items).toHaveLength(1)
    expect(body.items[0].userId).toBe(agent.id)
    expect(body.items[0].email).toBe(agent.email)

    // Seguir de novo não duplica.
    const again = await postJson(base, {}, agent.cookie)
    expect((await again.json()).data.items).toHaveLength(1)

    const list = await getJson(base, agent.cookie)
    expect((await list.json()).data.following).toBe(true)

    const unfollow = await deleteJson(base, agent.cookie)
    expect(unfollow.status).toBe(200)
    expect((await unfollow.json()).data).toEqual({
      items: [],
      following: false,
    })

    // Parar de seguir o que não seguia também é 200.
    const twice = await deleteJson(base, agent.cookie)
    expect(twice.status).toBe(200)
  })

  it('records the follow in the ticket traceability', async () => {
    const { workspace, agent, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)
    await postJson(`${base}/followers`, {}, agent.cookie)
    await deleteJson(`${base}/followers`, agent.cookie)

    const events = await getJson(`${base}/events`, agent.cookie)
    const actions = (await events.json()).data.items.map(
      (event: { action: string }) => event.action,
    )
    expect(actions).toContain('follower.added')
    expect(actions).toContain('follower.removed')
  })

  it('lets the requester follow their own ticket', async () => {
    const { workspace, requester, ticket } = await setupTabs()
    const base = `${tabApi(workspace.id, ticket.id)}/followers`
    const follow = await postJson(base, {}, requester.cookie)
    expect(follow.status).toBe(200)
    expect((await follow.json()).data.following).toBe(true)
  })

  it('hides a ticket the requester has no link to', async () => {
    const { workspace, requester, other } = await setupTabs()
    const base = `${tabApi(workspace.id, other.id)}/followers`
    const list = await getJson(base, requester.cookie)
    expect(list.status).toBe(403)
    expect((await list.json()).error.code).toBe('SD_TICKET_FORBIDDEN')
    const follow = await postJson(base, {}, requester.cookie)
    expect((await follow.json()).error.code).toBe('SD_TICKET_FORBIDDEN')
  })

  it('404s an unknown ticket and 403s a non-member', async () => {
    const { workspace, agent, ticket } = await setupTabs()
    const missing = await getJson(
      `${tabApi(workspace.id, 'INC-999999')}/followers`,
      agent.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe('SD_TICKET_NOT_FOUND')

    const outsider = await createAuthenticatedUser()
    const denied = await getJson(
      `${tabApi(workspace.id, ticket.id)}/followers`,
      outsider.cookie,
    )
    expect(denied.status).toBe(403)
  })

  it('requires a session', async () => {
    const { workspace, ticket } = await setupTabs()
    const anon = await getJson(
      `${tabApi(workspace.id, ticket.id)}/followers`,
      '',
    )
    expect(anon.status).toBe(401)
  })
})
