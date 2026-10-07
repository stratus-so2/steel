import { fireEvent, screen, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import type { AiMessageDTO } from '@/types/steel-ai'
import { SteelAiChat } from '../steel-ai-chat'
import { stashSteelAiPrompt } from '../steel-ai-handoff'
import {
  capabilities,
  conversation,
  renderSteelAi,
  sseResponse,
} from './steel-ai-test-utils'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/acme/ai/c1',
}))

afterEach(() => {
  window.sessionStorage.clear()
})

const userMessage: AiMessageDTO = {
  id: 'm_user',
  conversationId: 'c1',
  role: 'USER',
  content: 'Qual o valor do pipeline?',
  toolCalls: [],
  pendingActions: [],
  attachments: [],
  createdAt: '2026-10-06T12:00:00.000Z',
}

const assistantMessage: AiMessageDTO = {
  id: 'm_ai',
  conversationId: 'c1',
  role: 'ASSISTANT',
  content: 'O pipeline soma **R$ 120 mil**.',
  toolCalls: [
    {
      id: 'call_1',
      name: 'crm.pipeline_summary',
      label: 'Consultando o pipeline',
      module: 'CRM',
      status: 'done',
      summary: '3 estágios',
    },
  ],
  pendingActions: [],
  attachments: [],
  createdAt: '2026-10-06T12:00:01.000Z',
}

function messagePosts(spy: ReturnType<typeof mockFetch>) {
  return spy.mock.calls.filter(
    ([input, init]) =>
      String(input).endsWith('/conversations/c1/messages') &&
      init?.method === 'POST',
  )
}

describe('<SteelAiChat />', () => {
  it('sends the handed-over prompt once and streams the reply', async () => {
    stashSteelAiPrompt('c1', {
      content: 'Qual o valor do pipeline?',
      mode: 'AGENT',
    })
    let persisted = false
    const spy = mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/conversations\/c1\/messages$/,
        handler: () => {
          persisted = true
          return sseResponse([
            { type: 'message.start', conversationId: 'c1', messageId: 'm_ai' },
            {
              type: 'tool.start',
              call: { ...assistantMessage.toolCalls[0], status: 'running' },
            },
            { type: 'tool.end', call: assistantMessage.toolCalls[0] },
            { type: 'text.delta', delta: 'O pipeline soma ' },
            { type: 'text.delta', delta: '**R$ 120 mil**.' },
            { type: 'conversation.title', title: 'Valor do pipeline' },
            {
              type: 'message.end',
              message: assistantMessage,
              usage: { inputTokens: 10, outputTokens: 5 },
            },
          ])
        },
      },
      {
        match: /\/conversations\/c1\/messages$/,
        handler: () => (persisted ? [userMessage, assistantMessage] : []),
      },
      {
        match: /\/conversations\/c1$/,
        handler: () =>
          conversation({
            mode: 'AGENT',
            title: persisted ? 'Valor do pipeline' : null,
          }),
      },
      { match: /\/ai\/conversations(\?|$)/, data: [] },
    ])

    renderSteelAi(
      <StrictMode>
        <SteelAiChat conversationId='c1' />
      </StrictMode>,
    )

    expect(await screen.findByText('R$ 120 mil')).toBeTruthy()
    expect(screen.getByText('Consultando o pipeline')).toBeTruthy()
    await waitFor(() =>
      expect(screen.getAllByText('Qual o valor do pipeline?')).toHaveLength(1),
    )
    expect(await screen.findByText('Valor do pipeline')).toBeTruthy()

    const posts = messagePosts(spy)
    expect(posts).toHaveLength(1)
    expect(JSON.parse(String(posts[0][1]?.body))).toEqual({
      content: 'Qual o valor do pipeline?',
      mode: 'AGENT',
      attachmentIds: [],
    })
    // Agent mode was kept for the next turns.
    expect(
      screen
        .getByRole('button', { name: /^Build$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('shows the persisted transcript without sending anything', async () => {
    const spy = mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        match: /\/conversations\/c1\/messages$/,
        data: [userMessage, assistantMessage],
      },
      {
        match: /\/conversations\/c1$/,
        data: conversation({ title: 'Pipeline' }),
      },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    expect(await screen.findByText('R$ 120 mil')).toBeTruthy()
    expect(screen.getByText('— 3 estágios', { exact: false })).toBeTruthy()
    expect(messagePosts(spy)).toHaveLength(0)
  })

  it('gives the text back and shows the reason when the quota is exceeded', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/conversations\/c1\/messages$/,
        handler: () =>
          new Response(
            JSON.stringify({
              success: false,
              statusCode: 402,
              message: 'Cota mensal de IA atingida (US$ 50,00 de US$ 50,00).',
              error: { code: 'AI_QUOTA_EXCEEDED' },
            }),
            { status: 402, headers: { 'content-type': 'application/json' } },
          ),
      },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      { match: /\/conversations\/c1$/, data: conversation() },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    const box = (await screen.findByLabelText(
      'Mensagem para o Steel AI',
    )) as HTMLTextAreaElement
    fireEvent.change(box, { target: { value: 'Resuma os chamados' } })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

    expect(await screen.findByText(/Cota mensal de IA atingida/)).toBeTruthy()
    await waitFor(() => expect(box.value).toBe('Resuma os chamados'))
    expect(
      screen.queryByText('Resuma os chamados', { selector: 'div' }),
    ).toBeNull()
  })

  it('stops the stream on demand', async () => {
    let signal: AbortSignal | undefined
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        method: 'POST',
        match: /\/conversations\/c1\/messages$/,
        handler: (_url, init) => {
          signal = init?.signal ?? undefined
          const encoder = new TextEncoder()
          const body = new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  'data: {"type":"text.delta","delta":"Analisando"}\n\n',
                ),
              )
              signal?.addEventListener('abort', () =>
                controller.error(new DOMException('aborted', 'AbortError')),
              )
            },
          })
          return new Response(body, {
            headers: { 'content-type': 'text/event-stream' },
          })
        },
      },
      { match: /\/conversations\/c1\/messages$/, data: [] },
      { match: /\/conversations\/c1$/, data: conversation() },
      { match: /\/ai\/conversations(\?|$)/, data: [] },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    fireEvent.change(await screen.findByLabelText('Mensagem para o Steel AI'), {
      target: { value: 'Analise tudo' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }))

    expect(await screen.findByText('Analisando')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Parar resposta' }))
    await waitFor(() => expect(signal?.aborted).toBe(true))
    expect(
      await screen.findByRole('button', { name: 'Enviar mensagem' }),
    ).toBeTruthy()
  })

  it('shows a not-found state for a conversation that is gone', async () => {
    mockFetch([
      { match: '/ai/capabilities', data: capabilities() },
      {
        match: /\/conversations\/c1\/messages$/,
        status: 404,
        error: 'Conversa não encontrada',
      },
      {
        match: /\/conversations\/c1$/,
        status: 404,
        error: 'Conversa não encontrada',
      },
    ])
    renderSteelAi(<SteelAiChat conversationId='c1' />)
    expect(await screen.findByText('Conversa não encontrada')).toBeTruthy()
    expect(
      screen
        .getByText('Começar um novo chat')
        .closest('a')
        ?.getAttribute('href'),
    ).toBe('/acme/ai')
  })
})
