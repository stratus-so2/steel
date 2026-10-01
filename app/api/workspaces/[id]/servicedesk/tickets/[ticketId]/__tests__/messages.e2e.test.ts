import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  defaultHeaders,
  deleteJson,
  getJson,
  patchJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'
import { setupTabs, tabApi, uploadFile } from './sd-tab-e2e.helpers'

describe('ticket messages — access', () => {
  it('returns 401 without a session and 403 for a non-member', async () => {
    const res = await fetch(`${BASE_URL}${tabApi('x', 'y')}/messages`, {
      headers: defaultHeaders,
    })
    expect(res.status).toBe(401)

    const { workspace, ticket } = await setupTabs()
    const stranger = await createAuthenticatedUser()
    const denied = await getJson(
      `${tabApi(workspace.id, ticket.id)}/messages`,
      stranger.cookie,
    )
    expect(denied.status).toBe(403)
  })

  it('hides tickets the requester is not linked to', async () => {
    const { workspace, requester, other } = await setupTabs()
    const res = await getJson(
      `${tabApi(workspace.id, other.id)}/messages`,
      requester.cookie,
    )
    expect(res.status).toBe(403)
    expect((await res.json()).error.code).toBe('SD_TICKET_FORBIDDEN')
  })
})

describe('ticket messages — chat', () => {
  it('agent and requester talk; internal notes stay with agents', async () => {
    const { workspace, agent, requester, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const question = await postJson(
      `${base}/messages`,
      { body: 'A impressora continua travando 😕' },
      requester.cookie,
    )
    expect(question.status).toBe(201)
    const q = (await question.json()).data
    expect(q.authorKind).toBe('REQUESTER')
    expect(q.visibility).toBe('PUBLIC')
    expect(q.canEdit).toBe(true)

    const internalByRequester = await postJson(
      `${base}/messages`,
      { body: 'segredo', visibility: 'INTERNAL' },
      requester.cookie,
    )
    expect(internalByRequester.status).toBe(403)

    const note = await postJson(
      `${base}/messages`,
      { body: 'Trocar o fusor', visibility: 'INTERNAL' },
      agent.cookie,
    )
    expect(note.status).toBe(201)
    expect((await note.json()).data.visibility).toBe('INTERNAL')

    const answer = await postJson(
      `${base}/messages`,
      { body: 'Já estamos a caminho.' },
      agent.cookie,
    )
    expect(answer.status).toBe(201)
    const row = await prisma.sdTicket.findUniqueOrThrow({
      where: { id: ticket.id },
    })
    expect(row.firstRespondedAt).not.toBeNull()

    const agentView = (
      await (await getJson(`${base}/messages`, agent.cookie)).json()
    ).data
    expect(agentView.items.map((m: { body: string }) => m.body)).toEqual([
      'A impressora continua travando 😕',
      'Trocar o fusor',
      'Já estamos a caminho.',
    ])
    expect(agentView.nextBefore).toBeNull()
    // o agente não edita a mensagem do solicitante
    expect(agentView.items[0].canEdit).toBe(false)

    const requesterView = (
      await (await getJson(`${base}/messages`, requester.cookie)).json()
    ).data
    expect(requesterView.items).toHaveLength(2)
    expect(
      requesterView.items.some(
        (m: { visibility: string }) => m.visibility === 'INTERNAL',
      ),
    ).toBe(false)

    const page = (
      await (await getJson(`${base}/messages?limit=2`, agent.cookie)).json()
    ).data
    expect(page.items).toHaveLength(2)
    expect(page.nextBefore).not.toBeNull()
    const older = (
      await (
        await getJson(
          `${base}/messages?limit=2&before=${page.nextBefore}`,
          agent.cookie,
        )
      ).json()
    ).data
    expect(older.items.map((m: { body: string }) => m.body)).toEqual([
      'A impressora continua travando 😕',
    ])

    const invalid = await getJson(`${base}/messages?limit=0`, agent.cookie)
    expect(invalid.status).toBe(422)
    const empty = await postJson(
      `${base}/messages`,
      { body: '  ' },
      agent.cookie,
    )
    expect(empty.status).toBe(422)
  })

  it('edits and deletes own messages inside the 15-minute window only', async () => {
    const { workspace, agent, requester, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)
    const created = (
      await (
        await postJson(`${base}/messages`, { body: 'Oi' }, requester.cookie)
      ).json()
    ).data

    const byOther = await patchJson(
      `${base}/messages/${created.id}`,
      { body: 'hack' },
      agent.cookie,
    )
    expect(byOther.status).toBe(403)
    expect((await byOther.json()).error.code).toBe('SD_MESSAGE_FORBIDDEN')

    const edited = await patchJson(
      `${base}/messages/${created.id}`,
      { body: 'Olá, bom dia' },
      requester.cookie,
    )
    expect(edited.status).toBe(200)
    const editedBody = (await edited.json()).data
    expect(editedBody.body).toBe('Olá, bom dia')
    expect(editedBody.editedAt).not.toBeNull()

    await prisma.sdTicketMessage.update({
      where: { id: created.id },
      data: { createdAt: new Date(Date.now() - 16 * 60 * 1000) },
    })
    const late = await deleteJson(
      `${base}/messages/${created.id}`,
      requester.cookie,
    )
    expect(late.status).toBe(403)

    const fresh = (
      await (
        await postJson(`${base}/messages`, { body: 'engano' }, requester.cookie)
      ).json()
    ).data
    const removed = await deleteJson(
      `${base}/messages/${fresh.id}`,
      requester.cookie,
    )
    expect(removed.status).toBe(200)
    const again = await deleteJson(
      `${base}/messages/${fresh.id}`,
      requester.cookie,
    )
    expect(again.status).toBe(404)
    expect((await again.json()).error.code).toBe('SD_MESSAGE_NOT_FOUND')
  })

  it('reopens a resolved ticket when the requester replies', async () => {
    const { workspace, requester, ticket, flow } = await setupTabs()
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { phaseId: flow.resolved.id, resolvedAt: new Date() },
    })
    const res = await postJson(
      `${tabApi(workspace.id, ticket.id)}/messages`,
      { body: 'Voltou a falhar' },
      requester.cookie,
    )
    expect(res.status).toBe(201)
    const row = await prisma.sdTicket.findUniqueOrThrow({
      where: { id: ticket.id },
    })
    expect(row.phaseId).toBe(flow.inProgress.id)
    expect(row.reopenCount).toBe(1)
  })

  it('keeps only workspace agents in the mentions', async () => {
    const { workspace, agent, requester, ticket } = await setupTabs()
    const outsider = await createAuthenticatedUser()
    const res = await postJson(
      `${tabApi(workspace.id, ticket.id)}/messages`,
      {
        body: 'Veja isso @Agente',
        // O solicitante não atende e o de fora não é do workspace; o próprio
        // autor nunca se cita.
        mentionedUserIds: [agent.id, requester.id, outsider.id],
      },
      agent.cookie,
    )
    expect(res.status).toBe(201)
    expect((await res.json()).data.mentionedUserIds).toEqual([])

    const second = await postJson(
      `${tabApi(workspace.id, ticket.id)}/messages`,
      { body: 'Agora sim @Agente', mentionedUserIds: [agent.id] },
      requester.cookie,
    )
    expect(second.status).toBe(201)
    expect((await second.json()).data.mentionedUserIds).toEqual([agent.id])
  })

  it('refuses new messages on a closed ticket', async () => {
    const { workspace, agent, ticket, flow } = await setupTabs()
    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { phaseId: flow.closed.id },
    })
    const res = await postJson(
      `${tabApi(workspace.id, ticket.id)}/messages`,
      { body: 'Oi' },
      agent.cookie,
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('SD_TICKET_CLOSED')
  })
})

