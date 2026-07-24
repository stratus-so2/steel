import 'server-only'
import type Anthropic from '@anthropic-ai/sdk'
import {
  type AiProvider,
  getAnthropicKey,
  getAnthropicModel,
  getOpenAiBaseUrl,
  getOpenAiKey,
  getOpenAiModel,
} from './env'

/**
 * Parte de conteúdo multimodal (formato Chat Completions da OpenAI). Só texto
 * é usado hoje (o builder de landing page do Steel não recebe anexos ainda),
 * mas o tipo já cobre imagens para não fechar a porta a esse caso depois.
 */
export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

/** Mensagens no formato Chat Completions da OpenAI. */
export type ChatMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string | ContentPart[] }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: ToolCallPayload[]
    }
  | { role: 'tool'; content: string; tool_call_id: string }

export type ToolCallPayload = {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

/** Definição de uma tool (function-calling). */
export type ToolDef = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** tool_call acumulada ao longo do stream. */
export type AccumulatedToolCall = { id: string; name: string; args: string }

export type AiUsageData = { inputTokens: number; outputTokens: number }

export type AiStreamEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'finish'
      finishReason: string | null
      content: string
      toolCalls: AccumulatedToolCall[]
      usage: AiUsageData | null
    }
  | { type: 'error'; message: string }

const TEMPERATURE = 0.3
const MAX_TOKENS = 4096

/** Overrides por chamada — alguns fluxos (ex.: gerar HTML inteiro) precisam de
 *  um orçamento de saída maior e/ou mais criatividade que o padrão do chat. */
export type StreamOptions = { maxTokens?: number; temperature?: number }

/**
 * Faz uma chamada streaming ao provedor de IA e emite eventos: deltas de texto
 * conforme chegam, e um evento `finish` com o conteúdo completo + tool_calls
 * acumuladas. Erros viram um único evento `error`. O contrato de eventos é o
 * mesmo para os dois provedores — quando `provider === "anthropic"`, a chamada
 * é traduzida para a Messages API e de volta para este formato.
 *
 * @param toolChoice "required" força pelo menos uma tool_call (round 0 do agente);
 *                   "auto" deixa o modelo decidir; "none" proíbe tool calls.
 * @param options sobrescreve `max_tokens`/`temperature` para esta chamada.
 * @param provider qual provedor usar ("openai" padrão ou "anthropic"/Claude).
 */
