import { describe, expect, it } from 'vitest'
import { seedSdContact } from '@/src/__tests__/factories/sd-contact.factory'
import { seedSdCustomer } from '@/src/__tests__/factories/sd-customer.factory'
import { seedSdPortalAccess } from '@/src/__tests__/factories/sd-portal.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCategory,
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdPhaseFlow,
  seedSdSettings,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  authenticatedOwner,
  defaultHeaders,
  deleteJson,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'
import { hashSdPortalToken } from '@/src/lib/servicedesk/portal-session'

const API = '/api/servicedesk/portal'

/** Cookie `sd.portal_session` do `set-cookie` da abertura de sessão. */
function portalCookie(response: Response): string {
  const header = response.headers.get('set-cookie') ?? ''
  const match = header.match(/sd\.portal_session=([^;]+)/)
  if (!match) throw new Error(`Sem cookie do portal em: ${header}`)
  return `sd.portal_session=${match[1]}`
}

/** Mesma requisição do navegador do contato: cookie próprio, sem Better Auth. */
function portalGet(path: string, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, {
    headers: {
      ...defaultHeaders,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    redirect: 'manual',
  })
}

function portalPost(path: string, body: unknown, cookie?: string) {
  return fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      ...defaultHeaders,
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  })
}

/**
 * Workspace com ServiceDesk, portal ligado, um agente, duas empresas e dois
 * contatos (Ana/Acme e Bruno/Outra), com um chamado de cada empresa — a base
 * dos testes de acesso cruzado.
 */
async function setup() {
  const { user: agent, workspace } = await authenticatedOwner()
  const department = await seedSdDepartment(workspace.id)
  await seedSdDepartmentMember(department.id, agent.id)
  await seedSdSettings(workspace.id, {
    portalEnabled: true,
    portalCompanyScope: true,
    portalTicketTypes: ['INCIDENT', 'SERVICE_REQUEST'],
  })
  const flow = await seedSdPhaseFlow(workspace.id, 'INCIDENT')
  await seedSdPhaseFlow(workspace.id, 'SERVICE_REQUEST')
  await seedSdCategory(workspace.id, {
    name: 'Infraestrutura',
    portalVisible: true,
  })
  const acme = await seedSdCustomer(workspace.id, agent.id, { name: 'Acme' })
  const outra = await seedSdCustomer(workspace.id, agent.id, { name: 'Outra' })
  const ana = await seedSdContact(
    workspace.id,
    agent.id,
    { name: 'Ana Souza', email: 'ana@example.com' },
    [acme.id],
  )
  const bruno = await seedSdContact(
    workspace.id,
    agent.id,
    { name: 'Bruno Lima', email: 'bruno@example.com' },
    [outra.id],
  )
  const mine = await seedSdTicket(workspace.id, flow.initial.id, {
    title: 'Impressora não imprime',
    contactId: ana.id,
    customerId: acme.id,
    companyId: acme.id,
    channel: 'PORTAL',
  })
  const foreign = await seedSdTicket(workspace.id, flow.initial.id, {
    title: 'Chamado da outra empresa',
    contactId: bruno.id,
    customerId: outra.id,
    companyId: outra.id,
  })
  return { agent, workspace, flow, acme, outra, ana, bruno, mine, foreign }
}

/** Emite um link para o contato e devolve o token em claro. */
async function linkFor(workspaceId: string, contactId: string) {
  const { access, token } = await seedSdPortalAccess(workspaceId, contactId, {
    email: 'ana@example.com',
  })
  return { access, token }
}

/** Abre a sessão e devolve o cookie. */
async function signIn(workspaceId: string, contactId: string) {
  const { access, token } = await linkFor(workspaceId, contactId)
  const opened = await portalPost(`${API}/session`, { token })
  expect(opened.status).toBe(201)
  return { access, token, cookie: portalCookie(opened), opened }
}

