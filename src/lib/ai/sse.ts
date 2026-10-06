import type { SteelAiStreamEvent } from '@/types/steel-ai'

/** One SSE frame: `event: <type>\ndata: <json>\n\n`. */
export function encodeSseEvent(event: SteelAiStreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
}

/**
 * Turns the chat service's event iterable into a `text/event-stream`
 * response. The iterable is drained to the end even if the client goes
 * away, so the turn is still persisted and its usage recorded; frames are
 * simply no longer enqueued once the stream is closed.
 */
export function steelAiSseResponse(
  events: AsyncIterable<SteelAiStreamEvent>,
  onError?: (cause: unknown) => void,
): Response {
  const encoder = new TextEncoder()
  let open = true

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: SteelAiStreamEvent) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(encodeSseEvent(event)))
        } catch {
          open = false
        }
      }
      try {
        for await (const event of events) send(event)
      } catch (cause) {
        onError?.(cause)
        send({
          type: 'error',
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Não foi possível concluir a resposta. Tente novamente.',
        })
      }
      if (open) {
        open = false
        controller.close()
      }
    },
    cancel() {
      open = false
    },
  })

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Disables proxy buffering (nginx) so deltas reach the browser live.
      'X-Accel-Buffering': 'no',
    },
  })
}
