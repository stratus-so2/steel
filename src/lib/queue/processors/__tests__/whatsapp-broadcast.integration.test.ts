import type { Job } from 'bullmq'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { prisma } from '@/src/lib/prisma'
import { ok } from '@/src/lib/result'
import { WhatsappBroadcastJob } from '../../jobs'

vi.mock('@/src/lib/whatsapp/send', () => ({
  WhatsAppSend: { text: vi.fn(), media: vi.fn(), template: vi.fn() },
}))

import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { processWhatsappBroadcast } from '../whatsapp-broadcast'

const mockedSend = vi.mocked(WhatsAppSend)

function sendJob(broadcastListId: string, recipientId: string): Job {
  return {
    name: WhatsappBroadcastJob.SendBroadcastMessage,
    id: 'test-job',
    data: { broadcastListId, recipientId },
  } as unknown as Job
}

async function seedBroadcast(optedOut: boolean) {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'META',
      label: 'Principal',
      phoneNumber: '5511999990000',
      metaPhoneNumberId: 'phone-id',
      metaWabaId: 'waba-id',
      encryptedMetaAccessToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: {
      workspaceId: workspace.id,
      waId: '5511988887777',
      ...(optedOut
        ? {
            broadcastOptedOutAt: new Date(),
            broadcastOptOutSource: 'KEYWORD' as const,
          }
        : {}),
    },
  })
  const list = await prisma.whatsAppBroadcastList.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      name: 'Promoção',
      messageBody: 'Aproveite!',
      status: 'RUNNING',
      createdById: user.id,
      recipients: { create: [{ contactId: contact.id }] },
    },
    include: { recipients: true },
  })
  return { list, recipient: list.recipients[0] }
}

describe('processWhatsappBroadcast() — opt-out', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should skip a recipient whose contact opted out, without sending', async () => {
    const { list, recipient } = await seedBroadcast(true)

    await processWhatsappBroadcast(sendJob(list.id, recipient.id))

    expect(mockedSend.text).not.toHaveBeenCalled()
    const after = await prisma.whatsAppBroadcastRecipient.findUniqueOrThrow({
      where: { id: recipient.id },
    })
    expect(after.status).toBe('SKIPPED')
    const listAfter = await prisma.whatsAppBroadcastList.findUniqueOrThrow({
      where: { id: list.id },
    })
    expect(listAfter.status).toBe('DONE')
  })

  it('should still send to a contact that did not opt out', async () => {
    const { list, recipient } = await seedBroadcast(false)
    mockedSend.text.mockResolvedValue(ok({ providerMessageId: 'wamid.1' }))

    await processWhatsappBroadcast(sendJob(list.id, recipient.id))

    expect(mockedSend.text).toHaveBeenCalledTimes(1)
    const after = await prisma.whatsAppBroadcastRecipient.findUniqueOrThrow({
      where: { id: recipient.id },
    })
    expect(after.status).toBe('SENT')
  })
})