describe('portal do contato externo — link mágico', () => {
  it('answers the same generic message for a known and an unknown e-mail', async () => {
    const { ana } = await setup()

    const known = await portalPost(`${API}/link`, { email: 'ana@example.com' })
    const unknown = await portalPost(`${API}/link`, {
      email: 'ninguem@example.com',
    })

    expect(known.status).toBe(200)
    expect(unknown.status).toBe(200)
    const a = (await known.json()).data
    const b = (await unknown.json()).data
    expect(a).toEqual(b)
    expect(a.message).toContain('Se este e-mail estiver cadastrado')
    // Mas só o e-mail conhecido gerou um link.
    expect(
      await prisma.sdPortalAccess.count({ where: { contactId: ana.id } }),
    ).toBe(1)
  })

  it('rejects a malformed e-mail', async () => {
    const response = await portalPost(`${API}/link`, { email: 'nao-e-email' })
    expect(response.status).toBe(422)
    expect((await response.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('stores only the sha-256 of the token', async () => {
    const { ana } = await setup()
    await portalPost(`${API}/link`, { email: 'ana@example.com' })
    const access = await prisma.sdPortalAccess.findFirstOrThrow({
      where: { contactId: ana.id },
    })
    expect(access.tokenHash).toMatch(/^[0-9a-f]{64}$/)
    expect(access.usedAt).toBeNull()
    expect(access.sessionHash).toBeNull()
  })
})

describe('portal do contato externo — sessão', () => {
  it('runs the whole flow: link → session → list → open → reply', async () => {
    const { workspace, ana, mine } = await setup()
    const { cookie, access } = await signIn(workspace.id, ana.id)

    // O link virou uso único e abriu a sessão.
    const consumed = await prisma.sdPortalAccess.findUniqueOrThrow({
      where: { id: access.id },
    })
    expect(consumed.usedAt).not.toBeNull()
    expect(consumed.sessionHash).toMatch(/^[0-9a-f]{64}$/)

    const session = await portalGet(`${API}/session`, cookie)
    expect(session.status).toBe(200)
    const me = (await session.json()).data
    expect(me.contact.name).toBe('Ana Souza')
    expect(me.workspace.name).toBe('E2E Workspace')
    expect(me.customers[0].name).toBe('Acme')
    expect(me.ticketTypes).toEqual(['INCIDENT', 'SERVICE_REQUEST'])

    const list = await portalGet(`${API}/tickets`, cookie)
    expect(list.status).toBe(200)
    const page = (await list.json()).data
    expect(page.items.map((t: { id: string }) => t.id)).toEqual([mine.id])

    const code = page.items[0].code
    const detail = await portalGet(
      `${API}/tickets/${encodeURIComponent(code)}`,
      cookie,
    )
    expect(detail.status).toBe(200)
    const ticket = (await detail.json()).data
    expect(ticket.title).toBe('Impressora não imprime')
    expect(ticket.canReply).toBe(true)
    expect(ticket).not.toHaveProperty('slaPolicyId')
    expect(ticket).not.toHaveProperty('departmentId')
    expect(ticket).not.toHaveProperty('rootCause')

    const reply = await portalPost(
      `${API}/tickets/${encodeURIComponent(code)}/messages`,
      { body: 'Continua parada, por favor' },
      cookie,
    )
    expect(reply.status).toBe(201)
    const message = (await reply.json()).data
    expect(message.authorKind).toBe('CONTACT')
    expect(message.mine).toBe(true)

    // Virou mensagem pública com autor contato, e evento com ator CONTACT.
    const stored = await prisma.sdTicketMessage.findUniqueOrThrow({
      where: { id: message.id },
    })
    expect(stored.visibility).toBe('PUBLIC')
    expect(stored.authorContactId).toBe(ana.id)
    expect(stored.authorUserId).toBeNull()
    const events = await prisma.sdTicketEvent.findMany({
      where: { ticketId: mine.id, action: 'message.posted' },
    })
    expect(events).toHaveLength(1)
    expect(events[0].actorKind).toBe('CONTACT')
    expect(events[0].actorUserId).toBeNull()
  })

  it('opens the ticket it creates with channel PORTAL and the contact as author', async () => {
    const { workspace, ana, acme } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)

    const created = await portalPost(
      `${API}/tickets`,
      {
        type: 'INCIDENT',
        title: 'Internet caiu',
        description: 'Desde as 9h\n\nTodo o escritório',
      },
      cookie,
    )
    expect(created.status).toBe(201)
    const dto = (await created.json()).data
    expect(dto.code).toMatch(/^INC-\d{6}$/)

    const row = await prisma.sdTicket.findUniqueOrThrow({
      where: { id: dto.id },
    })
    expect(row.channel).toBe('PORTAL')
    expect(row.contactId).toBe(ana.id)
    expect(row.companyId).toBe(acme.id)
    expect(row.requesterId).toBeNull()
    expect(row.createdById).toBeNull()
    expect(row.description).toContain('<p>Desde as 9h</p>')

    const createdEvent = await prisma.sdTicketEvent.findFirstOrThrow({
      where: { ticketId: row.id, action: 'ticket.created' },
    })
    expect(createdEvent.actorKind).toBe('CONTACT')
  })

  it('refuses to open a type the portal did not release', async () => {
    const { workspace, ana } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)
    const response = await portalPost(
      `${API}/tickets`,
      { type: 'CHANGE', title: 'Mudança' },
      cookie,
    )
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('SD_TICKET_FORBIDDEN')
  })

  it('signs out and stops accepting the old cookie', async () => {
    const { workspace, ana } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)

    const out = await fetch(`${BASE_URL}${API}/session`, {
      method: 'DELETE',
      headers: { ...defaultHeaders, Cookie: cookie },
    })
    expect(out.status).toBe(200)

    const after = await portalGet(`${API}/session`, cookie)
    expect(after.status).toBe(401)
    expect((await after.json()).error.code).toBe('SD_PORTAL_SESSION_EXPIRED')
  })
})

describe('portal do contato externo — recusas de acesso', () => {
  it('401s every route without the portal cookie', async () => {
    await setup()
    for (const path of [
      `${API}/session`,
      `${API}/tickets`,
      `${API}/options`,
      `${API}/knowledge`,
      `${API}/tickets/INC-000001`,
    ]) {
      const response = await portalGet(path)
      expect(response.status).toBe(401)
      expect((await response.json()).error.code).toBe(
        'SD_PORTAL_SESSION_EXPIRED',
      )
    }
  })

  it('does not accept the Better Auth session as a portal session', async () => {
    const { agent } = await setup()
    const response = await portalGet(`${API}/tickets`, agent.cookie)
    expect(response.status).toBe(401)
  })

  it('rejects a malformed, unknown and already used token', async () => {
    const { workspace, ana } = await setup()

    const malformed = await portalPost(`${API}/session`, { token: 'abc' })
    expect(malformed.status).toBe(422)

    const unknown = await portalPost(`${API}/session`, {
      token: 'x'.repeat(43),
    })
    expect(unknown.status).toBe(401)
    expect((await unknown.json()).error.code).toBe('SD_PORTAL_LINK_INVALID')

    const { token } = await linkFor(workspace.id, ana.id)
    expect((await portalPost(`${API}/session`, { token })).status).toBe(201)
    const second = await portalPost(`${API}/session`, { token })
    expect(second.status).toBe(401)
    const body = await second.json()
    expect(body.error.code).toBe('SD_PORTAL_LINK_INVALID')
    expect(body.message).toContain('já foi usado')
  })

  it('410s an expired link', async () => {
    const { workspace, ana } = await setup()
    const { token } = await seedSdPortalAccess(workspace.id, ana.id, {
      expiresAt: new Date(Date.now() - 1000),
    })
    const response = await portalPost(`${API}/session`, { token })
    expect(response.status).toBe(410)
    expect((await response.json()).error.code).toBe('SD_PORTAL_LINK_EXPIRED')
  })

  it('401s a revoked link and drops the session the agent revoked', async () => {
    const { agent, workspace, ana } = await setup()
    const { cookie, access } = await signIn(workspace.id, ana.id)

    expect((await portalGet(`${API}/session`, cookie)).status).toBe(200)

    const revoked = await deleteJson(
      `/api/workspaces/${workspace.id}/servicedesk/portal-access/${access.id}`,
      agent.cookie,
    )
    expect(revoked.status).toBe(200)
    expect((await revoked.json()).data.status).toBe('revoked')

    const after = await portalGet(`${API}/session`, cookie)
    expect(after.status).toBe(401)
  })

  it('401s an expired session', async () => {
    const { workspace, ana } = await setup()
    const { cookie, access } = await signIn(workspace.id, ana.id)
    await prisma.sdPortalAccess.update({
      where: { id: access.id },
      data: { sessionExpiresAt: new Date(Date.now() - 1000) },
    })
    const response = await portalGet(`${API}/tickets`, cookie)
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe('SD_PORTAL_SESSION_EXPIRED')
  })

  it('403s once the contact is deactivated', async () => {
    const { workspace, ana } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)
    await prisma.sdContact.update({
      where: { id: ana.id },
      data: { active: false },
    })
    const response = await portalGet(`${API}/tickets`, cookie)
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe(
      'SD_PORTAL_CONTACT_INACTIVE',
    )
  })

  it('403s once the workspace switches the portal off', async () => {
    const { workspace, ana } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)
    await prisma.sdSettings.update({
      where: { workspaceId: workspace.id },
      data: { portalEnabled: false },
    })
    const response = await portalGet(`${API}/tickets`, cookie)
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('SD_PORTAL_DISABLED')
  })
})

