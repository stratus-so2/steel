import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import { createOpenAiProvider } from '../ai/openai-provider'

function fakeClient(...responses: unknown[]) {
  const create = vi.fn()
  for (const response of responses) create.mockResolvedValueOnce(response)
  const client = { responses: { create } } as unknown as OpenAI
  return { client, create }
}

describe('createOpenAiProvider()', () => {
  it('should send system + messages and return text and usage', async () => {
    const { client, create } = fakeClient({
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: 'Olá!' }],
        },
      ],
      output_text: 'Olá!',
      usage: { input_tokens: 12, output_tokens: 3 },
    })

    const result = await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      system: 'Seja breve',
      messages: [{ role: 'user', content: 'Oi' }],
    })

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-4o-mini',
        input: [
          { role: 'system', content: 'Seja breve' },
          { role: 'user', content: 'Oi' },
        ],
      }),
    )
    expect(create.mock.calls[0][0]).not.toHaveProperty('tools')
    expect(result.text).toBe('Olá!')
    expect(result.stopReason).toBe('end')
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 3 })
  })

  it('should map function tools, web search and parse tool calls', async () => {
    const output = [
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'list_leads',
        arguments: '{"limit":5}',
      },
    ]
    const { client, create } = fakeClient({
      output,
      output_text: '',
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    const result = await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Liste leads' }],
      webSearch: true,
      tools: [
        {
          name: 'list_leads',
          description: 'Lista leads',
          parameters: { type: 'object', properties: {} },
        },
      ],
    })

    const args = create.mock.calls[0][0]
    expect(args.tools).toEqual([
      { type: 'web_search' },
      expect.objectContaining({ type: 'function', name: 'list_leads' }),
    ])
    expect(result.stopReason).toBe('tool_use')
    expect(result.toolCalls).toEqual([
      { id: 'call_1', name: 'list_leads', arguments: { limit: 5 } },
    ])
    expect(result.message.raw).toEqual({ provider: 'openai', content: output })
  })

  it('should replay native output items and tool results on the next round', async () => {
    const { client, create } = fakeClient({
      output: [],
      output_text: 'ok',
      usage: { input_tokens: 1, output_tokens: 1 },
    })
    const nativeItems = [
      { type: 'reasoning', id: 'rs_1', summary: [] },
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'x',
        arguments: '{}',
      },
    ]

    await createOpenAiProvider(client).chat({
      model: 'gpt-5',
      messages: [
        { role: 'user', content: 'Oi' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'x', arguments: {} }],
          raw: { provider: 'openai', content: nativeItems },
        },
        { role: 'tool', toolCallId: 'call_1', name: 'x', content: '{"a":1}' },
      ],
    })

    expect(create.mock.calls[0][0].input).toEqual([
      { role: 'user', content: 'Oi' },
      ...nativeItems,
      { type: 'function_call_output', call_id: 'call_1', output: '{"a":1}' },
    ])
  })

  it('should map image parts, tool choice and json schema', async () => {
    const { client, create } = fakeClient({
      output: [],
      output_text: '{"ok":true}',
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Veja' },
            { type: 'image', url: 'https://img/x.png' },
          ],
        },
      ],
      tools: [{ name: 't', description: 'd', parameters: { type: 'object' } }],
      toolChoice: 'none',
      jsonSchema: { name: 'r', schema: { type: 'object' } },
    })

    const args = create.mock.calls[0][0]
    expect(args.input[0].content).toEqual([
      { type: 'input_text', text: 'Veja' },
      { type: 'input_image', image_url: 'https://img/x.png', detail: 'auto' },
    ])
    expect(args.tool_choice).toBe('none')
    expect(args.text.format).toEqual(
      expect.objectContaining({ type: 'json_schema', name: 'r' }),
    )
  })

  it('should flag a refusal', async () => {
    const { client } = fakeClient({
      output: [
        { type: 'message', content: [{ type: 'refusal', refusal: 'não' }] },
      ],
      output_text: '',
      usage: { input_tokens: 1, output_tokens: 1 },
    })

    const result = await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'x' }],
    })
    expect(result.stopReason).toBe('refusal')
  })
})
