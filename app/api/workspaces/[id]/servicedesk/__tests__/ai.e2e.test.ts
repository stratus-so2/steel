import { describe, expect, it } from 'vitest'
import { seedSdPhaseFlow } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  addMember,
  authenticatedOwner,
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

/**
 * Rotas do agente de IA do ServiceDesk. O provedor de IA não é chamado aqui
 * (sem chave e sem rede nos e2e): o que se verifica é o contrato de acesso
 * — autenticação, módulo, papel, `SD_AI_DISABLED` e validação do corpo.
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  return { owner, workspace, flow }
}

async function createTicket(workspaceId: string, cookie: string) {
  const res = await postJson(
    `${api(workspaceId)}/tickets`,
    { type: 'INCIDENT', title: 'VPN fora do ar' },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string; code: string }
}

describe('ServiceDesk AI — access', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${api('x')}/ai/tickets/t1/summary`, {
      method: 'POST',
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await postJson(
      `${api(workspace.id)}/ai/tickets/t1/summary`,
      {},
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('returns MODULE_DISABLED when the ServiceDesk is off', async () => {
    const { owner, workspace } = await setup()
    await prisma.workspaceModuleAccess.updateMany({
      where: { workspaceId: workspace.id, module: 'SERVICE_DESK' },
      data: { enabled: false },
    })
    const res = await postJson(
      `${api(workspace.id)}/ai/tickets/t1/summary`,
      {},
      owner.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('MODULE_DISABLED')
  })

  it('refuses the copilot for a requester', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)
    const requester = await addMember(workspace.id, 'MEMBER')
    const res = await postJson(
      `${api(workspace.id)}/ai/tickets/${ticket.id}/summary`,
      {},
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })
})

describe('ServiceDesk AI — disabled by configuration', () => {
  it('answers SD_AI_DISABLED on every copilot route while the AI is off', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)
    const base = `${api(workspace.id)}/ai/tickets/${ticket.id}`

    for (const path of ['summary', 'reply', 'solution', 'classification']) {
      const res = await postJson(`${base}/${path}`, {}, owner.cookie)
      expect(res.status).toBe(403)
      expect((await res.json()).error.code).toBe('SD_AI_DISABLED')
    }

    const chat = await getJson(`${base}/chat`, owner.cookie)
    expect(chat.status).toBe(403)
    expect((await chat.json()).error.code).toBe('SD_AI_DISABLED')
  })

  it('answers SD_AI_DISABLED on the pre-service while it is off', async () => {
    const { owner, workspace } = await setup()
    const res = await postJson(
      `${api(workspace.id)}/ai/pre-service`,
      { message: 'Minha VPN caiu' },
      owner.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_AI_DISABLED')
  })

  it('answers SD_PORTAL_DISABLED for a requester when the portal is off', async () => {
    const { owner, workspace } = await setup()
    const requester = await addMember(workspace.id, 'MEMBER')
    const settings = await patchJson(
      `${api(workspace.id)}/settings`,
      { aiEnabled: true, aiPreServiceEnabled: true, portalEnabled: false },
      owner.cookie,
    )
    expect(settings.status).toBe(200)

    const res = await postJson(
      `${api(workspace.id)}/ai/pre-service`,
      { message: 'Minha VPN caiu' },
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_PORTAL_DISABLED')
  })
})

describe('ServiceDesk AI — validation', () => {
  it('rejects an empty pre-service message and a too long chat message', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)

    const empty = await postJson(
      `${api(workspace.id)}/ai/pre-service`,
      { message: '   ' },
      owner.cookie,
    )
    expect(empty.status).toBe(422)
    expect((await empty.json()).error.code).toBe('VALIDATION_ERROR')

    const long = await postJson(
      `${api(workspace.id)}/ai/tickets/${ticket.id}/chat`,
      { message: 'a'.repeat(4001) },
      owner.cookie,
    )
    expect(long.status).toBe(422)

    const outcome = await postJson(
      `${api(workspace.id)}/ai/pre-service/abc/close`,
      { outcome: 'nope' },
      owner.cookie,
    )
    expect(outcome.status).toBe(422)
  })

  it('does not find a pre-service conversation of somebody else', async () => {
    const { owner, workspace } = await setup()
    await patchJson(
      `${api(workspace.id)}/settings`,
      { aiEnabled: true, aiPreServiceEnabled: true },
      owner.cookie,
    )
    const other = await prisma.sdAiConversation.create({
      data: { workspaceId: workspace.id, mode: 'PRE_SERVICE', messages: [] },
    })
    const res = await postJson(
      `${api(workspace.id)}/ai/pre-service/${other.id}/ticket`,
      {},
      owner.cookie,
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('SD_AI_CONVERSATION_NOT_FOUND')
  })

  it('clears a copilot chat that does not exist without failing', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)
    await patchJson(
      `${api(workspace.id)}/settings`,
      { aiEnabled: true },
      owner.cookie,
    )

    const res = await deleteJson(
      `${api(workspace.id)}/ai/tickets/${ticket.id}/chat`,
      owner.cookie,
    )
    expect(res.status).toBe(200)

    const chat = await getJson(
      `${api(workspace.id)}/ai/tickets/${ticket.id}/chat`,
      owner.cookie,
    )
    expect(chat.status).toBe(200)
    expect((await chat.json()).data).toBeNull()
  })
})
