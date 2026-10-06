/**
 * Shape of a TOOL row's `content` (the JSON the model reads back). Kept in a
 * dependency-free module so mappers can parse it without importing the tool
 * registry (which pulls every domain service).
 *
 * - `done`: the tool ran (`data` truncated to ~20 KB);
 * - `error`: parsing/permission/execution failed (`error.message` in pt-BR);
 * - `pending_confirmation`: a write became an AiPendingAction;
 * - `executed` / `failed` / `canceled`: the human decision on that action,
 *   appended later under the tool call id `action:<actionId>`.
 */
export type ToolResultStatus =
  | 'done'
  | 'error'
  | 'pending_confirmation'
  | 'executed'
  | 'failed'
  | 'canceled'

export interface ToolResultPayload {
  status: ToolResultStatus
  summary?: string
  data?: unknown
  error?: { code: string; message: string }
  actionId?: string
  /** Instruction for the model (pending/decision rows). */
  note?: string
}

/** Max size of the JSON returned to the model for a single tool call. */
export const TOOL_OUTPUT_MAX_BYTES = 20_000

/** Prefix of the synthetic tool call id used for decision rows. */
export const ACTION_RESULT_PREFIX = 'action:'

export function actionResultCallId(actionId: string): string {
  return `${ACTION_RESULT_PREFIX}${actionId}`
}

const TRUNCATED_NOTE =
  'Resultado truncado por tamanho. Refine a consulta (filtros ou limit menor) se precisar do restante.'

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8')
}

/**
 * Serializes a payload, shrinking `data` when the JSON would exceed
 * `maxBytes`: the data is replaced by a truncated JSON string plus a flag
 * telling the model to narrow the query (filters / smaller `limit`).
 */
export function serializeToolResult(
  payload: ToolResultPayload,
  maxBytes: number = TOOL_OUTPUT_MAX_BYTES,
): string {
  const full = JSON.stringify(payload)
  if (byteLength(full) <= maxBytes || payload.data === undefined) return full

  const { data, ...rest } = payload
  let text = JSON.stringify(data)
  // Cut the data by characters until the whole JSON (escapes included)
  // fits the UTF-8 budget.
  for (;;) {
    const out = JSON.stringify({
      ...rest,
      truncated: true,
      note: rest.note ? `${rest.note} ${TRUNCATED_NOTE}` : TRUNCATED_NOTE,
      data: `${text}…`,
    })
    if (byteLength(out) <= maxBytes || text.length === 0) return out
    text = text.slice(0, Math.floor(text.length * 0.9))
  }
}

/** Lenient parse of a TOOL row; unknown content becomes `done`. */
export function parseToolResult(content: string): ToolResultPayload {
  try {
    const parsed = JSON.parse(content)
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.status === 'string'
    ) {
      return parsed as ToolResultPayload
    }
  } catch {
    // Not JSON — legacy/plain text tool output.
  }
  return { status: 'done' }
}