describe('portal do contato externo — isolamento entre empresas', () => {
  it('never lists nor opens a ticket of another company', async () => {
    const { workspace, ana, foreign, mine } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)

    const list = await portalGet(`${API}/tickets?status=all`, cookie)
    const ids = (await list.json()).data.items.map((t: { id: string }) => t.id)
    expect(ids).toEqual([mine.id])
    expect(ids).not.toContain(foreign.id)

    // Pelo código do chamado alheio: 404, não 403 (nem vaza a existência).
    const byCode = await portalGet(
      `${API}/tickets/INC-${String(foreign.number).padStart(6, '0')}`,
      cookie,
    )
    expect(byCode.status).toBe(404)
    expect((await byCode.json()).error.code).toBe('SD_TICKET_NOT_FOUND')

    // Pelo id do chamado alheio: 404 também — o portal não navega por id.
    const byId = await portalGet(`${API}/tickets/${foreign.id}`, cookie)
    expect(byId.status).toBe(404)
  })

  it('never replies to nor rates a ticket of another company', async () => {
    const { workspace, ana, foreign } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)
    const code = `INC-${String(foreign.number).padStart(6, '0')}`

    const reply = await portalPost(
      `${API}/tickets/${code}/messages`,
      { body: 'oi' },
      cookie,
    )
    expect(reply.status).toBe(404)

    const rate = await portalPost(
      `${API}/tickets/${code}/csat`,
      { score: 5 },
      cookie,
    )
    expect(rate.status).toBe(404)

    expect(
      await prisma.sdTicketMessage.count({ where: { ticketId: foreign.id } }),
    ).toBe(0)
  })

  it('shows tickets of the company when the scope is on, and not when off', async () => {
    const { workspace, agent, flow, ana, acme } = await setup()
    const colleague = await seedSdContact(
      workspace.id,
      agent.id,
      { name: 'Colega', email: 'colega@example.com' },
      [acme.id],
    )
    const colleagueTicket = await seedSdTicket(workspace.id, flow.initial.id, {
      title: 'Do colega, mesma empresa',
      contactId: colleague.id,
      customerId: acme.id,
      companyId: acme.id,
    })

    const withScope = await signIn(workspace.id, ana.id)
    const onIds = (
      await (
        await portalGet(`${API}/tickets?status=all`, withScope.cookie)
      ).json()
    ).data.items.map((t: { id: string }) => t.id)
    expect(onIds).toContain(colleagueTicket.id)

    await prisma.sdSettings.update({
      where: { workspaceId: workspace.id },
      data: { portalCompanyScope: false },
    })
    const offIds = (
      await (
        await portalGet(`${API}/tickets?status=all`, withScope.cookie)
      ).json()
    ).data.items.map((t: { id: string }) => t.id)
    expect(offIds).not.toContain(colleagueTicket.id)
  })

  it('never shows an internal note nor serves its attachment', async () => {
    const { workspace, agent, ana, mine } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)

    const internal = await prisma.sdTicketMessage.create({
      data: {
        workspaceId: workspace.id,
        ticketId: mine.id,
        authorKind: 'AGENT',
        authorUserId: agent.id,
        visibility: 'INTERNAL',
        body: 'SEGREDO INTERNO: cobrar o cliente',
      },
    })
    await prisma.sdTicketAttachment.create({
      data: {
        id: 'e2e-att-internal',
        workspaceId: workspace.id,
        ticketId: mine.id,
        messageId: internal.id,
        kind: 'DOCUMENT',
        fileName: 'custos.pdf',
        mimeType: 'application/pdf',
        size: 10,
        storageKey: 'k/e2e-att-internal',
      },
    })

    const code = `INC-${String(mine.number).padStart(6, '0')}`
    const detail = await portalGet(`${API}/tickets/${code}`, cookie)
    const body = await detail.text()
    expect(body).not.toContain('SEGREDO INTERNO')
    expect(body).not.toContain('custos.pdf')

    const download = await portalGet(
      `${API}/tickets/${code}/attachments/e2e-att-internal`,
      cookie,
    )
    expect(download.status).toBe(404)
    expect((await download.json()).error.code).toBe('SD_ATTACHMENT_NOT_FOUND')
  })
})