export async function* streamChat(
  messages: ChatMessage[],
  tools: ToolDef[],
  toolChoice: 'auto' | 'required' | 'none' = 'auto',
  options: StreamOptions = {},
  provider: AiProvider = 'openai',
): AsyncGenerator<AiStreamEvent, void, unknown> {
  if (provider === 'anthropic') {
    yield* streamChatAnthropic(messages, tools, toolChoice, options)
    return
  }

  let response: Response
  try {
    response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getOpenAiKey()}`,
      },
      body: JSON.stringify({
        model: getOpenAiModel(),
        messages,
        ...(tools.length > 0 && { tools, tool_choice: toolChoice }),
        stream: true,
        stream_options: { include_usage: true },
        temperature: options.temperature ?? TEMPERATURE,
        max_tokens: options.maxTokens ?? MAX_TOKENS,
      }),
    })
  } catch (error) {
    console.error('[ai] erro de rede ao chamar OpenAI', error)
    yield { type: 'error', message: 'Erro de rede ao falar com a OpenAI' }
    return
  }

  if (!response.ok || !response.body) {
    const detail = (await response.text().catch(() => '')).slice(0, 500)
    console.error('[ai] OpenAI respondeu erro', response.status, detail)
    yield { type: 'error', message: `OpenAI retornou ${response.status}` }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const toolAcc = new Map<number, AccumulatedToolCall>()
  let content = ''
  let finishReason: string | null = null
  let usageData: AiUsageData | null = null
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') continue

      let chunk: OpenAiChunk
      try {
        chunk = JSON.parse(data) as OpenAiChunk
      } catch {
        continue
      }

      if (chunk.usage) {
        usageData = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
        }
      }

      const choice = chunk.choices?.[0]
      if (!choice) continue
      const delta = choice.delta ?? {}

      if (typeof delta.content === 'string' && delta.content.length > 0) {
        content += delta.content
        yield { type: 'text', delta: delta.content }
      }

      if (Array.isArray(delta.tool_calls)) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0
          const cur = toolAcc.get(idx) ?? { id: '', name: '', args: '' }
          if (tc.id) cur.id = tc.id
          if (tc.function?.name) cur.name += tc.function.name
          if (tc.function?.arguments) cur.args += tc.function.arguments
          toolAcc.set(idx, cur)
        }
      }

      if (choice.finish_reason) finishReason = choice.finish_reason
    }
  }

  const toolCalls = [...toolAcc.values()].filter((t) => t.name.length > 0)
  yield { type: 'finish', finishReason, content, toolCalls, usage: usageData }
}

type OpenAiChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ── Anthropic / Claude ────────────────────────────────────────────────────
// O agente e o construtor de páginas falam o dialeto OpenAI (Chat Completions).
// Para usar o Claude sem reescrever esses fluxos, traduzimos as mensagens e
// tools para a Messages API e devolvemos os mesmos `AiStreamEvent`.

/** Converte uma ChatMessage (dialeto OpenAI) em blocos de conteúdo Anthropic. */
function toAnthropicUserContent(
  content: string | ContentPart[],
): Anthropic.ContentBlockParam[] {
  if (typeof content === 'string') {
    return content.length > 0 ? [{ type: 'text', text: content }] : []
  }
  const blocks: Anthropic.ContentBlockParam[] = []
  for (const part of content) {
    if (part.type === 'text') {
      blocks.push({ type: 'text', text: part.text })
    } else {
      const url = part.image_url.url
      const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(url)
      if (m) {
        blocks.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: m[1] as Anthropic.Base64ImageSource['media_type'],
            data: m[2],
          },
        })
      } else {
        blocks.push({ type: 'image', source: { type: 'url', url } })
      }
    }
  }
  return blocks
}

/**
 * Traduz o histórico (dialeto OpenAI) para `system` + `messages` da Anthropic.
 * Mensagens `system` viram o prompt de sistema; turns de assistente com
 * tool_calls viram blocos `tool_use`; mensagens `tool` viram `tool_result` num
 * turno de usuário. Turns adjacentes de mesmo papel são fundidos (a Messages
 * API espera papéis alternados).
 */
function toAnthropicMessages(messages: ChatMessage[]): {
  system: string
  messages: Anthropic.MessageParam[]
} {
  const systemParts: string[] = []
  const out: Anthropic.MessageParam[] = []

  const push = (
    role: 'user' | 'assistant',
    content: Anthropic.ContentBlockParam[],
  ) => {
    if (content.length === 0) return
    const last = out[out.length - 1]
    if (last && last.role === role && Array.isArray(last.content)) {
      ;(last.content as Anthropic.ContentBlockParam[]).push(...content)
    } else {
      out.push({ role, content })
    }
  }

  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push(m.content)
    } else if (m.role === 'user') {
      push('user', toAnthropicUserContent(m.content))
    } else if (m.role === 'assistant') {
      const blocks: Anthropic.ContentBlockParam[] = []
      if (typeof m.content === 'string' && m.content.trim().length > 0) {
        blocks.push({ type: 'text', text: m.content })
      }
      for (const tc of m.tool_calls ?? []) {
        let input: unknown = {}
        try {
          input = JSON.parse(tc.function.arguments || '{}')
        } catch {
          input = {}
        }
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        })
      }
      push('assistant', blocks)
    } else {
      // role === "tool" → resultado de tool num turno de usuário.
      push('user', [
        {
          type: 'tool_result',
          tool_use_id: m.tool_call_id,
          content: m.content,
        },
      ])
    }
  }

  return { system: systemParts.join('\n\n'), messages: out }
}

/** Converte as tools (dialeto OpenAI) para o formato da Messages API. */
function toAnthropicTools(tools: ToolDef[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function
      .parameters as unknown as Anthropic.Tool.InputSchema,
  }))
}

/** Implementação do `streamChat` para o provedor Anthropic (Claude). */
async function* streamChatAnthropic(
  messages: ChatMessage[],
  tools: ToolDef[],
  toolChoice: 'auto' | 'required' | 'none',
  options: StreamOptions,
): AsyncGenerator<AiStreamEvent, void, unknown> {
  const { default: AnthropicSDK } = await import('@anthropic-ai/sdk')
  const client = new AnthropicSDK({ apiKey: getAnthropicKey() })

  const { system, messages: anthropicMessages } = toAnthropicMessages(messages)

  const toolChoiceParam: Anthropic.ToolChoice | undefined =
    tools.length === 0 || toolChoice === 'none'
      ? undefined
      : toolChoice === 'required'
        ? { type: 'any' }
        : { type: 'auto' }

  let content = ''
  let usageData: AiUsageData | null = null
  try {
    const stream = client.messages.stream({
      model: getAnthropicModel(),
      max_tokens: options.maxTokens ?? MAX_TOKENS,
      ...(system.length > 0 && { system }),
      messages: anthropicMessages,
      ...(tools.length > 0 && toolChoice !== 'none'
        ? { tools: toAnthropicTools(tools), tool_choice: toolChoiceParam }
        : {}),
    })

    for await (const event of stream) {
      if (
        event.type === 'content_block_delta' &&
        event.delta.type === 'text_delta' &&
        event.delta.text.length > 0
      ) {
        content += event.delta.text
        yield { type: 'text', delta: event.delta.text }
      }
    }

    const final = await stream.finalMessage()
    const toolCalls: AccumulatedToolCall[] = []
    for (const block of final.content) {
      if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          args: JSON.stringify(block.input ?? {}),
        })
      }
    }
    usageData = {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
    }
    const finishReason =
      final.stop_reason === 'tool_use'
        ? 'tool_calls'
        : final.stop_reason === 'max_tokens'
          ? 'length'
          : 'stop'
    yield { type: 'finish', finishReason, content, toolCalls, usage: usageData }
  } catch (error) {
    console.error('[ai] erro ao chamar a Anthropic', error)
    yield { type: 'error', message: 'Erro ao falar com a Anthropic (Claude)' }
  }
}
