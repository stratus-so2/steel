import { describe, expect, it } from 'vitest'
import {
  createFakeSdMailbox,
  createFakeSdMailMessage,
} from '@/src/__tests__/factories/sd-mailbox.factory'
import { toSdMailboxDTO, toSdTicketMailMessageDTO } from '../sd-mailbox.mapper'

describe('toSdMailboxDTO', () => {
  it('maps the row and never leaks the encrypted passwords', () => {
    const dto = toSdMailboxDTO(
      createFakeSdMailbox({
        lastSyncAt: new Date('2026-10-01T13:30:00.000Z'),
        lastSeenUid: 42,
      }),
    )

    expect(dto).toEqual({
      id: 'mb1',
      workspaceId: 'ws1',
      name: 'Suporte',
      address: 'suporte@empresa.com.br',
      status: 'ACTIVE',
      statusError: null,
      imapHost: 'imap.empresa.com.br',
      imapPort: 993,
      imapSecure: true,
      imapUser: 'suporte@empresa.com.br',
      folder: 'INBOX',
      processedFolder: null,
      smtpHost: null,
      smtpPort: null,
      smtpSecure: true,
      smtpUser: null,
      smtpConfigured: false,
      defaultType: 'INCIDENT',
      defaultDepartmentId: null,
      defaultCategoryId: null,
      defaultPriorityId: null,
      allowedSenders: [],
      blockedSenders: [],
      createUnknownContacts: true,
      sendAcknowledgement: true,
      lastSyncAt: '2026-10-01T13:30:00.000Z',
      lastSeenUid: 42,
      createdAt: '2026-10-01T12:00:00.000Z',
      updatedAt: '2026-10-01T12:00:00.000Z',
    })
    expect(JSON.stringify(dto)).not.toContain('enc:')
  })

  it('reports smtpConfigured only with both host and password', () => {
    const host = { smtpHost: 'smtp.empresa.com.br', smtpPort: 465 }
    expect(toSdMailboxDTO(createFakeSdMailbox(host)).smtpConfigured).toBe(false)
    expect(
      toSdMailboxDTO(
        createFakeSdMailbox({ ...host, encryptedSmtpPassword: 'enc:smtp' }),
      ).smtpConfigured,
    ).toBe(true)
    expect(
      toSdMailboxDTO(createFakeSdMailbox({ encryptedSmtpPassword: 'enc:smtp' }))
        .smtpConfigured,
    ).toBe(false)
  })

  it('carries the error of the last read', () => {
    const dto = toSdMailboxDTO(
      createFakeSdMailbox({ status: 'ERROR', statusError: 'Login recusado' }),
    )
    expect(dto).toMatchObject({
      status: 'ERROR',
      statusError: 'Login recusado',
    })
  })
})

describe('toSdTicketMailMessageDTO', () => {
  it('maps the header fields used by the history marker', () => {
    expect(
      toSdTicketMailMessageDTO(
        createFakeSdMailMessage({
          id: 'mm1',
          ticketMessageId: 'tm1',
          ccAddresses: ['chefe@cliente.com'],
        }),
      ),
    ).toEqual({
      id: 'mm1',
      ticketMessageId: 'tm1',
      direction: 'INBOUND',
      fromAddress: 'cliente@cliente.com',
      fromName: 'Cliente',
      toAddresses: ['suporte@empresa.com.br'],
      ccAddresses: ['chefe@cliente.com'],
      subject: 'Impressora parada',
      automatic: false,
      createdAt: '2026-10-01T12:00:00.000Z',
    })
  })

  it('maps an outbound automatic row', () => {
    const dto = toSdTicketMailMessageDTO(
      createFakeSdMailMessage({
        direction: 'OUTBOUND',
        automatic: true,
        fromName: null,
        subject: null,
        ticketMessageId: null,
      }),
    )
    expect(dto).toMatchObject({
      direction: 'OUTBOUND',
      automatic: true,
      fromName: null,
      subject: null,
      ticketMessageId: null,
    })
  })
})
