import type Anthropic from '@anthropic-ai/sdk'
import type OpenAI from 'openai'
import { describe, expect, it, vi } from 'vitest'
import {
  createAnthropicProvider,
  toAnthropicMessages,
} from '../ai/anthropic-provider'
import { findAiModel, isAiModelKey } from '../ai/models'
import { createOpenAiProvider } from '../ai/openai-provider'
import { parseToolArguments } from '../ai/types'

describe('parseToolArguments()', () => {
  it('should pass through plain objects', () => {
    expect(parseToolArguments({ a: 1 })).toEqual({ a: 1 })
  })

  it('should parse JSON object strings', () => {
    expect(parseToolArguments('{"limit":5}')).toEqual({ limit: 5 })
  })

  it('should fall back to an empty object for malformed or non-object input', () => {
    expect(parseToolArguments('{not json')).toEqual({})
    expect(parseToolArguments('[1,2]')).toEqual({})
    expect(parseToolArguments('null')).toEqual({})
    expect(parseToolArguments([1, 2])).toEqual({})
    expect(parseToolArguments(42)).toEqual({})
    expect(parseToolArguments(undefined)).toEqual({})
  })
})

describe('AI model catalog', () => {
  it('should find catalog models by key', () => {
    expect(findAiModel('openai:gpt-4o-mini')?.key).toBe('openai:gpt-4o-mini')
    expect(isAiModelKey('openai:gpt-4o-mini')).toBe(true)
  })

  it('should reject unknown keys', () => {
    expect(findAiModel('openai:gpt-0')).toBeUndefined()
    expect(isAiModelKey('openai:gpt-0')).toBe(false)
  })
})

describe('createOpenAiProvider() — edge cases', () => {
  function fakeClient(response: unknown) {
    const create = vi.fn().mockResolvedValue(response)
    return {
      client: { responses: { create } } as unknown as OpenAI,
      create,
    }
  }

  it('should rebuild assistant turns from another provider as message + function calls', async () => {
    const { client, create } = fakeClient({ output: [], output_text: 'ok' })

    await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Oi' },
        {
          role: 'assistant',
          content: 'Vou olhar',
          toolCalls: [{ id: 'c1', name: 'x', arguments: { a: 1 } }],
          raw: { provider: 'anthropic', content: [] },
        },
        {
          role: 'tool',
          toolCallId: 'c1',
          name: 'x',
          content: '{"ok":true}',
        },
        // Turno do assistente só com tool calls (sem texto).
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'c2', name: 'y', arguments: {} }],
        },
        // Turno vazio: nada é reenviado.
        { role: 'assistant', content: '' },
      ],
    })

    const params = create.mock.calls[0][0]
    expect(params.input).toEqual([
      { role: 'user', content: 'Oi' },
      { role: 'assistant', content: 'Vou olhar' },
      {
        type: 'function_call',
        call_id: 'c1',
        name: 'x',
        arguments: '{"a":1}',
      },
      { type: 'function_call_output', call_id: 'c1', output: '{"ok":true}' },
      { type: 'function_call', call_id: 'c2', name: 'y', arguments: '{}' },
    ])
    // Sem tools: nem `tools` nem `tool_choice` vão na requisição.
    expect(params).not.toHaveProperty('tools')
    expect(params).not.toHaveProperty('tool_choice')
    expect(params).not.toHaveProperty('max_output_tokens')
  })

  it('should ignore tool choice when no tools are offered', async () => {
    const { client, create } = fakeClient({ output: [], output_text: '' })

    await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Oi' }],
      toolChoice: 'auto',
    })

    expect(create.mock.calls[0][0]).not.toHaveProperty('tool_choice')
  })

  it('should default missing text and usage and flag truncated output', async () => {
    const { client } = fakeClient({
      output: [{ type: 'message', content: [{ type: 'output_text' }] }],
      incomplete_details: { reason: 'max_output_tokens' },
    })

    const result = await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Oi' }],
      maxTokens: 10,
    })

    expect(result.text).toBe('')
    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(result.stopReason).toBe('max_tokens')
    expect(result.message).not.toHaveProperty('toolCalls')
  })

  it('should parse malformed tool arguments as an empty object', async () => {
    const { client } = fakeClient({
      output: [
        {
          type: 'function_call',
          call_id: 'c1',
          name: 'list_leads',
          arguments: '{oops',
        },
      ],
      output_text: '',
    })

    const result = await createOpenAiProvider(client).chat({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Liste' }],
    })

    expect(result.toolCalls).toEqual([
      { id: 'c1', name: 'list_leads', arguments: {} },
    ])
    expect(result.stopReason).toBe('tool_use')
  })
})

describe('createAnthropicProvider() — edge cases', () => {
  function fakeClient(...responses: unknown[]) {
    const create = vi.fn()
    for (const response of responses) create.mockResolvedValueOnce(response)
    return {
      client: { messages: { create } } as unknown as Anthropic,
      create,
    }
  }

  const baseMessage = {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    usage: { input_tokens: 1, output_tokens: 1 },
  }

  it('should report max_tokens truncation', async () => {
    const { client } = fakeClient({
      ...baseMessage,
      content: [{ type: 'text', text: 'meio corta' }],
      stop_reason: 'max_tokens',
    })

    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Oi' }],
    })

    expect(result.stopReason).toBe('max_tokens')
    expect(result.text).toBe('meio corta')
  })

  it('should stop resuming pause_turn after the continuation limit', async () => {
    const paused = {
      ...baseMessage,
      content: [{ type: 'text', text: '.' }],
      stop_reason: 'pause_turn',
    }
    const { client, create } = fakeClient(
      paused,
      paused,
      paused,
      paused,
      paused,
      paused,
      paused,
    )

    const result = await createAnthropicProvider(client).chat({
      model: 'claude-sonnet-5',
      messages: [{ role: 'user', content: 'Pesquise' }],
      webSearch: true,
    })

    // 1 chamada inicial + 5 continuações.
    expect(create).toHaveBeenCalledTimes(6)
    expect(result.text).toBe('......')
    expect(result.usage).toEqual({ inputTokens: 6, outputTokens: 6 })
  })

  it('should replace empty user text with a placeholder', () => {
    expect(
      toAnthropicMessages([
        { role: 'user', content: '   ' },
        {
          role: 'user',
          content: [{ type: 'text', text: '' }],
        },
      ]),
    ).toEqual([
      { role: 'user', content: '(vazio)' },
      { role: 'user', content: [{ type: 'text', text: '(vazio)' }] },
    ])
  })

  it('should drop empty assistant turns from another provider', () => {
    expect(
      toAnthropicMessages([
        { role: 'user', content: 'Oi' },
        { role: 'assistant', content: '  ' },
        { role: 'user', content: 'Alô?' },
      ]),
    ).toEqual([
      { role: 'user', content: 'Oi' },
      { role: 'user', content: 'Alô?' },
    ])
  })

  it('should send only tool calls when the assistant turn has no text', () => {
    expect(
      toAnthropicMessages([
        { role: 'user', content: 'Oi' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 't1', name: 'x', arguments: {} }],
        },
      ])[1],
    ).toEqual({
      role: 'assistant',
      content: [{ type: 'tool_use', id: 't1', name: 'x', input: {} }],
    })
  })
})