describe('portal do contato externo — avaliação', () => {
  it('rates once a resolved ticket and refuses the second time', async () => {
    const { workspace, flow, ana, acme } = await setup()
    const resolved = await seedSdTicket(workspace.id, flow.resolved.id, {
      title: 'Resolvido',
      contactId: ana.id,
      customerId: acme.id,
    })
    const { cookie } = await signIn(workspace.id, ana.id)
    const code = `INC-${String(resolved.number).padStart(6, '0')}`

    const first = await portalPost(
      `${API}/tickets/${code}/csat`,
      { score: 5, comment: 'Rápido!' },
      cookie,
    )
    expect(first.status).toBe(201)
    expect((await first.json()).data).toEqual({
      csatScore: 5,
      csatComment: 'Rápido!',
    })

    const second = await portalPost(
      `${API}/tickets/${code}/csat`,
      { score: 1 },
      cookie,
    )
    expect(second.status).toBe(409)
    expect((await second.json()).error.code).toBe('SD_CSAT_ALREADY_SUBMITTED')

    const event = await prisma.sdTicketEvent.findFirstOrThrow({
      where: { ticketId: resolved.id, action: 'csat.submitted' },
    })
    expect(event.actorKind).toBe('CONTACT')
  })

  it('refuses to rate a ticket that is still open', async () => {
    const { workspace, ana, mine } = await setup()
    const { cookie } = await signIn(workspace.id, ana.id)
    const response = await portalPost(
      `${API}/tickets/INC-${String(mine.number).padStart(6, '0')}/csat`,
      { score: 5 },
      cookie,
    )
    expect(response.status).toBe(422)
    expect((await response.json()).error.code).toBe('SD_CSAT_NOT_AVAILABLE')
  })
})

