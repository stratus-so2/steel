import { describe, expect, it } from 'vitest'
import {
  normalizeSdWhatsappNumber,
  parseSdWhatsappAttachmentKey,
  SD_WHATSAPP_DEFAULT_TITLE,
  SD_WHATSAPP_WINDOW_HOURS,
  sdPlainTextToHtml,
  sdWhatsappAttachmentKey,
  sdWhatsappAttachmentMeta,
  sdWhatsappMessageBody,
  sdWhatsappTicketOpenedText,
  sdWhatsappTicketTitle,
  sdWhatsappWindow,
} from '@/src/lib/servicedesk/whatsapp'

const NOW = new Date('2026-09-21T12:00:00.000Z')
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000)

describe('sdWhatsappWindow', () => {
  it('mantém a Z-API sempre aberta, com ou sem mensagem recebida', () => {
    expect(sdWhatsappWindow('ZAPI', null, NOW)).toEqual({
      open: true,
      expiresAt: null,
      requiresTemplate: false,
    })
    expect(sdWhatsappWindow('ZAPI', hoursAgo(99), NOW)).toEqual({
      open: true,
      expiresAt: null,
      requiresTemplate: false,
    })
  })

  it('exige modelo na Meta quando o contato nunca escreveu', () => {
    expect(sdWhatsappWindow('META', null, NOW)).toEqual({
      open: false,
      expiresAt: null,
      requiresTemplate: true,
    })
  })

  it('abre a janela da Meta por 24 h após a última mensagem recebida', () => {
    const window = sdWhatsappWindow('META', hoursAgo(1), NOW)
    expect(window.open).toBe(true)
    expect(window.requiresTemplate).toBe(false)
    expect(window.expiresAt).toBe(
      new Date(NOW.getTime() + 23 * 60 * 60 * 1000).toISOString(),
    )
  })

  it('fecha a janela da Meta depois das 24 h', () => {
    expect(
      sdWhatsappWindow('META', hoursAgo(SD_WHATSAPP_WINDOW_HOURS), NOW),
    ).toEqual({ open: false, expiresAt: null, requiresTemplate: true })
  })

  it('usa o relógio atual quando `now` não é informado', () => {
    expect(sdWhatsappWindow('META', new Date()).open).toBe(true)
  })
})

describe('chave do anexo espelhado', () => {
  it('ida e volta entre id da mensagem e chave', () => {
    const key = sdWhatsappAttachmentKey('msg-1')
    expect(key).toBe('whatsapp:msg-1')
    expect(parseSdWhatsappAttachmentKey(key)).toBe('msg-1')
  })

  it('devolve null para anexo comum ou chave sem id', () => {
    expect(parseSdWhatsappAttachmentKey('ws/arquivo.pdf')).toBeNull()
    expect(parseSdWhatsappAttachmentKey('whatsapp:')).toBeNull()
  })
})

describe('sdWhatsappAttachmentMeta', () => {
  it.each([
    ['IMAGE', 'IMAGE', 'image/*', 'whatsapp-imagem'],
    ['STICKER', 'IMAGE', 'image/webp', 'whatsapp-figurinha'],
    ['VIDEO', 'VIDEO', 'video/*', 'whatsapp-video'],
    ['AUDIO', 'AUDIO', 'audio/*', 'whatsapp-audio'],
    ['DOCUMENT', 'DOCUMENT', 'application/octet-stream', 'whatsapp-documento'],
  ] as const)('descreve o anexo de %s', (type, kind, mimeType, fileName) => {
    expect(sdWhatsappAttachmentMeta(type)).toEqual({
      kind,
      mimeType,
      fileName,
    })
  })

  it('devolve null para tipos sem mídia', () => {
    expect(sdWhatsappAttachmentMeta('TEXT')).toBeNull()
    expect(sdWhatsappAttachmentMeta('LOCATION')).toBeNull()
  })
})

describe('sdWhatsappMessageBody', () => {
  it('usa o texto puro quando a mensagem é de texto', () => {
    expect(sdWhatsappMessageBody('TEXT', '  Bom dia  ')).toBe('Bom dia')
  })

  it('cai para um rótulo genérico quando o texto está vazio', () => {
    expect(sdWhatsappMessageBody('TEXT', null)).toBe('[Mensagem]')
    expect(sdWhatsappMessageBody('TEXT', '   ')).toBe('[Mensagem]')
  })

  it('prefixa a mídia com a etiqueta do tipo', () => {
    expect(sdWhatsappMessageBody('IMAGE', 'Print do erro')).toBe(
      '[Imagem] Print do erro',
    )
    expect(sdWhatsappMessageBody('AUDIO', undefined)).toBe('[Áudio]')
    expect(sdWhatsappMessageBody('LOCATION', '')).toBe('[Localização]')
  })

  it('mostra o nome do modelo quando há texto', () => {
    expect(sdWhatsappMessageBody('TEMPLATE', 'boas_vindas')).toBe(
      '[Modelo] boas_vindas',
    )
    expect(sdWhatsappMessageBody('TEMPLATE', null)).toBe('[Modelo]')
  })
})

describe('sdWhatsappTicketTitle', () => {
  it('usa a primeira linha não vazia da mensagem', () => {
    expect(sdWhatsappTicketTitle('\n  \nImpressora travada\noutra linha')).toBe(
      'Impressora travada',
    )
  })

  it('cai no título padrão quando a linha é curta demais ou não há texto', () => {
    expect(sdWhatsappTicketTitle('oi')).toBe(SD_WHATSAPP_DEFAULT_TITLE)
    expect(sdWhatsappTicketTitle(null)).toBe(SD_WHATSAPP_DEFAULT_TITLE)
    expect(sdWhatsappTicketTitle('   ')).toBe(SD_WHATSAPP_DEFAULT_TITLE)
  })

  it('trunca com reticências acima de 120 caracteres', () => {
    const title = sdWhatsappTicketTitle('a'.repeat(200))
    expect(title).toHaveLength(120)
    expect(title.endsWith('…')).toBe(true)
  })
})

describe('sdPlainTextToHtml', () => {
  it('quebra parágrafos, escapa HTML e vira <br> dentro do bloco', () => {
    expect(sdPlainTextToHtml('Olá <b>&\n"mundo"\n\nSegundo')).toBe(
      '<p>Olá &lt;b&gt;&amp;<br>&quot;mundo&quot;</p><p>Segundo</p>',
    )
  })

  it('descarta blocos vazios', () => {
    expect(sdPlainTextToHtml('\n\n   \n\n')).toBe('')
  })
})

describe('normalizeSdWhatsappNumber', () => {
  it('acrescenta o DDI do Brasil em números com DDD', () => {
    expect(normalizeSdWhatsappNumber('(11) 98888-7777')).toBe('5511988887777')
    expect(normalizeSdWhatsappNumber('1133334444')).toBe('551133334444')
  })

  it('mantém números que já têm DDI', () => {
    expect(normalizeSdWhatsappNumber('+55 11 98888-7777')).toBe('5511988887777')
  })

  it('devolve null para o que não parece telefone', () => {
    expect(normalizeSdWhatsappNumber(null)).toBeNull()
    expect(normalizeSdWhatsappNumber(undefined)).toBeNull()
    expect(normalizeSdWhatsappNumber('123')).toBeNull()
    expect(normalizeSdWhatsappNumber('1'.repeat(16))).toBeNull()
  })
})

describe('sdWhatsappTicketOpenedText', () => {
  it('devolve o aviso com o código do chamado em destaque', () => {
    expect(sdWhatsappTicketOpenedText('INC-000012')).toContain('*INC-000012*')
  })
})
