import { createId } from '@paralleldrive/cuid2'
import { describe, expect, it } from 'vitest'
import {
  SD_DIGEST_EVENT,
  SD_DIGEST_HOUR,
  SD_NOTIFICATION_EVENTS,
  SD_NOTIFICATION_GROUPS,
  sdNotificationDefault,
  sdNotificationEvent,
} from '@/src/config/servicedesk-notifications'
import {
  SD_MESSAGE_MAX_MENTIONS,
  SdMessageMentionsSchema,
  SdNotificationChannelEnum,
  UpdateSdNotificationPreferencesSchema,
} from '../sd-notification.schema'

describe('catálogo de notificações', () => {
  it('não tem chave repetida e todo evento oferece seus padrões', () => {
    const keys = SD_NOTIFICATION_EVENTS.map((e) => e.key)
    expect(new Set(keys).size).toBe(keys.length)
    for (const event of SD_NOTIFICATION_EVENTS) {
      expect(event.label.length).toBeGreaterThan(0)
      expect(event.description.length).toBeGreaterThan(0)
      for (const channel of event.defaultChannels) {
        expect(event.channels).toContain(channel)
      }
    }
  })

  it('cada evento está em exatamente um grupo, e os grupos só têm eventos reais', () => {
    const grouped = SD_NOTIFICATION_GROUPS.flatMap((g) => g.events)
    expect(new Set(grouped).size).toBe(grouped.length)
    expect([...grouped].sort()).toEqual(
      SD_NOTIFICATION_EVENTS.map((e) => e.key).sort(),
    )
    for (const key of grouped) {
      expect(sdNotificationEvent(key)).toBeDefined()
    }
  })

  it('o resumo diário vem desligado e não tem público', () => {
    const digest = sdNotificationEvent(SD_DIGEST_EVENT)
    expect(digest?.defaultChannels).toEqual([])
    expect(digest?.audience).toEqual([])
    expect(digest?.agentOnly).toBe(true)
    expect(SD_DIGEST_HOUR).toBeGreaterThanOrEqual(0)
    expect(SD_DIGEST_HOUR).toBeLessThan(24)
  })

  it('`sdNotificationEvent` e `sdNotificationDefault` tratam chave desconhecida', () => {
    expect(sdNotificationEvent('nope')).toBeUndefined()
    expect(sdNotificationDefault('nope', 'EMAIL')).toBe(false)
    expect(sdNotificationDefault('ticket.assigned', 'EMAIL')).toBe(true)
    expect(sdNotificationDefault('ticket.assigned', 'WHATSAPP')).toBe(false)
  })
})

describe('SdNotificationChannelEnum', () => {
  it('aceita os três canais e recusa o resto', () => {
    expect(SdNotificationChannelEnum.safeParse('IN_APP').success).toBe(true)
    expect(SdNotificationChannelEnum.safeParse('EMAIL').success).toBe(true)
    expect(SdNotificationChannelEnum.safeParse('WHATSAPP').success).toBe(true)
    expect(SdNotificationChannelEnum.safeParse('SMS').success).toBe(false)
  })
})

describe('UpdateSdNotificationPreferencesSchema', () => {
  it('aceita a matriz e usa lista vazia por padrão', () => {
    const parsed = UpdateSdNotificationPreferencesSchema.parse({})
    expect(parsed.items).toEqual([])

    const ok = UpdateSdNotificationPreferencesSchema.safeParse({
      items: [
        { event: 'ticket.message', channel: 'EMAIL', enabled: false },
        { event: 'sla.breached', channel: 'WHATSAPP', enabled: true },
      ],
    })
    expect(ok.success).toBe(true)
  })

  it('recusa evento fora do catálogo, canal inválido e `enabled` ausente', () => {
    expect(
      UpdateSdNotificationPreferencesSchema.safeParse({
        items: [{ event: 'nao.existe', channel: 'EMAIL', enabled: true }],
      }).success,
    ).toBe(false)
    expect(
      UpdateSdNotificationPreferencesSchema.safeParse({
        items: [{ event: 'ticket.message', channel: 'SMS', enabled: true }],
      }).success,
    ).toBe(false)
    expect(
      UpdateSdNotificationPreferencesSchema.safeParse({
        items: [{ event: 'ticket.message', channel: 'EMAIL' }],
      }).success,
    ).toBe(false)
  })

  it('recusa mais células do que a matriz inteira', () => {
    const cell = {
      event: 'ticket.message',
      channel: 'EMAIL' as const,
      enabled: true,
    }
    const tooMany = Array.from(
      { length: SD_NOTIFICATION_EVENTS.length * 3 + 1 },
      () => cell,
    )
    expect(
      UpdateSdNotificationPreferencesSchema.safeParse({ items: tooMany })
        .success,
    ).toBe(false)
  })
})

describe('SdMessageMentionsSchema', () => {
  it('é opcional e aceita ids válidos', () => {
    expect(SdMessageMentionsSchema.parse(undefined)).toBeUndefined()
    const ids = [createId(), createId()]
    expect(SdMessageMentionsSchema.parse(ids)).toEqual(ids)
  })

  it('recusa id vazio e lista acima do teto', () => {
    expect(SdMessageMentionsSchema.safeParse(['']).success).toBe(false)
    expect(
      SdMessageMentionsSchema.safeParse(
        Array.from({ length: SD_MESSAGE_MAX_MENTIONS + 1 }, () => createId()),
      ).success,
    ).toBe(false)
  })
})
