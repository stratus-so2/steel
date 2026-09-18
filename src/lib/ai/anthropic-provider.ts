import type Anthropic from '@anthropic-ai/sdk'
import {
  type AiChatRequest,
  type AiChatResponse,
  type AiContentPart,
  type AiMessage,
  type AiProvider,
  type AiToolCall,
  parseToolArguments,
} from './types'

type MessageParam = Anthropic.Beta.Messages.BetaMessageParam
type ContentBlockParam = Anthropic.Beta.Messages.BetaContentBlockParam
type ContentBlock = Anthropic.Beta.Messages.BetaContentBlock
type ToolUnion = Anthropic.Beta.Messages.BetaToolUnion
type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming

/** Teto de saída padrão para requisições não-streaming (evita timeout HTTP). */
const DEFAULT_MAX_TOKENS = 16_000
/** Continuações de `pause_turn` (loop server-side da busca web). */
const MAX_PAUSE_CONTINUATIONS = 5
/**
 * Fallback server-side em caso de recusa pelos classificadores de segurança
 * do Claude Opus 5: a API refaz a mesma requisição no modelo abaixo dentro
 * da mesma chamada, em vez de devolver uma resposta vazia ao usuário.
 */
const REFUSAL_FALLBACKS: Record<string, string> = {
  'claude-opus-5': 'claude-opus-4-8',
}
const FALLBACK_BETA = 'server-side-fallback-2026-06-01'
/** Modelos sem suporte à versão com filtragem dinâmica da busca web. */
const BASIC_WEB_SEARCH_MODELS = new Set(['claude-haiku-4-5'])

function toUserContent(
  content: string | AiContentPart[],
): string | ContentBlockParam[] {
  if (typeof content === 'string') return content.trim() ? content : '(vazio)'
  return content.map(
    (part): ContentBlockParam =>
      part.type === 'text'
        ? { type: 'text', text: part.text || '(vazio)' }
        : { type: 'image', source: { type: 'url', url: part.url } },
  )
}

export function toAnthropicMessages(messages: AiMessage[]): MessageParam[] {
  const result: MessageParam[] = []
  let pendingToolResults: ContentBlockParam[] = []

  const flushToolResults = () => {
    if (pendingToolResults.length === 0) return
    // Todos os tool_result de um turno vão numa única mensagem de usuário.
    result.push({ role: 'user', content: pendingToolResults })
    pendingToolResults = []
  }

  for (const message of messages) {
    if (message.role === 'tool') {
      pendingToolResults.push({
        type: 'tool_result',
        tool_use_id: message.toolCallId,
        content: message.content,
      })
      continue
    }
    flushToolResults()

    if (message.role === 'user') {
      result.push({ role: 'user', content: toUserContent(message.content) })
      continue
    }

    // Reenvia os blocos nativos sem alteração (thinking, server_tool_use,
    // tool_use): a API exige o turno do assistente intacto no loop de tools.
    if (message.raw?.provider === 'anthropic') {
      result.push({
        role: 'assistant',
        content: message.raw.content as ContentBlockParam[],
      })
      continue
    }

    const blocks: ContentBlockParam[] = []
    if (message.content.trim()) {
      blocks.push({ type: 'text', text: message.content })
    }
    for (const call of message.toolCalls ?? []) {
      blocks.push({
        type: 'tool_use',
        id: call.id,
        name: call.name,
        input: call.arguments,
      })
    }
    if (blocks.length > 0) result.push({ role: 'assistant', content: blocks })
  }
  flushToolResults()

  // A conversa precisa começar pelo usuário (históricos de WhatsApp podem
  // começar com uma mensagem enviada pela empresa).
  if (result[0]?.role === 'assistant') {
    result.unshift({ role: 'user', content: '(início da conversa)' })
  }
  return result
}

function buildTools(request: AiChatRequest): ToolUnion[] {
  const tools: ToolUnion[] = (request.tools ?? []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema:
      tool.parameters as Anthropic.Beta.Messages.BetaTool.InputSchema,
  }))
  if (request.webSearch) {
    tools.unshift(
      BASIC_WEB_SEARCH_MODELS.has(request.model)
        ? { type: 'web_search_20250305', name: 'web_search' }
        : { type: 'web_search_20260209', name: 'web_search' },
    )
  }
  return tools
}

/**
 * Adaptador do Claude (Anthropic Messages API). Usa o namespace `beta` só
 * para poder ligar o fallback de recusa no Opus 5; o resto é a API padrão.
 */
export function createAnthropicProvider(client: Anthropic): AiProvider {
  return {
    id: 'anthropic',
    async chat(request: AiChatRequest): Promise<AiChatResponse> {
      const tools = buildTools(request)
      const messages = toAnthropicMessages(request.messages)
      const fallback = REFUSAL_FALLBACKS[request.model]

      const params: CreateParams = {
        model: request.model,
        max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
        messages,
        ...(request.system && { system: request.system }),
        ...(tools.length > 0 && { tools }),
        ...(tools.length > 0 &&
          request.toolChoice && { tool_choice: { type: request.toolChoice } }),
        ...(request.jsonSchema && {
          output_config: {
            format: { type: 'json_schema', schema: request.jsonSchema.schema },
          },
        }),
        ...(fallback && {
          betas: [FALLBACK_BETA],
          fallbacks: [{ model: fallback }],
        }),
      }

      const content: ContentBlock[] = []
      let inputTokens = 0
      let outputTokens = 0
      let response = await client.beta.messages.create(params)

      for (let i = 0; ; i++) {
        content.push(...response.content)
        inputTokens +=
          response.usage.input_tokens +
          (response.usage.cache_creation_input_tokens ?? 0) +
          (response.usage.cache_read_input_tokens ?? 0)
        outputTokens += response.usage.output_tokens

        // A busca web roda num loop server-side que pode pausar; reenviar o
        // turno do assistente faz a API retomar de onde parou.
        if (
          response.stop_reason !== 'pause_turn' ||
          i >= MAX_PAUSE_CONTINUATIONS
        ) {
          break
        }
        response = await client.beta.messages.create({
          ...params,
          messages: [
            ...messages,
            { role: 'assistant', content: [...content] as ContentBlockParam[] },
          ],
        })
      }

      const toolCalls: AiToolCall[] = content
        .filter(
          (block): block is Anthropic.Beta.Messages.BetaToolUseBlock =>
            block.type === 'tool_use',
        )
        .map((block) => ({
          id: block.id,
          name: block.name,
          arguments: parseToolArguments(block.input),
        }))

      const text = content
        .filter(
          (block): block is Anthropic.Beta.Messages.BetaTextBlock =>
            block.type === 'text',
        )
        .map((block) => block.text)
        .join('')
        .trim()

      return {
        text,
        toolCalls,
        message: {
          role: 'assistant',
          content: text,
          ...(toolCalls.length > 0 && { toolCalls }),
          raw: { provider: 'anthropic', content },
        },
        usage: { inputTokens, outputTokens },
        stopReason:
          response.stop_reason === 'refusal'
            ? 'refusal'
            : toolCalls.length > 0
              ? 'tool_use'
              : response.stop_reason === 'max_tokens'
                ? 'max_tokens'
                : 'end',
      }
    },
  }
}