describe('ticket attachments', () => {
  it('uploads, attaches to a message and serves the file with access checks', async () => {
    const { workspace, agent, requester, ticket, other } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const invalid = await uploadFile(`${base}/attachments`, agent.cookie, {
      name: 'script.exe',
      type: 'application/x-msdownload',
      content: 'MZ',
    })
    expect(invalid.status).toBe(422)
    expect((await invalid.json()).error.code).toBe('SD_ATTACHMENT_INVALID')

    const noFile = await fetch(`${BASE_URL}${base}/attachments`, {
      method: 'POST',
      headers: { Origin: defaultHeaders.Origin, Cookie: agent.cookie },
      body: new FormData(),
    })
    expect(noFile.status).toBe(400)

    const uploaded = await uploadFile(`${base}/attachments`, agent.cookie, {
      name: 'relatório técnico.txt',
      type: 'text/plain',
      content: 'fusor trocado',
    })
    expect(uploaded.status).toBe(201)
    const file = (await uploaded.json()).data
    expect(file.kind).toBe('DOCUMENT')
    expect(file.messageId).toBeNull()
    expect(file.fileName).toBe('relatório técnico.txt')

    // o solicitante não pode usar o anexo solto do agente
    const stolen = await postJson(
      `${base}/messages`,
      { body: 'olha', attachmentIds: [file.id] },
      requester.cookie,
    )
    expect(stolen.status).toBe(404)
    expect((await stolen.json()).error.code).toBe('SD_ATTACHMENT_NOT_FOUND')

    const note = await postJson(
      `${base}/messages`,
      { visibility: 'INTERNAL', attachmentIds: [file.id] },
      agent.cookie,
    )
    expect(note.status).toBe(201)
    const noteBody = (await note.json()).data
    expect(noteBody.attachments).toHaveLength(1)
    expect(noteBody.attachments[0].messageId).toBe(noteBody.id)

    const download = await getJson(
      `${base}/attachments/${file.id}?download=1`,
      agent.cookie,
    )
    expect(download.status).toBe(200)
    expect(download.headers.get('content-type')).toContain('text/plain')
    expect(download.headers.get('content-disposition')).toContain('attachment')
    expect(await download.text()).toBe('fusor trocado')

    const inline = await getJson(`${base}/attachments/${file.id}`, agent.cookie)
    expect(inline.headers.get('content-disposition')).toContain('inline')

    // anexo de nota interna: invisível ao solicitante
    const hidden = await getJson(
      `${base}/attachments/${file.id}`,
      requester.cookie,
    )
    expect(hidden.status).toBe(404)
    const requesterList = (
      await (await getJson(`${base}/attachments`, requester.cookie)).json()
    ).data
    expect(requesterList).toHaveLength(0)
    const agentList = (
      await (await getJson(`${base}/attachments`, agent.cookie)).json()
    ).data
    expect(agentList).toHaveLength(1)

    // id de anexo de outro chamado → 404
    const crossTicket = await getJson(
      `${tabApi(workspace.id, other.id)}/attachments/${file.id}`,
      agent.cookie,
    )
    expect(crossTicket.status).toBe(404)
  })

  it('lets the requester share a public attachment and drop a pending one', async () => {
    const { workspace, agent, requester, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const pending = (
      await (
        await uploadFile(`${base}/attachments`, requester.cookie, {
          name: 'rascunho.txt',
          type: 'text/plain',
          content: 'x',
        })
      ).json()
    ).data
    const dropped = await deleteJson(
      `${base}/attachments/${pending.id}`,
      requester.cookie,
    )
    expect(dropped.status).toBe(200)

    const shot = (
      await (
        await uploadFile(`${base}/attachments`, requester.cookie, {
          name: 'erro.png',
          type: 'image/png',
          content: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
        })
      ).json()
    ).data
    expect(shot.kind).toBe('IMAGE')
    const msg = await postJson(
      `${base}/messages`,
      { body: 'print do erro', attachmentIds: [shot.id] },
      requester.cookie,
    )
    expect(msg.status).toBe(201)

    const seen = await getJson(`${base}/attachments/${shot.id}`, agent.cookie)
    expect(seen.status).toBe(200)
    expect(seen.headers.get('content-type')).toBe('image/png')

    // já enviado numa mensagem: só agentes removem
    const denied = await deleteJson(
      `${base}/attachments/${shot.id}`,
      requester.cookie,
    )
    expect(denied.status).toBe(403)
    const removed = await deleteJson(
      `${base}/attachments/${shot.id}`,
      agent.cookie,
    )
    expect(removed.status).toBe(200)
  })
})
