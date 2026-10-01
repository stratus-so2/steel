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
 * Rotas do WhatsApp do ServiceDesk. O provedor não é chamado aqui (sem rede
 * nos e2e): o que se verifica é o contrato — acesso, cadastro das conexões,
 * conexão ativa, vínculo conversa ↔ chamado e os erros de domínio.
 */

const api = (ws: string) => `/api/workspaces/${ws}/servicedesk`
const wa = (ws: string) => `${api(ws)}/whatsapp`

async function setup() {
  const { user: owner, workspace } = await authenticatedOwner()
  await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  return { owner, workspace }
}

async function createTicket(workspaceId: string, cookie: string) {
  const res = await postJson(
    `${api(workspaceId)}/tickets`,
    { type: 'INCIDENT', title: 'Sem acesso ao sistema' },
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as { id: string; code: string }
}

const ZAPI_CONNECTION = {
  provider: 'ZAPI' as const,
  label: 'Suporte',
  phoneNumber: '5511988887777',
  zapiInstanceId: 'inst-1',
  zapiToken: 'token-1',
}

async function createConnection(workspaceId: string, cookie: string) {
  const res = await postJson(
    `${wa(workspaceId)}/connections`,
    ZAPI_CONNECTION,
    cookie,
  )
  expect(res.status).toBe(201)
  return (await res.json()).data as {
    id: string
    active: boolean
    webhookPath: string
  }
}

describe('ServiceDesk WhatsApp — access', () => {
  it('returns 401 via middleware when unauthenticated', async () => {
    const res = await fetch(`${BASE_URL}${wa('x')}/connections`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)
  })

  it('returns 403 for a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const stranger = await createAuthenticatedUser()
    const res = await getJson(
      `${wa(workspace.id)}/connections`,
      stranger.cookie,
    )
    expect(res.status).toBe(403)
  })

  it('keeps the connections for module admins only', async () => {
    const { workspace } = await setup()
    const member = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(`${wa(workspace.id)}/connections`, member.cookie)
    expect(res.status).toBe(403)
  })

  it('refuses the ticket tab for a requester', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)
    const requester = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(
      `${wa(workspace.id)}/tickets/${ticket.id}`,
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('returns MODULE_DISABLED when the ServiceDesk is off', async () => {
    const { owner, workspace } = await setup()
    await prisma.workspaceModuleAccess.updateMany({
      where: { workspaceId: workspace.id, module: 'SERVICE_DESK' },
      data: { enabled: false },
    })
    const res = await getJson(`${wa(workspace.id)}/connections`, owner.cookie)
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('MODULE_DISABLED')
  })
})

describe('ServiceDesk WhatsApp — connections', () => {
  it('creates the first connection as the active one and never leaks secrets', async () => {
    const { owner, workspace } = await setup()
    const created = await createConnection(workspace.id, owner.cookie)
    expect(created.active).toBe(true)
    expect(created.webhookPath).toMatch(
      /^\/api\/whatsapp\/webhook\/zapi\?secret=/,
    )
    expect(JSON.stringify(created)).not.toContain('token-1')

    const settings = await getJson(
      `${api(workspace.id)}/settings`,
      owner.cookie,
    )
    expect((await settings.json()).data.whatsappConnectionId).toBe(created.id)

    const list = await getJson(`${wa(workspace.id)}/connections`, owner.cookie)
    expect(list.status).toBe(200)
    expect((await list.json()).data).toHaveLength(1)
  })

  it('does not mix the connections of the Comunicação module', async () => {
    const { owner, workspace } = await setup()
    await prisma.whatsAppConnection.create({
      data: {
        workspaceId: workspace.id,
        module: 'COMMUNICATION',
        provider: 'ZAPI',
        label: 'Zap',
        phoneNumber: '5511000000000',
        webhookSecret: 'secret-zap',
        createdById: owner.id,
      },
    })
    const list = await getJson(`${wa(workspace.id)}/connections`, owner.cookie)
    expect((await list.json()).data).toHaveLength(0)
  })

  it('renames a connection, switches the active one and removes it', async () => {
    const { owner, workspace } = await setup()
    const first = await createConnection(workspace.id, owner.cookie)
    const second = await postJson(
      `${wa(workspace.id)}/connections`,
      {
        ...ZAPI_CONNECTION,
        label: 'Plantão',
        // O número é único por workspace + provedor.
        phoneNumber: '5511966665555',
        zapiInstanceId: 'inst-2',
      },
      owner.cookie,
    )
    expect(second.status).toBe(201)
    const other = (await second.json()).data as { id: string; active: boolean }
    expect(other.active).toBe(false)

    const renamed = await patchJson(
      `${wa(workspace.id)}/connections/${other.id}`,
      { label: 'Plantão 24h' },
      owner.cookie,
    )
    expect(renamed.status).toBe(200)
    expect((await renamed.json()).data.label).toBe('Plantão 24h')

    const activated = await patchJson(
      `${api(workspace.id)}/settings`,
      { whatsappConnectionId: other.id },
      owner.cookie,
    )
    expect(activated.status).toBe(200)
    expect((await activated.json()).data.whatsappConnectionId).toBe(other.id)

    const removed = await deleteJson(
      `${wa(workspace.id)}/connections/${other.id}`,
      owner.cookie,
    )
    expect(removed.status).toBe(200)

    const settings = await getJson(
      `${api(workspace.id)}/settings`,
      owner.cookie,
    )
    expect((await settings.json()).data.whatsappConnectionId).toBeNull()

    const list = await getJson(`${wa(workspace.id)}/connections`, owner.cookie)
    const rows = (await list.json()).data as { id: string }[]
    expect(rows.map((row) => row.id)).toEqual([first.id])
  })

  it('rejects an invalid payload and an unknown connection', async () => {
    const { owner, workspace } = await setup()
    const invalid = await postJson(
      `${wa(workspace.id)}/connections`,
      { provider: 'ZAPI', label: '', phoneNumber: 'abc' },
      owner.cookie,
    )
    expect(invalid.status).toBe(422)

    const missing = await deleteJson(
      `${wa(workspace.id)}/connections/nope`,
      owner.cookie,
    )
    expect(missing.status).toBe(404)
    expect((await missing.json()).error.code).toBe(
      'WHATSAPP_CONNECTION_NOT_FOUND',
    )
  })

  it('offers the QR code only for Z-API connections', async () => {
    const { owner, workspace } = await setup()
    const meta = await postJson(
      `${wa(workspace.id)}/connections`,
      {
        provider: 'META',
        label: 'Oficial',
        phoneNumber: '5511977776666',
        metaPhoneNumberId: 'pn-1',
        metaWabaId: 'waba-1',
        metaAccessToken: 'token-meta',
      },
      owner.cookie,
    )
    expect(meta.status).toBe(201)
    const created = (await meta.json()).data as { id: string }

    const res = await getJson(
      `${wa(workspace.id)}/connections/${created.id}/qr-code`,
      owner.cookie,
    )
    expect(res.status).toBe(400)
  })
})

describe('ServiceDesk WhatsApp — ticket tab', () => {
  it('reports that no connection is configured', async () => {
    const { owner, workspace } = await setup()
    const ticket = await createTicket(workspace.id, owner.cookie)

    const state = await getJson(
      `${wa(workspace.id)}/tickets/${ticket.id}`,
      owner.cookie,
    )
    expect(state.status).toBe(200)
    expect((await state.json()).data).toMatchObject({
      configured: false,
      connection: null,
      conversation: null,
    })

    const start = await postJson(
      `${wa(workspace.id)}/tickets/${ticket.id}/start`,
      { waId: '5511999998888' },
      owner.cookie,
    )
    expect(start.status).toBe(422)
    expect((await start.json()).error.code).toBe('SD_WHATSAPP_NOT_CONFIGURED')
  })

  it('starts, lists, unlinks and relinks the conversation of a ticket', async () => {
    const { owner, workspace } = await setup()
    await createConnection(workspace.id, owner.cookie)
    const ticket = await createTicket(workspace.id, owner.cookie)
    const base = `${wa(workspace.id)}/tickets/${ticket.id}`

    const started = await postJson(
      `${base}/start`,
      { waId: '5511999998888' },
      owner.cookie,
    )
    expect(started.status).toBe(201)
    const state = (await started.json()).data
    expect(state.configured).toBe(true)
    expect(state.conversation.contact.waId).toBe('5511999998888')
    // Z-API não tem janela de 24 h: texto livre sempre liberado.
    expect(state.window).toMatchObject({
      open: true,
      requiresTemplate: false,
    })

    const messages = await getJson(`${base}/messages`, owner.cookie)
    expect(messages.status).toBe(200)
    expect((await messages.json()).data).toEqual([])

    const templates = await getJson(`${base}/templates`, owner.cookie)
    expect(templates.status).toBe(200)
    expect((await templates.json()).data).toEqual([])

    const conversations = await getJson(
      `${wa(workspace.id)}/conversations`,
      owner.cookie,
    )
    expect(conversations.status).toBe(200)
    const rows = (await conversations.json()).data as { id: string }[]
    expect(rows.map((row) => row.id)).toContain(state.conversation.id)

    const unlinked = await deleteJson(base, owner.cookie)
    expect(unlinked.status).toBe(200)
    expect((await unlinked.json()).data.conversation).toBeNull()

    const again = await deleteJson(base, owner.cookie)
    expect(again.status).toBe(404)
    expect((await again.json()).error.code).toBe(
      'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
    )

    const relinked = await postJson(
      `${base}/link`,
      { conversationId: state.conversation.id },
      owner.cookie,
    )
    expect(relinked.status).toBe(200)
    expect((await relinked.json()).data.conversation.id).toBe(
      state.conversation.id,
    )
  })

  it('refuses to link a conversation that is not of the module', async () => {
    const { owner, workspace } = await setup()
    await createConnection(workspace.id, owner.cookie)
    const ticket = await createTicket(workspace.id, owner.cookie)

    const res = await postJson(
      `${wa(workspace.id)}/tickets/${ticket.id}/link`,
      { conversationId: 'c'.repeat(25) },
      owner.cookie,
    )
    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe(
      'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
    )
  })

  it('rejects an empty text and a start with a number that is not a phone', async () => {
    const { owner, workspace } = await setup()
    await createConnection(workspace.id, owner.cookie)
    const ticket = await createTicket(workspace.id, owner.cookie)
    const base = `${wa(workspace.id)}/tickets/${ticket.id}`

    const empty = await postJson(
      `${base}/messages`,
      { text: '  ' },
      owner.cookie,
    )
    expect(empty.status).toBe(422)

    const letters = await postJson(
      `${base}/start`,
      { waId: 'telefone' },
      owner.cookie,
    )
    expect(letters.status).toBe(422)

    const short = await postJson(`${base}/start`, { waId: '123' }, owner.cookie)
    expect(short.status).toBe(422)
  })

  it('refuses to send without a linked conversation', async () => {
    const { owner, workspace } = await setup()
    await createConnection(workspace.id, owner.cookie)
    const ticket = await createTicket(workspace.id, owner.cookie)
    const base = `${wa(workspace.id)}/tickets/${ticket.id}`

    const text = await postJson(
      `${base}/messages`,
      { text: 'Olá' },
      owner.cookie,
    )
    expect(text.status).toBe(404)
    expect((await text.json()).error.code).toBe(
      'SD_WHATSAPP_CONVERSATION_NOT_FOUND',
    )

    const template = await postJson(
      `${base}/template`,
      { templateName: 'retomada', language: 'pt_BR' },
      owner.cookie,
    )
    expect(template.status).toBe(404)
  })
})
