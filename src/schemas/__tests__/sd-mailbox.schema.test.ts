import { describe, expect, it } from 'vitest'
import {
  CreateSdMailboxSchema,
  UpdateSdMailboxSchema,
} from '../sd-mailbox.schema'

const base = {
  name: '  Suporte  ',
  address: 'Suporte@Empresa.com.br',
  imapHost: ' imap.empresa.com.br ',
  imapUser: 'suporte',
  imapPassword: 'segredo',
}

describe('CreateSdMailboxSchema', () => {
  it('applies the IMAP defaults and trims the text fields', () => {
    const parsed = CreateSdMailboxSchema.parse(base)
    expect(parsed).toMatchObject({
      name: 'Suporte',
      imapHost: 'imap.empresa.com.br',
      imapPort: 993,
      imapSecure: true,
      folder: 'INBOX',
      smtpSecure: true,
      defaultType: 'INCIDENT',
      allowedSenders: [],
      blockedSenders: [],
      createUnknownContacts: true,
      sendAcknowledgement: true,
    })
  })

  it('coerces the ports sent as strings by the form', () => {
    const parsed = CreateSdMailboxSchema.parse({
      ...base,
      imapPort: '143',
      smtpHost: 'smtp.empresa.com.br',
      smtpPort: '587',
    })
    expect(parsed.imapPort).toBe(143)
    expect(parsed.smtpPort).toBe(587)
  })

  it('lowercases and dedupes nothing but accepts e-mails and domains', () => {
    const parsed = CreateSdMailboxSchema.parse({
      ...base,
      allowedSenders: [' Ana@X.com ', '@Cliente.com.br'],
      blockedSenders: ['spam@x.com'],
    })
    expect(parsed.allowedSenders).toEqual(['ana@x.com', '@cliente.com.br'])
    expect(parsed.blockedSenders).toEqual(['spam@x.com'])
  })

  it.each([
    ['address', { ...base, address: 'nao-e-email' }],
    ['name', { ...base, name: '   ' }],
    ['imapHost', { ...base, imapHost: '' }],
    ['imapPassword', { ...base, imapPassword: '' }],
    ['imapPort', { ...base, imapPort: 0 }],
    ['imapPort too high', { ...base, imapPort: 70_000 }],
    ['folder', { ...base, folder: '  ' }],
    ['allowedSenders entry', { ...base, allowedSenders: ['sem-arroba'] }],
    ['allowedSenders domain', { ...base, allowedSenders: ['@sem-ponto'] }],
    ['defaultType', { ...base, defaultType: 'TASK' }],
  ])('refuses an invalid %s', (_label, input) => {
    expect(CreateSdMailboxSchema.safeParse(input).success).toBe(false)
  })

  it('refuses more than 200 senders', () => {
    const many = Array.from({ length: 201 }, (_, i) => `a${i}@x.com`)
    expect(
      CreateSdMailboxSchema.safeParse({ ...base, allowedSenders: many })
        .success,
    ).toBe(false)
  })
})

describe('UpdateSdMailboxSchema', () => {
  it('accepts a single field', () => {
    expect(UpdateSdMailboxSchema.parse({ sendAcknowledgement: false })).toEqual(
      { sendAcknowledgement: false },
    )
  })

  it('accepts clearing the SMTP password with null', () => {
    expect(UpdateSdMailboxSchema.parse({ smtpPassword: null })).toEqual({
      smtpPassword: null,
    })
  })

  it('accepts pausing and resuming', () => {
    expect(UpdateSdMailboxSchema.parse({ status: 'PAUSED' }).status).toBe(
      'PAUSED',
    )
    expect(UpdateSdMailboxSchema.parse({ status: 'ACTIVE' }).status).toBe(
      'ACTIVE',
    )
  })

  it('refuses an empty body and the ERROR status', () => {
    expect(UpdateSdMailboxSchema.safeParse({}).success).toBe(false)
    expect(UpdateSdMailboxSchema.safeParse({ status: 'ERROR' }).success).toBe(
      false,
    )
  })

  it('does not let the address be changed (the channel identity)', () => {
    const parsed = UpdateSdMailboxSchema.parse({
      name: 'Central',
      address: 'outro@x.com',
    } as Record<string, unknown>)
    expect(parsed).not.toHaveProperty('address')
  })
})
