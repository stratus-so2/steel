import { describe, expect, it } from 'vitest'
import {
  SD_WHATSAPP_MEDIA_MAX_BYTES,
  SD_WHATSAPP_MEDIA_TYPES,
  SdWhatsappConversationsQuerySchema,
  SdWhatsappLinkSchema,
  SdWhatsappMessagesQuerySchema,
  SdWhatsappSendMediaSchema,
  SdWhatsappSendTemplateSchema,
  SdWhatsappSendTextSchema,
  SdWhatsappStartSchema,
} from '@/src/schemas/sd-whatsapp.schema'

describe('SdWhatsappSendTextSchema', () => {
  it('apara o texto enviado', () => {
    expect(SdWhatsappSendTextSchema.parse({ text: '  Bom dia  ' })).toEqual({
      text: 'Bom dia',
    })
  })

  it('recusa texto vazio ou longo demais', () => {
    const empty = SdWhatsappSendTextSchema.safeParse({ text: '   ' })
    expect(empty.success).toBe(false)
    expect(empty.error?.issues[0]?.message).toBe('Mensagem não pode ser vazia')

    const long = SdWhatsappSendTextSchema.safeParse({ text: 'a'.repeat(4097) })
    expect(long.success).toBe(false)
    expect(long.error?.issues[0]?.message).toBe('Mensagem muito longa')
  })
})

describe('SdWhatsappSendTemplateSchema', () => {
  it('aceita nome, idioma e componentes opcionais', () => {
    expect(
      SdWhatsappSendTemplateSchema.parse({
        templateName: ' boas_vindas ',
        language: 'pt_BR',
        components: [{ type: 'body' }],
      }),
    ).toEqual({
      templateName: 'boas_vindas',
      language: 'pt_BR',
      components: [{ type: 'body' }],
    })
  })

  it('recusa nome vazio e mais de 20 componentes', () => {
    expect(
      SdWhatsappSendTemplateSchema.safeParse({
        templateName: '',
        language: 'pt_BR',
      }).success,
    ).toBe(false)
    expect(
      SdWhatsappSendTemplateSchema.safeParse({
        templateName: 'x',
        language: 'pt_BR',
        components: Array.from({ length: 21 }, () => ({})),
      }).success,
    ).toBe(false)
  })
})

describe('SdWhatsappSendMediaSchema', () => {
  it('aceita legenda opcional aparada', () => {
    expect(SdWhatsappSendMediaSchema.parse({})).toEqual({})
    expect(SdWhatsappSendMediaSchema.parse({ caption: ' foto ' })).toEqual({
      caption: 'foto',
    })
  })

  it('recusa legenda acima de 1024 caracteres', () => {
    expect(
      SdWhatsappSendMediaSchema.safeParse({ caption: 'a'.repeat(1025) })
        .success,
    ).toBe(false)
  })
})

describe('limites de mídia', () => {
  it('limita o arquivo a 16 MB', () => {
    expect(SD_WHATSAPP_MEDIA_MAX_BYTES).toBe(16 * 1024 * 1024)
  })

  it('mapeia cada mime aceito para o tipo de mensagem', () => {
    expect(SD_WHATSAPP_MEDIA_TYPES['image/png']).toBe('IMAGE')
    expect(SD_WHATSAPP_MEDIA_TYPES['video/mp4']).toBe('VIDEO')
    expect(SD_WHATSAPP_MEDIA_TYPES['audio/ogg']).toBe('AUDIO')
    expect(SD_WHATSAPP_MEDIA_TYPES['application/pdf']).toBe('DOCUMENT')
  })
})

describe('SdWhatsappLinkSchema', () => {
  it('exige um id de conversa', () => {
    expect(
      SdWhatsappLinkSchema.parse({ conversationId: 'c1' }).conversationId,
    ).toBe('c1')
    expect(SdWhatsappLinkSchema.safeParse({ conversationId: '' }).success).toBe(
      false,
    )
  })
})

describe('SdWhatsappStartSchema', () => {
  it('aceita número formatado ou nenhum número', () => {
    expect(SdWhatsappStartSchema.parse({})).toEqual({})
    expect(
      SdWhatsappStartSchema.parse({ waId: ' +55 (11) 98888-7777 ' }).waId,
    ).toBe('+55 (11) 98888-7777')
  })

  it('recusa letras no número', () => {
    const parsed = SdWhatsappStartSchema.safeParse({ waId: '11x9999' })
    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.message).toBe(
      'Informe só o número (com DDI e DDD)',
    )
  })
})

describe('consultas da aba', () => {
  it('usa 50 mensagens por padrão e aceita cursor', () => {
    expect(SdWhatsappMessagesQuerySchema.parse({})).toEqual({ limit: 50 })
    expect(
      SdWhatsappMessagesQuerySchema.parse({ cursor: 'm1', limit: '10' }),
    ).toEqual({ cursor: 'm1', limit: 10 })
  })

  it('recusa limites fora da faixa de mensagens', () => {
    expect(
      SdWhatsappMessagesQuerySchema.safeParse({ limit: '0' }).success,
    ).toBe(false)
    expect(
      SdWhatsappMessagesQuerySchema.safeParse({ limit: '101' }).success,
    ).toBe(false)
  })

  it('usa 20 conversas por padrão e apara a busca', () => {
    expect(SdWhatsappConversationsQuerySchema.parse({})).toEqual({ limit: 20 })
    expect(
      SdWhatsappConversationsQuerySchema.parse({ q: '  ana ', limit: '5' }),
    ).toEqual({ q: 'ana', limit: 5 })
    expect(
      SdWhatsappConversationsQuerySchema.safeParse({ limit: '51' }).success,
    ).toBe(false)
  })
})
