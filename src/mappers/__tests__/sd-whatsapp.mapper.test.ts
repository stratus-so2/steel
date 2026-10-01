import { describe, expect, it } from 'vitest'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppContactWithoutCount } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { createFakeWhatsAppConversation } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { createFakeWhatsAppTemplate } from '@/src/__tests__/factories/whatsapp-template.factory'
import {
  sdWhatsappWebhookPath,
  toSdWhatsappConnectionDTO,
  toSdWhatsappConversationDTO,
  toSdWhatsappTemplateDTO,
} from '@/src/mappers/sd-whatsapp.mapper'
import type {
  SdWaConversation,
  SdWaConversationListRow,
} from '@/src/repositories/sd-whatsapp.repository'

function conversation(
  overrides: Partial<SdWaConversation> = {},
): SdWaConversation {
  const base = createFakeWhatsAppConversation({
    id: 'conv-1',
    connectionId: 'conn-1',
    status: 'IN_PROGRESS',
    aiActive: true,
    aiHandoff: false,
    lastMessageAt: new Date('2026-09-21T12:00:00.000Z'),
  })
  return {
    ...base,
    contact: createFakeWhatsAppContactWithoutCount({
      id: 'contact-1',
      name: 'Ana Souza',
      waId: '5511988887777',
      avatarUrl: 'https://cdn/ana.png',
    }),
    connection: createFakeWhatsAppConnection({ id: 'conn-1' }),
    messages: [],
    ...overrides,
  }
}

describe('sdWhatsappWebhookPath', () => {
  it('leva o segredo na URL da Z-API', () => {
    expect(
      sdWhatsappWebhookPath({ provider: 'ZAPI', webhookSecret: 'se/cret' }),
    ).toBe('/api/whatsapp/webhook/zapi?secret=se%2Fcret')
  })

  it('usa a URL única da plataforma na Meta', () => {
    expect(
      sdWhatsappWebhookPath({ provider: 'META', webhookSecret: 'ignorado' }),
    ).toBe('/api/whatsapp/webhook/meta')
  })
})

describe('toSdWhatsappConnectionDTO', () => {
  it('expõe os identificadores públicos e marca a conexão ativa', () => {
    const connection = createFakeWhatsAppConnection({
      id: 'conn-1',
      provider: 'META',
      label: 'Central',
      phoneNumber: '5511999999999',
      status: 'CONNECTED',
      statusError: null,
      metaPhoneNumberId: 'pn-1',
      metaWabaId: 'waba-1',
      zapiInstanceId: null,
      createdAt: new Date('2026-09-20T10:00:00.000Z'),
    })
    expect(toSdWhatsappConnectionDTO(connection, 'conn-1')).toEqual({
      id: 'conn-1',
      provider: 'META',
      label: 'Central',
      phoneNumber: '5511999999999',
      status: 'CONNECTED',
      statusError: null,
      zapiInstanceId: null,
      metaPhoneNumberId: 'pn-1',
      metaWabaId: 'waba-1',
      active: true,
      webhookPath: '/api/whatsapp/webhook/meta',
      createdAt: '2026-09-20T10:00:00.000Z',
    })
  })

  it('nunca devolve credenciais e marca `active: false` para as demais', () => {
    const connection = createFakeWhatsAppConnection({
      id: 'conn-2',
      statusError: 'Token inválido',
    })
    const dto = toSdWhatsappConnectionDTO(connection, 'conn-1')
    expect(dto.active).toBe(false)
    expect(dto.statusError).toBe('Token inválido')
    expect(Object.keys(dto)).not.toContain('encryptedZapiToken')
    expect(dto.webhookPath).toContain('/api/whatsapp/webhook/zapi?secret=')
  })

  it('trata "nenhuma conexão ativa" como nenhuma marcada', () => {
    expect(
      toSdWhatsappConnectionDTO(createFakeWhatsAppConnection(), null).active,
    ).toBe(false)
  })
})

describe('toSdWhatsappConversationDTO', () => {
  it('resume o contato, o estado da IA e a última mensagem', () => {
    const dto = toSdWhatsappConversationDTO(
      conversation({
        messages: [createFakeWhatsAppMessage({ type: 'IMAGE', text: 'Erro' })],
      }),
    )
    expect(dto).toMatchObject({
      id: 'conv-1',
      connectionId: 'conn-1',
      contact: {
        id: 'contact-1',
        name: 'Ana Souza',
        waId: '5511988887777',
        avatarUrl: 'https://cdn/ana.png',
      },
      status: 'IN_PROGRESS',
      aiActive: true,
      aiHandoff: false,
      lastMessageAt: '2026-09-21T12:00:00.000Z',
      lastMessagePreview: '[Imagem] Erro',
      openTicket: null,
    })
  })

  it('devolve nulos quando a conversa não tem mensagem nem atividade', () => {
    const dto = toSdWhatsappConversationDTO(
      conversation({ lastMessageAt: null }),
    )
    expect(dto.lastMessageAt).toBeNull()
    expect(dto.lastMessagePreview).toBeNull()
  })

  it('monta o código do chamado em aberto quando a listagem o traz', () => {
    const row: SdWaConversationListRow = {
      ...conversation(),
      sdTickets: [{ id: 't1', number: 12, type: 'INCIDENT' }],
    }
    const dto = toSdWhatsappConversationDTO(
      row,
      (ticket) => `${ticket.type}-${ticket.number}`,
    )
    expect(dto.openTicket).toEqual({
      id: 't1',
      number: 12,
      code: 'INCIDENT-12',
    })
  })

  it('ignora o chamado quando não recebe o formatador de código', () => {
    const row: SdWaConversationListRow = {
      ...conversation(),
      sdTickets: [{ id: 't1', number: 12, type: 'INCIDENT' }],
    }
    expect(toSdWhatsappConversationDTO(row).openTicket).toBeNull()
  })

  it('aceita listagem sem chamado em aberto', () => {
    const row: SdWaConversationListRow = {
      ...conversation(),
      sdTickets: [],
    }
    expect(
      toSdWhatsappConversationDTO(row, () => 'INC-1').openTicket,
    ).toBeNull()
  })
})

describe('toSdWhatsappTemplateDTO', () => {
  it('extrai o corpo e conta as variáveis distintas', () => {
    const dto = toSdWhatsappTemplateDTO(
      createFakeWhatsAppTemplate({
        id: 'tpl-1',
        name: 'atualizacao',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [
          { type: 'HEADER', text: 'Olá' },
          { type: 'body', text: 'Oi {{1}}, o chamado {{2}} mudou. {{ 1 }}' },
        ],
      }),
    )
    expect(dto).toEqual({
      id: 'tpl-1',
      name: 'atualizacao',
      language: 'pt_BR',
      category: 'UTILITY',
      body: 'Oi {{1}}, o chamado {{2}} mudou. {{ 1 }}',
      variableCount: 3,
    })
  })

  it('devolve corpo nulo e zero variáveis sem componente BODY', () => {
    expect(
      toSdWhatsappTemplateDTO(
        createFakeWhatsAppTemplate({ components: [{ type: 'HEADER' }] }),
      ),
    ).toMatchObject({ body: null, variableCount: 0 })
  })

  it('tolera `components` que não é lista', () => {
    expect(
      toSdWhatsappTemplateDTO(
        createFakeWhatsAppTemplate({ components: { type: 'BODY' } }),
      ),
    ).toMatchObject({ body: null, variableCount: 0 })
  })
})
