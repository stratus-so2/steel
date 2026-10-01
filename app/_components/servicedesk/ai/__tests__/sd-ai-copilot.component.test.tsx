import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import type { SdAiClassificationDTO, SdAiConversationDTO } from '@/types/sd-ai'
import { ticketDTO } from '../../ticket/__tests__/sd-ticket-tab-fixtures'
import { SdAiCopilotPanel } from '../copilot-panel'
import { AI_URL, apiError, TICKET_ID, WS } from './sd-ai-fixtures'

const TICKET_AI = `${AI_URL}/tickets/${TICKET_ID}`
const KB_SUGGEST = `/api/workspaces/${WS}/servicedesk/knowledge/suggest`

const classification: SdAiClassificationDTO = {
  category: { id: 'cat-1', name: 'Rede' },
  subcategory: { id: 'sub-1', name: 'VPN' },
  service: null,
  impact: null,
  urgency: { id: 'urg-1', name: 'Alta' },
  priority: { id: 'pri-1', name: 'P2' },
  department: { id: 'dep-1', name: 'Infraestrutura' },
  tags: ['vpn', 'acesso'],
  confidence: 0.82,
  reasoning: 'A descrição cita falha de VPN.',
}

const chat: SdAiConversationDTO = {
  id: 'ai-1',
  mode: 'COPILOT',
  ticketId: TICKET_ID,
  outcome: null,
  messages: [
    {
      role: 'user',
      content: 'Qual o histórico deste cliente?',
      at: '2026-09-21T12:00:00.000Z',
    },
    {
      role: 'assistant',
      content: 'Três chamados de VPN nos últimos 30 dias.',
      at: '2026-09-21T12:00:05.000Z',
    },
  ],
  createdAt: '2026-09-21T12:00:00.000Z',
  updatedAt: '2026-09-21T12:00:05.000Z',
}

const BASE_ROUTES = [
  { match: KB_SUGGEST, data: [] },
  { match: `${TICKET_AI}/chat`, data: null },
]

beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
})

