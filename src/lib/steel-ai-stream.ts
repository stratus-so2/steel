import type {
  AiPendingActionDTO,
  AiToolCallDTO,
  SteelAiStreamEvent,
} from '@/types/steel-ai'

/**
 * Incremental reader of the Steel AI `text/event-stream`. Bytes arrive in
 * arbitrary chunks, so lines are buffered until a blank line closes the
 * event. Each event carries one JSON object in its `data:` line(s); the
 * `event:` field is only a fallback for the `type` when the JSON omits it.
 * Comments (`:`), unknown fields and malformed JSON are ignored.
 */
export function createSteelAiSseParser(
  onEvent: (event: SteelAiStreamEvent) => void,
) {
  let buffer = ''
  let eventName: string | null = null
  let dataLines: string[] = []

  function dispatch() {
    if (dataLines.length === 0) {
      eventName = null
      return
    }
    const raw = dataLines.join('\n')
    const name = eventName
    dataLines = []
    eventName = null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return
    const record = parsed as Record<string, unknown>
    if (typeof record.type !== 'string') {
      if (!name) return
      record.type = name
    }
    onEvent(record as SteelAiStreamEvent)
  }

  function processLine(line: string) {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return
    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)
    if (field === 'data') dataLines.push(value)
    else if (field === 'event') eventName = value
  }

  return {
    push(chunk: string) {
      buffer += chunk
      let newline = buffer.search(/\r\n|\r|\n/)
      while (newline !== -1) {
        const line = buffer.slice(0, newline)
        const breakLength = buffer.startsWith('\r\n', newline) ? 2 : 1
        // A lone `\r` at the end of the buffer may be the first half of a
        // `\r\n` split across chunks: wait for the next chunk.
        if (buffer[newline] === '\r' && newline === buffer.length - 1) break
        buffer = buffer.slice(newline + breakLength)
        processLine(line)
        newline = buffer.search(/\r\n|\r|\n/)
      }
    },
    /** Closes the stream: a trailing event without a blank line still counts. */
    flush() {
      if (buffer.length > 0) {
        const rest = buffer.replace(/\r$/, '')
        buffer = ''
        processLine(rest)
      }
      dispatch()
    },
  }
}

/** Reads a whole SSE body, calling `onEvent` for every event in order. */
export async function readSteelAiStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SteelAiStreamEvent) => void,
): Promise<void> {
  const parser = createSteelAiSseParser(onEvent)
  const reader = body.getReader()
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      parser.push(decoder.decode(value, { stream: true }))
    }
    parser.push(decoder.decode())
    parser.flush()
  } finally {
    reader.releaseLock()
  }
}

/** The assistant reply being streamed, before it is persisted and refetched. */
export interface SteelAiLiveMessage {
  id: string | null
  content: string
  toolCalls: AiToolCallDTO[]
  pendingActions: AiPendingActionDTO[]
  status: 'streaming' | 'done' | 'error' | 'stopped'
  error: { code: string; message: string } | null
}

export function emptySteelAiLiveMessage(): SteelAiLiveMessage {
  return {
    id: null,
    content: '',
    toolCalls: [],
    pendingActions: [],
    status: 'streaming',
    error: null,
  }
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id)
  if (index === -1) return [...list, item]
  const next = list.slice()
  next[index] = item
  return next
}

/** Pure reducer: folds one stream event into the live assistant message. */
export function applySteelAiStreamEvent(
  state: SteelAiLiveMessage,
  event: SteelAiStreamEvent,
): SteelAiLiveMessage {
  switch (event.type) {
    case 'message.start':
      return { ...state, id: event.messageId }
    case 'text.delta':
      return { ...state, content: state.content + event.delta }
    case 'tool.start':
    case 'tool.end':
      return { ...state, toolCalls: upsertById(state.toolCalls, event.call) }
    case 'action.pending':
    case 'action.executed':
      return {
        ...state,
        pendingActions: upsertById(state.pendingActions, event.action),
      }
    case 'message.end':
      return {
        ...state,
        id: event.message.id,
        content: event.message.content,
        // The persisted message wins, but nothing seen live is dropped.
        toolCalls: event.message.toolCalls.reduce(
          (list, call) => upsertById(list, call),
          state.toolCalls,
        ),
        pendingActions: event.message.pendingActions.reduce(
          (list, action) => upsertById(list, action),
          state.pendingActions,
        ),
        status: 'done',
      }
    case 'error':
      return {
        ...state,
        status: 'error',
        error: { code: event.code, message: event.message },
      }
    default:
      return state
  }
}
