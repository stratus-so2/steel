import { describe, expect, it } from 'vitest'
import type {
  AiMessageDTO,
  AiPendingActionDTO,
  AiToolCallDTO,
  SteelAiStreamEvent,
} from '@/types/steel-ai'
import {
  applySteelAiStreamEvent,
  createSteelAiSseParser,
  emptySteelAiLiveMessage,
  readSteelAiStream,
} from '../steel-ai-stream'

function collect(chunks: string[], flush = true) {
  const events: SteelAiStreamEvent[] = []
  const parser = createSteelAiSseParser((event) => events.push(event))
  for (const chunk of chunks) parser.push(chunk)
  if (flush) parser.flush()
  return events
}

const delta = (text: string) =>
  `event: text.delta\ndata: ${JSON.stringify({ type: 'text.delta', delta: text })}\n\n`

const call = (status: AiToolCallDTO['status']): AiToolCallDTO => ({
  id: 'call_1',
  name: 'crm.list_opportunities',
  label: 'Consultando oportunidades',
  module: 'CRM',
  status,
})

const action = (
  status: AiPendingActionDTO['status'] = 'PENDING',
): AiPendingActionDTO => ({
  id: 'act_1',
  conversationId: 'c1',
  agentRunId: null,
  toolName: 'crm.delete_opportunity',
  kind: 'DELETE',
  module: 'CRM',
  preview: { title: 'Excluir a oportunidade “Acme”', summary: 'Remove.' },
  status,
  requiresDoubleConfirm: true,
  autoExecuted: false,
  resultSummary: null,
  error: null,
  expiresAt: '2026-10-06T12:30:00.000Z',
  decidedAt: null,
  executedAt: null,
  createdAt: '2026-10-06T12:00:00.000Z',
})

describe('createSteelAiSseParser', () => {
  it('parses one JSON event per blank-line-terminated block', () => {
    expect(collect([delta('Olá'), delta(' mundo')])).toEqual([
      { type: 'text.delta', delta: 'Olá' },
      { type: 'text.delta', delta: ' mundo' },
    ])
  })

  it('reassembles events split across arbitrary chunks', () => {
    const raw = delta('abc') + delta('def')
    const chunks = raw.split('')
    expect(collect(chunks)).toEqual([
      { type: 'text.delta', delta: 'abc' },
      { type: 'text.delta', delta: 'def' },
    ])
  })

  it('accepts CRLF and CR line breaks, even with CRLF split across chunks', () => {
    const body = 'data: {"type":"text.delta","delta":"x"}'
    expect(collect([`${body}\r`, '\n\r', '\n'])).toEqual([
      { type: 'text.delta', delta: 'x' },
    ])
    expect(collect([`${body}\r\r`])).toEqual([
      { type: 'text.delta', delta: 'x' },
    ])
  })

  it('uses the event name when the JSON has no type', () => {
    expect(
      collect(['event: conversation.title\ndata: {"title":"Pipeline"}\n\n']),
    ).toEqual([{ type: 'conversation.title', title: 'Pipeline' }])
  })

  it('joins multi-line data with a newline', () => {
    expect(
      collect(['data: {"type":"text.delta",\ndata: "delta":"y"}\n\n']),
    ).toEqual([{ type: 'text.delta', delta: 'y' }])
  })

  it('ignores comments, unknown fields, empty blocks and bad payloads', () => {
    expect(
      collect([
        ': keep-alive\n\n',
        'id: 1\nretry: 100\n\n',
        'event: text.delta\n\n',
        'data: not json\n\n',
        'data: 42\n\n',
        'data: {"delta":"no type, no event"}\n\n',
        'data\n\n',
        'data:{"type":"text.delta","delta":"ok"}\n\n',
      ]),
    ).toEqual([{ type: 'text.delta', delta: 'ok' }])
  })

  it('flushes a trailing event without the final blank line', () => {
    expect(collect(['data: {"type":"text.delta","delta":"fim"}'])).toEqual([
      { type: 'text.delta', delta: 'fim' },
    ])
    expect(collect(['data: {"type":"text.delta","delta":"r"}\r'])).toEqual([
      { type: 'text.delta', delta: 'r' },
    ])
    expect(collect(['data: {"type":"text.delta","delta":"z"}'], false)).toEqual(
      [],
    )
  })
})

describe('readSteelAiStream', () => {
  it('decodes a byte stream into events', async () => {
    const encoder = new TextEncoder()
    const bytes = encoder.encode(delta('ção') + delta('!'))
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split inside a multi-byte character on purpose.
        controller.enqueue(bytes.slice(0, 40))
        controller.enqueue(bytes.slice(40))
        controller.close()
      },
    })
    const events: SteelAiStreamEvent[] = []
    await readSteelAiStream(body, (event) => events.push(event))
    expect(events).toEqual([
      { type: 'text.delta', delta: 'ção' },
      { type: 'text.delta', delta: '!' },
    ])
  })
})

describe('applySteelAiStreamEvent', () => {
  it('folds a full turn into the live message', () => {
    const message: AiMessageDTO = {
      id: 'm_final',
      conversationId: 'c1',
      role: 'ASSISTANT',
      content: 'Olá!',
      toolCalls: [call('done')],
      pendingActions: [action('EXECUTED')],
      attachments: [],
      createdAt: '2026-10-06T12:00:00.000Z',
    }
    const events: SteelAiStreamEvent[] = [
      { type: 'message.start', conversationId: 'c1', messageId: 'm1' },
      { type: 'tool.start', call: call('running') },
      { type: 'tool.end', call: call('done') },
      { type: 'text.delta', delta: 'Ol' },
      { type: 'text.delta', delta: 'á!' },
      { type: 'action.pending', action: action() },
      { type: 'action.pending', action: action('PENDING') },
      { type: 'conversation.title', title: 'Saudação' },
      {
        type: 'message.end',
        message,
        usage: { inputTokens: 1, outputTokens: 2 },
      },
    ]
    const state = events.reduce(
      applySteelAiStreamEvent,
      emptySteelAiLiveMessage(),
    )
    expect(state).toEqual({
      id: 'm_final',
      content: 'Olá!',
      toolCalls: [call('done')],
      pendingActions: [action('EXECUTED')],
      status: 'done',
      error: null,
    })
  })

  it('marks the message as failed on an error event', () => {
    const state = applySteelAiStreamEvent(emptySteelAiLiveMessage(), {
      type: 'error',
      code: 'AI_PROVIDER_UNAVAILABLE',
      message: 'Provedor indisponível',
    })
    expect(state.status).toBe('error')
    expect(state.error).toEqual({
      code: 'AI_PROVIDER_UNAVAILABLE',
      message: 'Provedor indisponível',
    })
  })

  it('ignores unknown event types', () => {
    const initial = emptySteelAiLiveMessage()
    expect(
      applySteelAiStreamEvent(initial, {
        type: 'something.else',
      } as unknown as SteelAiStreamEvent),
    ).toBe(initial)
  })
})
