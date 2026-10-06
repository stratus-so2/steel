/**
 * Public contract of the Steel AI assistant (API + SSE stream). Shared by
 * the backend, the `/ai` chat screen and, later, Steel Agents.
 */

export type AiConversationModeDTO = 'EXPLORE' | 'AGENT'

export type AiMessageRoleDTO = 'USER' | 'ASSISTANT' | 'TOOL'

export type AiActionKindDTO = 'CREATE' | 'UPDATE' | 'DELETE' | 'ACTION'

export type AiPendingActionStatusDTO =
  | 'PENDING'
  | 'EXECUTED'
  | 'FAILED'
  | 'CANCELED'
  | 'EXPIRED'

export type AiModuleDTO = 'SERVICE_DESK' | 'CRM' | 'COMMUNICATION'

export interface AiConversationDTO {
  id: string
  title: string | null
  mode: AiConversationModeDTO
  modelKey: string | null
  pinnedAt: string | null
  createdAt: string
  updatedAt: string
}

/** A tool call as shown in the transcript (never the raw provider payload). */
export interface AiToolCallDTO {
  id: string
  name: string
  /** pt-BR label of the tool, e.g. "Consultando chamados". */
  label: string
  module: AiModuleDTO | null
  status: 'running' | 'done' | 'error' | 'pending_confirmation'
  /** Short pt-BR summary of the result, when finished. */
  summary?: string
}

export interface AiMessageDTO {
  id: string
  conversationId: string
  /** TOOL rows are folded into the assistant message's `toolCalls`. */
  role: Exclude<AiMessageRoleDTO, 'TOOL'>
  content: string
  toolCalls: AiToolCallDTO[]
  pendingActions: AiPendingActionDTO[]
  createdAt: string
}

/** What the user sees before confirming a write. */
export interface AiToolPreviewDTO {
  /** pt-BR, e.g. "Excluir a oportunidade “Contrato Acme”". */
  title: string
  summary: string
  fields?: { label: string; before?: string | null; after?: string | null }[]
  target?: { type: string; id?: string; label: string; href?: string }
}

export interface AiPendingActionDTO {
  id: string
  conversationId: string | null
  agentRunId: string | null
  toolName: string
  kind: AiActionKindDTO
  module: AiModuleDTO | null
  preview: AiToolPreviewDTO
  status: AiPendingActionStatusDTO
  requiresDoubleConfirm: boolean
  /** pt-BR outcome after execution (or the failure message). */
  resultSummary: string | null
  error: string | null
  expiresAt: string
  decidedAt: string | null
  executedAt: string | null
  createdAt: string
}

/**
 * Server-sent events of `POST .../ai/conversations/:id/messages`
 * (`text/event-stream`, one JSON object per `data:` line, event name = `type`).
 */
export type SteelAiStreamEvent =
  | { type: 'message.start'; conversationId: string; messageId: string }
  | { type: 'text.delta'; delta: string }
  | { type: 'tool.start'; call: AiToolCallDTO }
  | { type: 'tool.end'; call: AiToolCallDTO }
  | { type: 'action.pending'; action: AiPendingActionDTO }
  | { type: 'conversation.title'; title: string }
  | {
      type: 'message.end'
      message: AiMessageDTO
      usage: { inputTokens: number; outputTokens: number }
    }
  | { type: 'error'; code: string; message: string }

/** `GET .../ai/capabilities` — what the chat screen may offer this user. */
export interface AiCapabilitiesDTO {
  /** Workspace kill switch for the agent mode (write tools). */
  agentModeEnabled: boolean
  /** Modules enabled in the workspace (the tools the assistant can reach). */
  modules: AiModuleDTO[]
  /** Model the next turn will use ("<provider>:<model>"), or null if none. */
  modelKey: string | null
  quota: { usedUsd: number; quotaUsd: number }
}

/** One write executed by AI (assistant confirm or agent run). */
export interface AiActionLogDTO {
  id: string
  source: 'ASSISTANT' | 'AGENT'
  actorId: string | null
  agentId: string | null
  pendingActionId: string | null
  toolName: string
  kind: AiActionKindDTO
  module: AiModuleDTO | null
  targetType: string | null
  targetId: string | null
  outcome: 'success' | 'failure'
  /** pt-BR summary of what the tool did (null on failure). */
  summary: string | null
  error: string | null
  createdAt: string
}
