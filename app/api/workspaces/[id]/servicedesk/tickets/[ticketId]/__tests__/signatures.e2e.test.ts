import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'
import {
  setupTabs,
  TINY_PNG_BASE64,
  TINY_PNG_DATA_URL,
  tabApi,
} from './sd-tab-e2e.helpers'

describe('ticket signatures', () => {
  it('rejects strangers and non-PNG images', async () => {
    const { workspace, agent, ticket } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)
    const stranger = await createAuthenticatedUser()
    const denied = await getJson(`${base}/signatures`, stranger.cookie)
    expect(denied.status).toBe(403)

    const notPng = await postJson(
      `${base}/signatures`,
      {
        signerName: 'Ana',
        image: `data:image/png;base64,${Buffer.from('not a png').toString('base64')}`,
      },
      agent.cookie,
    )
    expect(notPng.status).toBe(422)
    const jpeg = await postJson(
      `${base}/signatures`,
      { signerName: 'Ana', image: 'data:image/jpeg;base64,AAAA' },
      agent.cookie,
    )
    expect(jpeg.status).toBe(422)
  })

  it('lets the requester sign, serves the image and verifies integrity', async () => {
    const { workspace, requester, agent, ticket, other } = await setupTabs()
    const base = tabApi(workspace.id, ticket.id)

    const signed = await postJson(
      `${base}/signatures`,
      {
        signerName: 'Maria Solicitante',
        signerDocument: '123.456.789-09',
        signerEmail: 'maria@example.com',
        image: TINY_PNG_DATA_URL,
      },
      requester.cookie,
    )
    expect(signed.status).toBe(201)
    const sig = (await signed.json()).data
    expect(sig.purpose).toBe('Aceite do atendimento')
    expect(sig.signedBy.id).toBe(requester.id)
    expect(sig.imageSha256).toBe(
      createHash('sha256')
        .update(Buffer.from(TINY_PNG_BASE64, 'base64'))
        .digest('hex'),
    )
    expect(sig.ticketSha256).toMatch(/^[0-9a-f]{64}$/)

    const list = (
      await (await getJson(`${base}/signatures`, agent.cookie)).json()
    ).data
    expect(list).toHaveLength(1)

    const image = await getJson(sig.imageUrl, requester.cookie)
    expect(image.status).toBe(200)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(Buffer.from(await image.arrayBuffer()).toString('base64')).toBe(
      TINY_PNG_BASE64,
    )

    const verified = await getJson(
      `${base}/signatures/${sig.id}/verify`,
      agent.cookie,
    )
    expect(verified.status).toBe(200)
    const check = (await verified.json()).data
    expect(check.imageIntact).toBe(true)
    expect(check.computedImageSha256).toBe(sig.imageSha256)
    expect(check.ticketUnchanged).toBe(true)

    await prisma.sdTicket.update({
      where: { id: ticket.id },
      data: { solution: 'Fusor trocado' },
    })
    const changed = (
      await (
        await getJson(`${base}/signatures/${sig.id}/verify`, agent.cookie)
      ).json()
    ).data
    expect(changed.imageIntact).toBe(true)
    expect(changed.ticketUnchanged).toBe(false)

    const cross = await getJson(
      `${tabApi(workspace.id, other.id)}/signatures/${sig.id}/verify`,
      agent.cookie,
    )
    expect(cross.status).toBe(404)
    expect((await cross.json()).error.code).toBe('SD_SIGNATURE_NOT_FOUND')

    const missingImage = await getJson(
      `${base}/signatures/nope/image`,
      agent.cookie,
    )
    expect(missingImage.status).toBe(404)

    const event = await prisma.sdTicketEvent.findFirst({
      where: { ticketId: ticket.id, action: 'signed' },
    })
    expect(event?.actorKind).toBe('REQUESTER')
  })
})
