import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_ICONS,
  NOTIFICATION_MODULE_LABELS,
  NOTIFICATION_MODULES,
  notificationKindCatalog,
  notificationKindInfo,
  notificationKindsOfModule,
  notificationModuleOf,
  notificationTicketRef,
} from '../notification-kind'

describe('notificationKindInfo', () => {
  it('should describe a known ServiceDesk kind in pt-BR', () => {
    const info = notificationKindInfo('SD_SLA_BREACHED')

    expect(info).toEqual({
      kind: 'SD_SLA_BREACHED',
      module: 'SERVICE_DESK',
      moduleLabel: 'ServiceDesk',
      label: 'SLA violado',
      icon: 'alarm',
      color: 'rose',
    })
  })

  it('should describe the WhatsApp sentiment kind as Comunicação', () => {
    const info = notificationKindInfo('WHATSAPP_NEGATIVE_SENTIMENT')

    expect(info.module).toBe('COMMUNICATION')
    expect(info.moduleLabel).toBe('Comunicação')
    expect(info.label).toBe('Sentimento negativo')
  })

  it('should infer the module by prefix for an unknown kind', () => {
    expect(notificationKindInfo('CRM_DEAL_WON')).toEqual({
      kind: 'CRM_DEAL_WON',
      module: 'CRM',
      moduleLabel: 'CRM',
      label: 'Crm deal won',
      icon: 'deal',
      color: 'violet',
    })
    expect(notificationKindInfo('SD_BRAND_NEW').module).toBe('SERVICE_DESK')
    expect(notificationKindInfo('WHATSAPP_SOMETHING').module).toBe(
      'COMMUNICATION',
    )
  })

  it('should fall back to the platform module for anything else', () => {
    const info = notificationKindInfo('BILLING_INVOICE_DUE')

    expect(info.module).toBe('OTHER')
    expect(info.moduleLabel).toBe('Plataforma')
    expect(info.icon).toBe('bell')
    expect(info.color).toBe('slate')
  })

  it('should never render an empty label', () => {
    expect(notificationKindInfo('').label).toBe('Notificação')
    expect(notificationKindInfo('_').label).toBe('Notificação')
  })

  it('should only use icons from the declared set', () => {
    for (const info of notificationKindCatalog()) {
      expect(NOTIFICATION_ICONS).toContain(info.icon)
      expect(NOTIFICATION_MODULES).toContain(info.module)
      expect(info.moduleLabel).toBe(NOTIFICATION_MODULE_LABELS[info.module])
    }
    expect(notificationKindCatalog().length).toBeGreaterThan(10)
  })
})

describe('notificationModuleOf / notificationKindsOfModule', () => {
  it('should group the known kinds by module', () => {
    const sd = notificationKindsOfModule('SERVICE_DESK')

    expect(sd).toContain('SD_TICKET_ASSIGNED')
    expect(sd).not.toContain('WHATSAPP_NEGATIVE_SENTIMENT')
    expect(sd.every((kind) => notificationModuleOf(kind) === 'SERVICE_DESK')).toBe(
      true,
    )
    expect(notificationKindsOfModule('COMMUNICATION')).toEqual([
      'WHATSAPP_NEGATIVE_SENTIMENT',
    ])
  })

  it('should return an empty list for a module with no kinds yet', () => {
    expect(notificationKindsOfModule('CRM')).toEqual([])
    expect(notificationKindsOfModule('OTHER')).toEqual([])
  })
})

describe('notificationTicketRef', () => {
  it('should extract the slug and the ticket reference from a ticket href', () => {
    expect(notificationTicketRef('/acme/servicedesk/tickets/123')).toEqual({
      slug: 'acme',
      ticketRef: '123',
    })
    expect(
      notificationTicketRef('/acme/servicedesk/tickets/INC-000123?aba=historico'),
    ).toEqual({ slug: 'acme', ticketRef: 'INC-000123' })
  })

  it('should return null for anything that is not a ticket link', () => {
    expect(notificationTicketRef(null)).toBeNull()
    expect(notificationTicketRef(undefined)).toBeNull()
    expect(notificationTicketRef('')).toBeNull()
    expect(notificationTicketRef('/acme/zap?conversa=c1')).toBeNull()
    expect(notificationTicketRef('/acme/servicedesk/tickets')).toBeNull()
    expect(notificationTicketRef('https://x.com/a/servicedesk/tickets/1')).toBeNull()
  })
})
