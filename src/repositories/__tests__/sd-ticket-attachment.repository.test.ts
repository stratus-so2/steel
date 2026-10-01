import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it, vi } from 'vitest'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { seedSdPhase } from '@/src/__tests__/factories/sd-ticket-context.factory'
import {
  seedSdTicketAttachment,
  seedSdTicketMessage,
} from '@/src/__tests__/factories/sd-ticket-tabs.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdTicketAttachmentRepository } from '../sd-ticket-attachment.repository'

async function setup() {
  const [workspace, user, other] = await Promise.all([
    seedWorkspace(),
    seedUser(),
    seedUser(),
  ])
  const phase = await seedSdPhase(workspace.id)
  const ticket = await seedSdTicket(workspace.id, phase.id)
  return { workspace, user, other, ticket }
}

describe('SdTicketAttachmentRepository', () => {
  it('creates with uploader and finds within the ticket', async () => {
    const { workspace, user, ticket } = await setup()
    const id = createId()
    const created = expectOk(
      await SdTicketAttachmentRepository.create({
        id,
        workspaceId: workspace.id,
        ticketId: ticket.id,
        uploadedById: user.id,
        kind: 'IMAGE',
        fileName: 'foto.png',
        mimeType: 'image/png',
        size: 3,
        storageKey: `k/${id}`,
      }),
    )
    expect(created.uploadedBy?.id).toBe(user.id)
    expect(created.message).toBeNull()
    expect(
      expectOk(await SdTicketAttachmentRepository.findById(id, ticket.id)).id,
    ).toBe(id)
    expectErr(
      await SdTicketAttachmentRepository.findById(id, 'other-ticket'),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('lists by visibility (agents vs requesters)', async () => {
    const { workspace, user, other, ticket } = await setup()
    const pub = await seedSdTicketMessage(workspace.id, ticket.id)
    const internal = await seedSdTicketMessage(workspace.id, ticket.id, {
      visibility: 'INTERNAL',
    })
    const deletedMsg = await seedSdTicketMessage(workspace.id, ticket.id, {
      deletedAt: new Date(),
    })
    const onPublic = await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: pub.id,
    })
    const onInternal = await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: internal.id,
    })
    await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: deletedMsg.id,
    })
    const mine = await seedSdTicketAttachment(workspace.id, ticket.id, {
      uploadedById: user.id,
    })
    const theirs = await seedSdTicketAttachment(workspace.id, ticket.id, {
      uploadedById: other.id,
    })
    await seedSdTicketAttachment(workspace.id, ticket.id, {
      deletedAt: new Date(),
    })

    const agent = expectOk(
      await SdTicketAttachmentRepository.listForTicket({
        ticketId: ticket.id,
        includeInternal: true,
        viewerId: user.id,
      }),
    )
    expect(agent.map((a) => a.id).sort()).toEqual(
      [onPublic.id, onInternal.id, mine.id, theirs.id].sort(),
    )

    const requester = expectOk(
      await SdTicketAttachmentRepository.listForTicket({
        ticketId: ticket.id,
        includeInternal: false,
        viewerId: user.id,
      }),
    )
    expect(requester.map((a) => a.id).sort()).toEqual(
      [onPublic.id, mine.id].sort(),
    )
  })

  it('finds unattached ones and soft-deletes', async () => {
    const { workspace, user, ticket } = await setup()
    const msg = await seedSdTicketMessage(workspace.id, ticket.id)
    const free = await seedSdTicketAttachment(workspace.id, ticket.id, {
      uploadedById: user.id,
      kind: 'VIDEO',
    })
    const taken = await seedSdTicketAttachment(workspace.id, ticket.id, {
      messageId: msg.id,
    })
    expect(
      expectOk(
        await SdTicketAttachmentRepository.findUnattached([], ticket.id),
      ),
    ).toEqual([])
    expect(
      expectOk(
        await SdTicketAttachmentRepository.findUnattached(
          [free.id, taken.id],
          ticket.id,
        ),
      ),
    ).toEqual([{ id: free.id, uploadedById: user.id, kind: 'VIDEO' }])

    expectOk(await SdTicketAttachmentRepository.softDelete(free.id, new Date()))
    expectErr(
      await SdTicketAttachmentRepository.findById(free.id, ticket.id),
      'SD_ATTACHMENT_NOT_FOUND',
    )
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const find = vi
      .spyOn(prisma.sdTicketAttachment, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
    const many = vi
      .spyOn(prisma.sdTicketAttachment, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await SdTicketAttachmentRepository.findById('a', 't'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketAttachmentRepository.listForTicket({
        ticketId: 't',
        includeInternal: false,
        viewerId: 'u',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketAttachmentRepository.findUnattached(['a'], 't'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketAttachmentRepository.create({
        id: 'x',
        workspaceId: 'missing',
        ticketId: 'missing',
        uploadedById: 'missing',
        kind: 'OTHER',
        fileName: 'a',
        mimeType: 'a',
        size: 1,
        storageKey: 'a',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SdTicketAttachmentRepository.softDelete('missing', new Date()),
      'DATABASE_ERROR',
    )
    find.mockRestore()
    many.mockRestore()
  })
})