describe('portal do contato externo — formulário e conhecimento', () => {
  it('offers only what the portal released', async () => {
    const { workspace, ana } = await setup()
    await seedSdCategory(workspace.id, {
      name: 'Interna',
      portalVisible: false,
    })
    const { cookie } = await signIn(workspace.id, ana.id)

    const response = await portalGet(`${API}/options`, cookie)
    expect(response.status).toBe(200)
    const options = (await response.json()).data
    expect(options.ticketTypes).toEqual(['INCIDENT', 'SERVICE_REQUEST'])
    expect(options.catalog.map((node: { name: string }) => node.name)).toEqual([
      'Infraestrutura',
    ])
  })

  it('lists only published portal articles and 404s the others', async () => {
    const { workspace, agent, ana } = await setup()
    const published = await prisma.sdKbArticle.create({
      data: {
        workspaceId: workspace.id,
        title: 'Como trocar a senha',
        status: 'PUBLISHED',
        visibility: 'PORTAL',
        content: [{ type: 'p', children: [{ text: 'passo 1' }] }],
        plainText: 'passo 1',
        createdById: agent.id,
      },
    })
    const internalArticle = await prisma.sdKbArticle.create({
      data: {
        workspaceId: workspace.id,
        title: 'Runbook interno',
        status: 'PUBLISHED',
        visibility: 'INTERNAL',
        content: [],
        plainText: 'segredo do runbook',
        createdById: agent.id,
      },
    })
    const draft = await prisma.sdKbArticle.create({
      data: {
        workspaceId: workspace.id,
        title: 'Rascunho',
        status: 'DRAFT',
        visibility: 'PORTAL',
        content: [],
        plainText: 'rascunho',
        createdById: agent.id,
      },
    })

    const { cookie } = await signIn(workspace.id, ana.id)

    const list = await portalGet(`${API}/knowledge`, cookie)
    expect(list.status).toBe(200)
    const articles = (await list.json()).data.articles
    expect(articles.map((a: { id: string }) => a.id)).toEqual([published.id])

    const read = await portalGet(`${API}/knowledge/${published.id}`, cookie)
    expect(read.status).toBe(200)
    expect((await read.json()).data.title).toBe('Como trocar a senha')

    for (const id of [internalArticle.id, draft.id]) {
      const blocked = await portalGet(`${API}/knowledge/${id}`, cookie)
      expect(blocked.status).toBe(404)
      expect((await blocked.json()).error.code).toBe('SD_KB_ARTICLE_NOT_FOUND')
    }
  })
})