describe('<SdAiCopilotPanel />', () => {
  it('summarizes the ticket on demand and lets the agent copy it', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/summary`,
        data: { text: 'Cliente sem acesso à VPN desde ontem.' },
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resumir' }))
    expect(
      await screen.findByText('Cliente sem acesso à VPN desde ontem.'),
    ).toBeTruthy()
    expect(
      spy.mock.calls.some(([url]) => String(url).endsWith('/summary')),
    ).toBe(true)

    fireEvent.click(
      screen.getByRole('button', { name: 'Copiar resumo do chamado' }),
    )
    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        'Cliente sem acesso à VPN desde ontem.',
      ),
    )
  })

  it('passes the agent guidance to the reply suggestion', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/reply`,
        data: { text: 'Olá! Pode enviar o print do erro?' },
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.change(
      screen.getByLabelText('Orientação para a sugestão de resposta'),
      { target: { value: 'peça o print' } },
    )
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir resposta' }))

    expect(
      await screen.findByText('Olá! Pode enviar o print do erro?'),
    ).toBeTruthy()
    expect(fetchBody(spy, '/reply')).toEqual({ instructions: 'peça o print' })
  })

  it('drafts the solution', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/solution`,
        data: { text: 'Reinstalamos o cliente de VPN.' },
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Rascunhar solução' }))
    expect(
      await screen.findByText('Reinstalamos o cliente de VPN.'),
    ).toBeTruthy()
    expect(screen.getByText('Rascunho da solução')).toBeTruthy()
  })

  it('suggests a classification and applies everything in one click', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/classification`,
        data: classification,
      },
      {
        method: 'PATCH',
        match: `/api/workspaces/${WS}/servicedesk/tickets/${TICKET_ID}`,
        data: ticketDTO(),
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    expect(await screen.findByText('Classificação sugerida')).toBeTruthy()
    expect(screen.getByText('82% de confiança')).toBeTruthy()
    expect(screen.getByText('A descrição cita falha de VPN.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar tudo' }))
    await waitFor(() =>
      expect(
        fetchBody(spy, `/servicedesk/tickets/${TICKET_ID}`, 'PATCH'),
      ).toEqual({
        categoryId: 'cat-1',
        subcategoryId: 'sub-1',
        urgencyId: 'urg-1',
        priorityId: 'pri-1',
        departmentId: 'dep-1',
        tags: ['vpn', 'acesso'],
      }),
    )
  })

  it('marks a suggestion already applied to the ticket', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/classification`,
        data: classification,
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(
      <SdAiCopilotPanel
        workspaceId={WS}
        ticket={ticketDTO({
          department: { id: 'dep-1', name: 'Infraestrutura' },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Classificar' }))
    expect(await screen.findByText('Aplicado')).toBeTruthy()
  })

  it('explains that the AI is disabled instead of a raw error', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/summary`,
        handler: apiError(
          'SD_AI_DISABLED',
          'O agente de IA do ServiceDesk está desativado',
        ),
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resumir' }))
    expect(
      await screen.findByText(
        'O agente de IA está desativado nas configurações do ServiceDesk.',
      ),
    ).toBeTruthy()
  })

  it('explains the monthly AI quota', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `${TICKET_AI}/summary`,
        handler: apiError('AI_QUOTA_EXCEEDED', 'Cota de IA esgotada', 402),
      },
      ...BASE_ROUTES,
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Resumir' }))
    expect(
      await screen.findByText(
        'A cota mensal de IA do workspace acabou. Fale com um administrador.',
      ),
    ).toBeTruthy()
  })

  it('shows the saved summary of the ticket', () => {
    mockFetch(BASE_ROUTES)
    renderWithQuery(
      <SdAiCopilotPanel
        workspaceId={WS}
        ticket={ticketDTO({ aiSummary: 'Resumo anterior da IA' })}
      />,
    )
    expect(screen.getByText('Resumo anterior da IA')).toBeTruthy()
  })

  it('chats with the copilot and keeps the history', async () => {
    const spy = mockFetch([
      { method: 'POST', match: `${TICKET_AI}/chat`, data: chat },
      { match: KB_SUGGEST, data: [] },
      { match: `${TICKET_AI}/chat`, data: null },
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(
      screen.getByRole('button', { name: 'Perguntar ao copiloto' }),
    )
    fireEvent.change(await screen.findByLabelText('Pergunta ao copiloto'), {
      target: { value: 'Qual o histórico deste cliente?' },
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar pergunta ao copiloto' }),
    )

    expect(
      await screen.findByText('Três chamados de VPN nos últimos 30 dias.'),
    ).toBeTruthy()
    expect(fetchBody(spy, '/chat')).toEqual({
      message: 'Qual o histórico deste cliente?',
    })
  })

  it('links a knowledge base article suggested for the ticket', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `/servicedesk/tickets/${TICKET_ID}/kb-links`,
        data: { ticketId: TICKET_ID, articleId: 'a1' },
      },
      {
        match: KB_SUGGEST,
        data: [
          {
            id: 'a1',
            workspaceId: WS,
            parentId: null,
            title: 'Como reinstalar a VPN',
            icon: null,
            coverImage: null,
            status: 'PUBLISHED',
            visibility: 'INTERNAL',
            categoryId: null,
            tags: [],
            position: 0,
            viewCount: 0,
            helpfulCount: 0,
            notHelpfulCount: 0,
            publishedAt: null,
            archivedAt: null,
            createdAt: '2026-09-21T12:00:00.000Z',
            updatedAt: '2026-09-21T12:00:00.000Z',
            excerpt: 'Passo a passo da reinstalação',
            rank: 1,
          },
        ],
      },
      { match: `${TICKET_AI}/chat`, data: null },
    ])
    renderWithQuery(<SdAiCopilotPanel workspaceId={WS} ticket={ticketDTO()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Artigos da base' }))
    expect(await screen.findByText('Como reinstalar a VPN')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Vincular' }))

    await waitFor(() =>
      expect(fetchBody(spy, '/kb-links')).toEqual({ articleId: 'a1' }),
    )
  })
})
