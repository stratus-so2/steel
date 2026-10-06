import type { AiMessage as AiMessageRow } from '@prisma/client'
import type { AiProviderId } from './models'
import { ACTION_RESULT_PREFIX, serializeToolResult } from './tools/tool-result'
import type { AiAssistantMessage, AiMessage, AiToolCall } from './types'

/**
 * Rebuilds the provider-neutral history of a Steel AI conversation from its
 * persisted rows (USER / ASSISTANT with tool calls and native `raw` / TOOL).
 */

/** Rows loaded per turn (before the size cap). */
export const HISTORY_MAX_ROWS = 80
/** ~20k tokens at ~4 chars/token — older turns are dropped first. */
export const HISTORY_MAX_CHARS = 80_000
/** Decision notes are inlined as text; keep them short. */
const DECISION_NOTE_MAX_CHARS = 2_000

function rowSize(row: AiMessageRow): number {
  let size = row.content.length
  if (row.toolCalls) size += JSON.stringify(row.toolCalls).length
  if (row.raw) size += JSON.stringify(row.raw).length
  return size
}

/**
 * Keeps the most recent rows within `maxChars`, always starting at a USER
 * row so no tool result is left without the call that produced it.
 */
export function capHistory(
  rows: AiMessageRow[],
  maxChars: number = HISTORY_MAX_CHARS,
): AiMessageRow[] {
  let total = 0
  let start = rows.length
  for (let i = rows.length - 1; i >= 0; i--) {
    total += rowSize(rows[i])
    if (total > maxChars) break
    start = i
  }
  while (start < rows.length && rows[start].role !== 'USER') start++
  return rows.slice(start)
}

export function storedToolCalls(value: unknown): AiToolCall[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (call): call is AiToolCall =>
      !!call &&
      typeof call === 'object' &&
      typeof (call as AiToolCall).id === 'string' &&
      typeof (call as AiToolCall).name === 'string',
  )
}

function storedRaw(value: unknown): AiAssistantMessage['raw'] {
  if (value && typeof value === 'object' && 'provider' in value) {
    const raw = value as { provider: unknown; content: unknown }
    if (raw.provider === 'openai' || raw.provider === 'anthropic') {
      return { provider: raw.provider as AiProviderId, content: raw.content }
    }
  }
  return undefined
}

function decisionNote(row: AiMessageRow): string {
  const content =
    row.content.length > DECISION_NOTE_MAX_CHARS
      ? `${row.content.slice(0, DECISION_NOTE_MAX_CHARS)}…`
      : row.content
  return `[Atualização do sistema sobre a ação proposta "${row.toolName ?? ''}"] ${content}`
}

const INTERRUPTED = serializeToolResult({
  status: 'error',
  error: { code: 'INTERRUPTED', message: 'Execução interrompida' },
})

/**
 * Converts rows to provider messages and appends the new user message.
 * - Decision rows (`action:<id>`, appended after a confirm/cancel) are not
 *   tool results the provider knows about: they become a system note
 *   prefixed to the next user message.
 * - A tool call without a result row (interrupted turn) gets a synthetic
 *   error result, since both providers reject unanswered calls.
 */
export function toProviderHistory(
  rows: AiMessageRow[],
  newUserContent: string,
): AiMessage[] {
  const out: AiMessage[] = []
  let notes: string[] = []
  let unanswered = new Map<string, string>()

  const flushUnanswered = () => {
    for (const [id, name] of unanswered) {
      out.push({ role: 'tool', toolCallId: id, name, content: INTERRUPTED })
    }
    unanswered = new Map()
  }
  const userMessage = (content: string): AiMessage => {
    const text =
      notes.length > 0 ? `${notes.join('\n')}\n\n${content}` : content
    notes = []
    return { role: 'user', content: text }
  }

  for (const row of rows) {
    if (row.role === 'TOOL') {
      if (row.toolCallId?.startsWith(ACTION_RESULT_PREFIX)) {
        notes.push(decisionNote(row))
      } else if (row.toolCallId && unanswered.has(row.toolCallId)) {
        out.push({
          role: 'tool',
          toolCallId: row.toolCallId,
          name: unanswered.get(row.toolCallId) as string,
          content: row.content,
        })
        unanswered.delete(row.toolCallId)
      }
      continue
    }

    flushUnanswered()
    if (row.role === 'USER') {
      out.push(userMessage(row.content))
      continue
    }

    const calls = storedToolCalls(row.toolCalls)
    const raw = storedRaw(row.raw)
    out.push({
      role: 'assistant',
      content: row.content,
      ...(calls.length > 0 && { toolCalls: calls }),
      ...(raw && { raw }),
    })
    unanswered = new Map(calls.map((call) => [call.id, call.name]))
  }
  flushUnanswered()
  out.push(userMessage(newUserContent))
  return out
}