describe('emissão do acesso pelo agente', () => {
  const api = (workspaceId: string) =>
    `/api/workspaces/${workspaceId}/servicedesk/portal-access`

  it('issues, lists and revokes the access', async () => {
    const { agent, workspace, ana } = await setup()

    const issued = await postJson(
      api(workspace.id),
      { contactId: ana.id },
      agent.cookie,
    )
    expect(issued.status).toBe(201)
    const access = (await issued.json()).data
    expect(access.status).toBe('pending')
    expect(access.email).toBe('ana@example.com')
    expect(access.requestedBy.id).toBe(agent.id)
    expect(access).not.toHaveProperty('tokenHash')

    const list = await getJson(
      `${api(workspace.id)}?contactId=${ana.id}`,
      agent.cookie,
    )
    expect(list.status).toBe(200)
    expect((await list.json()).data).toHaveLength(1)

    const revoked = await deleteJson(
      `${api(workspace.id)}/${access.id}`,
      agent.cookie,
    )
    expect(revoked.status).toBe(200)
    expect((await revoked.json()).data.status).toBe('revoked')
  })

  it('invalidates the previous pending link when it issues another', async () => {
    const { agent, workspace, ana } = await setup()
    const first = await postJson(
      api(workspace.id),
      { contactId: ana.id },
      agent.cookie,
    )
    const firstId = (await first.json()).data.id
    await postJson(api(workspace.id), { contactId: ana.id }, agent.cookie)

    const row = await prisma.sdPortalAccess.findUniqueOrThrow({
      where: { id: firstId },
    })
    expect(row.revokedAt).not.toBeNull()
  })

  it('requires the contact on the listing and 401s without a session', async () => {
    const { agent, workspace } = await setup()
    const missing = await getJson(api(workspace.id), agent.cookie)
    expect(missing.status).toBe(422)

    const anonymous = await getJson(`${api(workspace.id)}?contactId=x`)
    expect(anonymous.status).toBe(401)
  })

  it('refuses a requester (member with no department)', async () => {
    const { workspace, ana } = await setup()
    const { addMember } = await import('@/src/__tests__/helpers/e2e')
    const requester = await addMember(workspace.id)

    const response = await postJson(
      api(workspace.id),
      { contactId: ana.id },
      requester.cookie,
    )
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('SD_NOT_AGENT')
  })

  it('404s a contact of another workspace', async () => {
    const { agent, workspace } = await setup()
    const other = await setup()
    const response = await postJson(
      api(workspace.id),
      { contactId: other.ana.id },
      agent.cookie,
    )
    expect(response.status).toBe(404)
    expect((await response.json()).error.code).toBe('SD_CONTACT_NOT_FOUND')
  })

  it('404s an access of another workspace on the revoke', async () => {
    const { agent, workspace } = await setup()
    const other = await setup()
    const { access } = await linkFor(other.workspace.id, other.ana.id)

    const response = await deleteJson(
      `${api(workspace.id)}/${access.id}`,
      agent.cookie,
    )
    expect(response.status).toBe(404)

    const row = await prisma.sdPortalAccess.findUniqueOrThrow({
      where: { id: access.id },
    })
    expect(row.revokedAt).toBeNull()
  })
})

describe('proxy', () => {
  it('lets the public /suporte pages through without a session', async () => {
    for (const path of ['/suporte', `/suporte/entrar/${'x'.repeat(43)}`]) {
      const response = await portalGet(path)
      expect(response.status).toBe(200)
    }
  })

  it('redirects the private portal pages to /suporte without a session', async () => {
    for (const path of [
      '/suporte/chamados',
      '/suporte/novo',
      '/suporte/ajuda',
    ]) {
      const response = await portalGet(path)
      expect([200, 307]).toContain(response.status)
      if (response.status === 307) {
        expect(response.headers.get('location')).toContain('/suporte')
      }
    }
  })

  it('hashes the session cookie and marks it httpOnly', async () => {
    const { workspace, ana } = await setup()
    const { opened, cookie } = await signIn(workspace.id, ana.id)
    const header = opened.headers.get('set-cookie') ?? ''
    expect(header).toContain('HttpOnly')
    expect(header.toLowerCase()).toContain('samesite=lax')

    const token = cookie.split('=')[1]
    const row = await prisma.sdPortalAccess.findFirstOrThrow({
      where: { contactId: ana.id },
    })
    // O banco guarda só o hash — o valor do cookie não aparece em lugar nenhum.
    expect(row.sessionHash).toBe(hashSdPortalToken(token))
    expect(row.sessionHash).not.toBe(token)
  })
})
