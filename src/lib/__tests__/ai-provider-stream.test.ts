import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import { createAnthropicProvider } from '../ai/anthropic-provider'
import { createOpenAiProvider } from '../ai/openai-provider'
import type { AiStreamChunk } from '../ai/types'

async function collect(iterable: AsyncIterable<AiStreamChunk>) {
  const chunks: AiStreamChunk[] = []
  for await (const chunk of iterable) chunks.push(chunk)
  return chunks
}

function anthropicMessage(overrides: Record<string, unknown>) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  }
}

function anthropicStream(events: unknown[], final: unknown) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event
    },
    finalMessage: vi.fn().mockResolvedValue(final),
  }
}

function anthropicClient(...streams: ReturnType<typeof anthropicStream>[]) {
  const stream = vi.fn()
  for (const s of streams) stream.mockReturnValueOnce(s)
  return { client: { messages: { stream } } as unknown as Anthropic, stream }
}

const textDelta = (text: string) => ({
  type: 'content_block_delta',
  index: 0,
  delta: { type: 'text_delta', text },
})

describe('createAnthropicProvider().chatStream()', () => {
  it('should yield text deltas then the final response', async () => {
    const final = anthropicMessage({
      content: [{ type: 'text', text: 'Olá mundo' }],
      usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 1 },
    })
    const { client, stream } = anthropicClient(
      anthropicStream(
        [
          { type: 'message_start' },
          textDelta('Olá '),
          textDelta(''),
          {
            type: 'content_block_delta',
            index: 0,
            delta: { type: 'input_json_delta', partial_json: '{' },
          },
          textDelta('mundo'),
        ],
        final,
      ),
    )

    const chunks = await collect(
      createAnthropicProvider(client).chatStream({
        model: 'claude-sonnet-5',
        system: 'Seja breve',
        messages: [{ role: 'user', content: 'Oi' }],
      }),
    )

    expect(stream.mock.calls[0][0]).toEqual(
      expect.objectContaining({ system: 'Seja breve', max_tokens: 16_000 }),
    )
    expect(chunks.slice(0, 2)).toEqual([
      { type: 'text', delta: 'Olá ' },
      { type: 'text', delta: 'mundo' },
    ])
    const done = chunks[2]
    expect(done.type).toBe('done')
    if (done.type !== 'done') return
    expect(done.response.text).toBe('Olá mundo')
    expect(done.response.stopReason).toBe('end')
    expect(done.response.usage).toEqual({ inputTokens: 11, outputTokens: 4 })
    expect(done.response.message.raw).toEqual({
      provider: 'anthropic',
      content: final.content,
    })
  })

  it('should return tool calls and continue after pause_turn', async () => {
    const first = anthropicMessage({
      content: [{ type: 'server_tool_use', id: 'srv', name: 'web_search' }],
      stop_reason: 'pause_turn',
    })
    const second = anthropicMessage({
      content: [
        { type: 'tool_use', id: 'tu_1', name: 'ws_overview', input: {} },
      ],
      stop_reason: 'tool_use',
    })
    const { client, stream } = anthropicClient(
      anthropicStream([], first),
      anthropicStream([], second),
    )

    const chunks = await collect(
      createAnthropicProvider(client).chatStream({
        model: 'claude-sonnet-5',
        messages: [{ role: 'user', content: 'Oi' }],
        webSearch: true,
        tools: [
          {
            name: 'ws_overview',
            description: 'x',
            parameters: { type: 'object', properties: {} },
          },
        ],
        toolChoice: 'auto',
      }),
    )

    expect(stream).toHaveBeenCalledTimes(2)
    expect(stream.mock.calls[1][0].messages.at(-1)).toEqual({
      role: 'assistant',
      content: first.content,
    })
    expect(chunks).toHaveLength(1)
    const done = chunks[0]
    if (done.type !== 'done') throw new Error('expected done')
    expect(done.response.stopReason).toBe('tool_use')
    expect(done.response.toolCalls).toEqual([
      { id: 'tu_1', name: 'ws_overview', arguments: {} },
    ])
    expect(done.response.usage).toEqual({ inputTokens: 20, outputTokens: 10 })
    expect(done.response.message.raw?.content).toHaveLength(2)
  })
})

function openAiStream(events: unknown[]) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const event of events) yield event
    },
  }
}

function openAiClient(events: unknown[]) {
  const create = vi.fn().mockResolvedValue(openAiStream(events))
  return { client: { responses: { create } } as unknown as OpenAI, create }
}

describe('createOpenAiProvider().chatStream()', () => {
  it('should stream text deltas and finish with the completed response', async () => {
    const response = {
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'Olá!' }],
        },
      ],
      usage: { input_tokens: 7, output_tokens: 2 },
    }
    const { client, create } = openAiClient([
      { type: 'response.created' },
      { type: 'response.output_text.delta', delta: 'Ol' },
      { type: 'response.output_text.delta', delta: '' },
      { type: 'response.output_text.delta', delta: 'á!' },
      { type: 'response.completed', response },
    ])

    const chunks = await collect(
      createOpenAiProvider(client).chatStream({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Oi' }],
        maxTokens: 100,
      }),
    )

    expect(create.mock.calls[0][0]).toEqual(
      expect.objectContaining({ stream: true, max_output_tokens: 100 }),
    )
    expect(chunks.slice(0, 2)).toEqual([
      { type: 'text', delta: 'Ol' },
      { type: 'text', delta: 'á!' },
    ])
    const done = chunks[2]
    if (done.type !== 'done') throw new Error('expected done')
    expect(done.response.text).toBe('Olá!')
    expect(done.response.usage).toEqual({ inputTokens: 7, outputTokens: 2 })
    expect(done.response.message.raw).toEqual({
      provider: 'openai',
      content: response.output,
    })
  })

  it('should map function calls from an incomplete response', async () => {
    const { client } = openAiClient([
      {
        type: 'response.incomplete',
        response: {
          output: [
            {
              type: 'function_call',
              call_id: 'c1',
              name: 'ws_members',
              arguments: '{"limit":3}',
            },
          ],
        },
      },
    ])

    const chunks = await collect(
      createOpenAiProvider(client).chatStream({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: 'Oi' }],
      }),
    )

    const done = chunks[0]
    if (done.type !== 'done') throw new Error('expected done')
    expect(done.response.stopReason).toBe('tool_use')
    expect(done.response.toolCalls).toEqual([
      { id: 'c1', name: 'ws_members', arguments: { limit: 3 } },
    ])
    expect(done.response.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(done.response.text).toBe('')
  })

  it('should throw on failed responses, error events and a missing end', async () => {
    const request = {
      model: 'gpt-4o-mini',
      messages: [{ role: 'user' as const, content: 'Oi' }],
    }
    await expect(
      collect(
        createOpenAiProvider(
          openAiClient([
            { type: 'response.failed', response: { error: { message: 'x' } } },
          ]).client,
        ).chatStream(request),
      ),
    ).rejects.toThrow('x')
    await expect(
      collect(
        createOpenAiProvider(
          openAiClient([{ type: 'response.failed', response: {} }]).client,
        ).chatStream(request),
      ),
    ).rejects.toThrow('OpenAI response failed')
    await expect(
      collect(
        createOpenAiProvider(
          openAiClient([{ type: 'error', message: 'boom' }]).client,
        ).chatStream(request),
      ),
    ).rejects.toThrow('boom')
    await expect(
      collect(
        createOpenAiProvider(openAiClient([]).client).chatStream(request),
      ),
    ).rejects.toThrow('without a response')
  })
})
