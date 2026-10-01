import { describe, expect, it } from 'vitest'
import { newSdPortalToken } from '@/src/lib/servicedesk/portal-session'
import {
  CreateSdPortalMessageSchema,
  CreateSdPortalTicketSchema,
  IssueSdPortalAccessSchema,
  ListSdPortalTicketsSchema,
  OpenSdPortalSessionSchema,
  RequestSdPortalLinkSchema,
  SD_PORTAL_MAX_ATTACHMENTS,
  SearchSdPortalKbSchema,
} from '../sd-portal.schema'

describe('RequestSdPortalLinkSchema', () => {
  it('normalises the e-mail to lower case without spaces', () => {
    const parsed = RequestSdPortalLinkSchema.parse({
      email: '  Ana@ACME.com.BR ',
    })
    expect(parsed.email).toBe('ana@acme.com.br')
  })

  it('rejects a malformed e-mail', () => {
    expect(RequestSdPortalLinkSchema.safeParse({ email: 'ana' }).success).toBe(
      false,
    )
    expect(RequestSdPortalLinkSchema.safeParse({}).success).toBe(false)
  })
})

describe('IssueSdPortalAccessSchema', () => {
  it('takes the contact and an optional override e-mail', () => {
    expect(IssueSdPortalAccessSchema.parse({ contactId: 'c1' })).toEqual({
      contactId: 'c1',
    })
    expect(
      IssueSdPortalAccessSchema.parse({
        contactId: 'c1',
        email: 'Chefe@ACME.com',
      }).email,
    ).toBe('chefe@acme.com')
  })

  it('requires the contact', () => {
    expect(IssueSdPortalAccessSchema.safeParse({}).success).toBe(false)
  })
})

describe('OpenSdPortalSessionSchema', () => {
  it('accepts a real token and refuses anything else', () => {
    const { token } = newSdPortalToken()
    expect(OpenSdPortalSessionSchema.parse({ token }).token).toBe(token)
    expect(OpenSdPortalSessionSchema.safeParse({ token: 'abc' }).success).toBe(
      false,
    )
  })
})

describe('ListSdPortalTicketsSchema', () => {
  it('defaults to the open tickets, first page of 20', () => {
    expect(ListSdPortalTicketsSchema.parse({})).toEqual({
      status: 'open',
      page: 1,
      pageSize: 20,
    })
  })

  it('coerces the query string numbers and caps the page size', () => {
    expect(
      ListSdPortalTicketsSchema.parse({
        status: 'closed',
        page: '3',
        pageSize: '50',
      }),
    ).toMatchObject({ status: 'closed', page: 3, pageSize: 50 })
    expect(
      ListSdPortalTicketsSchema.safeParse({ pageSize: '51' }).success,
    ).toBe(false)
    expect(
      ListSdPortalTicketsSchema.safeParse({ status: 'mine' }).success,
    ).toBe(false)
  })
})

describe('CreateSdPortalTicketSchema', () => {
  it('keeps only what the contact may inform', () => {
    const parsed = CreateSdPortalTicketSchema.parse({
      type: 'INCIDENT',
      title: '  Impressora parada  ',
      description: 'Começou hoje',
      urgencyId: 'urg1',
    })
    expect(parsed.title).toBe('Impressora parada')
    expect(parsed.description).toBe('Começou hoje')
    expect(parsed).not.toHaveProperty('assigneeId')
    expect(parsed).not.toHaveProperty('departmentId')
    expect(parsed).not.toHaveProperty('phaseId')
    expect(parsed).not.toHaveProperty('priorityId')
    expect(parsed).not.toHaveProperty('channel')
  })

  it('drops fields the portal must not set', () => {
    const parsed = CreateSdPortalTicketSchema.parse({
      type: 'INCIDENT',
      title: 'x',
      assigneeId: 'u9',
      departmentId: 'd9',
      channel: 'AGENT',
      priorityId: 'p9',
    } as Record<string, unknown>)
    expect(Object.keys(parsed).sort()).toEqual(['title', 'type'])
  })

  it('requires a title and a known type', () => {
    expect(
      CreateSdPortalTicketSchema.safeParse({ type: 'INCIDENT', title: '  ' })
        .success,
    ).toBe(false)
    expect(
      CreateSdPortalTicketSchema.safeParse({ type: 'TASK', title: 'x' })
        .success,
    ).toBe(false)
  })
})

describe('CreateSdPortalMessageSchema', () => {
  it('accepts text, or attachments without text', () => {
    expect(CreateSdPortalMessageSchema.parse({ body: ' olá ' })).toEqual({
      body: 'olá',
      attachmentCount: 0,
    })
    expect(
      CreateSdPortalMessageSchema.parse({ attachmentCount: 2 }).attachmentCount,
    ).toBe(2)
  })

  it('refuses an empty message with no attachment', () => {
    const result = CreateSdPortalMessageSchema.safeParse({ body: '   ' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(['body'])
  })

  it('caps the attachments per reply', () => {
    expect(
      CreateSdPortalMessageSchema.safeParse({
        attachmentCount: SD_PORTAL_MAX_ATTACHMENTS + 1,
      }).success,
    ).toBe(false)
  })

  it('caps the message length', () => {
    expect(
      CreateSdPortalMessageSchema.safeParse({ body: 'a'.repeat(10_001) })
        .success,
    ).toBe(false)
  })
})

describe('SearchSdPortalKbSchema', () => {
  it('defaults the limit and accepts a category', () => {
    expect(SearchSdPortalKbSchema.parse({})).toEqual({ limit: 20 })
    expect(
      SearchSdPortalKbSchema.parse({ q: ' senha ', categoryId: 'cat1' }),
    ).toEqual({ q: 'senha', categoryId: 'cat1', limit: 20 })
    expect(SearchSdPortalKbSchema.safeParse({ limit: '51' }).success).toBe(
      false,
    )
  })
})
