import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdAiPreServiceReplyDTO } from '@/types/sd-ai'
import { SdPreServiceChat } from '../pre-service-chat'
import { AI_URL, apiError, SLUG, WS } from './sd-ai-fixtures'

const CONVERSATION_ID = 'conv-ai-1'

function reply(
  overrides: Partial<SdAiPreServiceReplyDTO> = {},
): SdAiPreServiceReplyDTO {
  return {
    conversation: {
      id: CONVERSATION_ID,
      mode: 'PRE_SERVICE',
      ticketId: null,
      outcome: null,
      messages: [
        {
          role: 'user',
          content: 'Minha VPN não conecta',
          at: '2026-09-21T12:00:00.000Z',
        },
        {
          role: 'assistant',
          content: 'Veja este artigo antes de abrirmos um chamado.',
          at: '2026-09-21T12:00:03.000Z',
          articles: [
            {
              id: 'a1',
              title: 'Como reinstalar a VPN',
              excerpt: 'Passo a passo da reinstalação',
            },
          ],
        },
      ],
      createdAt: '2026-09-21T12:00:00.000Z',
      updatedAt: '2026-09-21T12:00:03.000Z',
    },
    reply: 'Veja este artigo antes de abrirmos um chamado.',
    action: 'answer',
    articles: [
      {
        id: 'a1',
        title: 'Como reinstalar a VPN',
        excerpt: 'Passo a passo da reinstalação',
      },
    ],
    suggestOpenTicket: false,
    ticketDraft: {
      title: 'Minha VPN não conecta',
      description: 'Minha VPN não conecta',
      type: 'INCIDENT',
      categoryId: null,
      subcategoryId: null,
      serviceId: null,
      urgencyId: null,
    },
    ...overrides,
  }
}

async function sendFirstMessage(text = 'Minha VPN não conecta') {
  fireEvent.change(screen.getByLabelText('Mensagem para o assistente'), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))
}

describe('<SdPreServiceChat />', () => {
  it('greets the requester before any message', () => {
    mockFetch([])
    renderWithQuery(<SdPreServiceChat workspaceId={WS} slug={SLUG} />)
    expect(screen.getByText(/Conte o que está acontecendo/)).toBeTruthy()
    expect(
      (
        screen.getByRole('button', {
          name: 'Enviar mensagem',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true)
  })

  it('answers with knowledge base article cards', async () => {
    const spy = mockFetch([
      { method: 'POST', match: `${AI_URL}/pre-service`, data: reply() },
    ])
    renderWithQuery(<SdPreServiceChat workspaceId={WS} slug={SLUG} />)

    await sendFirstMessage()
    expect(
      await screen.findByText('Veja este artigo antes de abrirmos um chamado.'),
    ).toBeTruthy()
    const card = screen.getByRole('link', { name: /Como reinstalar a VPN/ })
    expect(card.getAttribute('href')).toBe(`/${SLUG}/servicedesk/knowledge/a1`)
    expect(fetchBody(spy, '/pre-service')).toEqual({
      message: 'Minha VPN não conecta',
    })
  })

  it('keeps the conversation id on the next message', async () => {
    const spy = mockFetch([
      { method: 'POST', match: `${AI_URL}/pre-service`, data: reply() },
    ])
    renderWithQuery(<SdPreServiceChat workspaceId={WS} slug={SLUG} />)

    await sendFirstMessage()
    await screen.findByText('Veja este artigo antes de abrirmos um chamado.')
    await sendFirstMessage('Continua sem conectar')

    await waitFor(() => {
      const bodies = spy.mock.calls
        .filter(([url]) => String(url).endsWith('/pre-service'))
        .map(([, init]) => JSON.parse(String(init?.body)))
      expect(bodies.at(-1)).toEqual({
        message: 'Continua sem conectar',
        conversationId: CONVERSATION_ID,
      })
    })
  })

  it('suggests opening a ticket and reports the created one', async () => {
    const onTicketCreated = vi.fn()
    mockFetch([
      {
        method: 'POST',
        match: `${AI_URL}/pre-service/${CONVERSATION_ID}/ticket`,
        data: { id: 't9', number: 9, code: 'INC-000009' },
      },
      {
        method: 'POST',
        match: `${AI_URL}/pre-service`,
        data: reply({ suggestOpenTicket: true, action: 'open_ticket' }),
      },
    ])
    renderWithQuery(
      <SdPreServiceChat
        workspaceId={WS}
        slug={SLUG}
        onTicketCreated={onTicketCreated}
      />,
    )

    await sendFirstMessage()
    expect(
      await screen.findByText(/Posso abrir um chamado com o resumo/),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Abrir chamado/ }))
    expect(await screen.findByText('Chamado INC-000009 aberto')).toBeTruthy()
    expect(onTicketCreated).toHaveBeenCalledWith({
      id: 't9',
      number: 9,
      code: 'INC-000009',
    })
    expect(
      screen.getByRole('link', { name: 'Ver o chamado' }).getAttribute('href'),
    ).toBe(`/${SLUG}/servicedesk/tickets/9`)
  })

  it('closes the conversation when the base solved it', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${AI_URL}/pre-service/${CONVERSATION_ID}/close`,
        data: reply().conversation,
      },
      { method: 'POST', match: `${AI_URL}/pre-service`, data: reply() },
    ])
    renderWithQuery(<SdPreServiceChat workspaceId={WS} slug={SLUG} />)

    await sendFirstMessage()
    fireEvent.click(
      await screen.findByRole('button', { name: 'Resolvido, obrigado' }),
    )

    expect(await screen.findByText('Que bom que ajudou!')).toBeTruthy()
    expect(fetchBody(spy, '/close')).toEqual({ outcome: 'resolved_by_kb' })

    fireEvent.click(screen.getByRole('button', { name: 'Começar de novo' }))
    expect(screen.getByText(/Conte o que está acontecendo/)).toBeTruthy()
  })

  it('explains that the assistant is off instead of a raw error', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${AI_URL}/pre-service`,
        handler: apiError(
          'SD_AI_DISABLED',
          'O pré-atendimento por IA está desativado',
        ),
      },
    ])
    renderWithQuery(<SdPreServiceChat workspaceId={WS} slug={SLUG} />)

    await sendFirstMessage()
    expect(
      await screen.findByText(
        'O agente de IA está desativado nas configurações do ServiceDesk.',
      ),
    ).toBeTruthy()
  })
})
