import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it, vi } from 'vitest'
import {
  createAnthropicProvider,
  toAnthropicMessages,
} from '../ai/anthropic-provider'

function message(overrides: Record<string, unknown>) {
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

function fakeClient(...responses: unknown[]) {
  const create = vi.fn()
  for (const response of responses) create.mockResolvedValueOnce(response)
  const client = { messages: { create } } as unknown as Anthropic
  return { client, create }
}

describe('createAnthropicProvider()', () => {
  it('should send system, max_tokens and return text and usage', async () => {
    const { client, create } = fakeClient(
      message({
        content: [{ type: 'text', text: 'Olá!' }],
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          cache_read_input_tokens: 2,
        },
      }),
    )

    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      system: 'Seja breve',
      messages: [{ role: 'user', content: 'Oi' }],
    })

    const args = create.mock.calls[0][0]
    expect(args).toEqual(
      expect.objectContaining({
        model: 'claude-sonnet-5',
        system: 'Seja breve',
        max_tokens: 16_000,
        messages: [{ role: 'user', content: 'Oi' }],
      }),
    )
    expect(args).not.toHaveProperty('tools')
    expect(args).not.toHaveProperty('fallbacks')
    expect(result.text).toBe('Olá!')
    expect(result.stopReason).toBe('end')
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 5 })
  })

  it('should map tools + web search and return tool calls', async () => {
    const content = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'tool_use', id: 'tu_1', name: 'list_leads', input: { limit: 5 } },
    ]
    const { client, create } = fakeClient(
      message({ content, stop_reason: 'tool_use' }),
    )

    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Liste' }],
      webSearch: true,
      tools: [
        {
          name: 'list_leads',
          description: 'Lista leads',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    expect(create.mock.calls[0][0].tools).toEqual([
      { type: 'web_search_20260209', name: 'web_search' },
      {
        name: 'list_leads',
        description: 'Lista leads',
        input_schema: { type: 'object', properties: {} },
      },
    ])
    expect(result.stopReason).toBe('tool_use')
    expect(result.toolCalls).toEqual([
      { id: 'tu_1', name: 'list_leads', arguments: { limit: 5 } },
    ])
    expect(result.message.raw).toEqual({ provider: 'anthropic', content })
  })

  it('should use the basic web search tool on Haiku 4.5', async () => {
    const { client, create } = fakeClient(
      message({ content: [{ type: 'text', text: 'ok' }] }),
    )
    await createAnthropicProvider(client).chat({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'x' }],
      webSearch: true,
    })
    expect(create.mock.calls[0][0].tools).toEqual([
      { type: 'web_search_20250305', name: 'web_search' },
    ])
  })

  it('should not enable any refusal fallback on Claude Opus 5', async () => {
    const { client, create } = fakeClient(
      message({ content: [{ type: 'text', text: 'ok' }] }),
    )
    await createAnthropicProvider(client).chat({
      model: 'claude-opus-5',
      messages: [{ role: 'user', content: 'x' }],
    })
    const args = create.mock.calls[0][0]
    expect(args).not.toHaveProperty('betas')
    expect(args).not.toHaveProperty('fallbacks')
    expect(args.model).toBe('claude-opus-5')
  })

  it('should resume a pause_turn and accumulate content and usage', async () => {
    const first = [{ type: 'server_tool_use', id: 's1', name: 'web_search' }]
    const { client, create } = fakeClient(
      message({ content: first, stop_reason: 'pause_turn' }),
      message({ content: [{ type: 'text', text: 'Achei' }] }),
    )

    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Pesquise' }],
      webSearch: true,
    })

    expect(create).toHaveBeenCalledTimes(2)
    expect(create.mock.calls[1][0].messages).toEqual([
      { role: 'user', content: 'Pesquise' },
      { role: 'assistant', content: first },
    ])
    expect(result.text).toBe('Achei')
    expect(result.usage).toEqual({ inputTokens: 20, outputTokens: 10 })
  })

  it('should report a refusal without tool calls being actionable', async () => {
    const { client } = fakeClient(
      message({ content: [], stop_reason: 'refusal' }),
    )
    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'x' }],
    })
    expect(result.stopReason).toBe('refusal')
    expect(result.text).toBe('')
  })

  it('should map json schema, tool choice and max tokens', async () => {
    const { client, create } = fakeClient(
      message({ content: [{ type: 'text', text: '{}' }] }),
    )
    await createAnthropicProvider(client).chat({
      model: 'claude-haiku-4-5',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ name: 't', description: 'd', parameters: { type: 'object' } }],
      toolChoice: 'none',
      jsonSchema: { name: 'r', schema: { type: 'object' } },
      maxTokens: 1024,
    })
    const args = create.mock.calls[0][0]
    expect(args.tool_choice).toEqual({ type: 'none' })
    expect(args.output_config).toEqual({
      format: { type: 'json_schema', schema: { type: 'object' } },
    })
    expect(args.max_tokens).toBe(1024)
  })
})

describe('toAnthropicMessages()', () => {
  it('should merge consecutive tool results into one user message', () => {
    const raw = [{ type: 'tool_use', id: 'a', name: 'x', input: {} }]
    expect(
      toAnthropicMessages([
        { role: 'user', content: 'Oi' },
        {
          role: 'assistant',
          content: '',
          raw: { provider: 'anthropic', content: raw },
        },
        { role: 'tool', toolCallId: 'a', name: 'x', content: '1' },
        { role: 'tool', toolCallId: 'b', name: 'x', content: '2' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: raw },
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'a', content: '1' },
          { type: 'tool_result', tool_use_id: 'b', content: '2' },
        ],
      },
    ])
  })

  it('should prepend a user turn when history starts with the assistant', () => {
    const result = toAnthropicMessages([
      { role: 'assistant', content: 'Olá, sou da clínica' },
      { role: 'user', content: 'Oi' },
    ])
    expect(result[0].role).toBe('user')
    expect(result[1]).toEqual({
      role: 'assistant',
      content: [{ type: 'text', text: 'Olá, sou da clínica' }],
    })
  })

  it('should map image parts to url image blocks', () => {
    expect(
      toAnthropicMessages([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Veja' },
            { type: 'image', url: 'https://img/x.png' },
          ],
        },
      ]),
    ).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Veja' },
          { type: 'image', source: { type: 'url', url: 'https://img/x.png' } },
        ],
      },
    ])
  })

  it('should rebuild tool_use blocks for assistant turns from another provider', () => {
    expect(
      toAnthropicMessages([
        { role: 'user', content: 'Oi' },
        {
          role: 'assistant',
          content: 'Vou olhar',
          toolCalls: [{ id: 'c1', name: 'x', arguments: { a: 1 } }],
          raw: { provider: 'openai', content: [] },
        },
      ])[1],
    ).toEqual({
      role: 'assistant',
      content: [
        { type: 'text', text: 'Vou olhar' },
        { type: 'tool_use', id: 'c1', name: 'x', input: { a: 1 } },
      ],
    })
  })
})
