import type { ReactElement } from 'react'
import { renderWithQuery } from '@/src/__tests__/component-utils'
import type { SteelAiCapabilitiesDTO } from '@/src/hooks/use-steel-ai'
import type {
  AiConversationDTO,
  AiPendingActionDTO,
  SteelAiStreamEvent,
} from '@/types/steel-ai'
import { SteelAiProvider } from '../steel-ai-context'

export const WS = 'ws_1'
export const SLUG = 'acme'

export function renderSteelAi(ui: ReactElement) {
  return renderWithQuery(
    <SteelAiProvider value={{ workspaceId: WS, slug: SLUG, firstName: 'Ana' }}>
      {ui}
    </SteelAiProvider>,
  )
}

export function capabilities(
  over: Partial<SteelAiCapabilitiesDTO> = {},
): SteelAiCapabilitiesDTO {
  return {
    aiEnabled: true,
    agentModeEnabled: true,
    autopilotEnabled: false,
    modules: ['SERVICE_DESK', 'CRM', 'COMMUNICATION'],
    modelKey: 'openai:gpt-4o-mini',
    models: [
      {
        key: 'openai:gpt-4o-mini',
        provider: 'openai',
        providerLabel: 'OpenAI',
        label: 'GPT-4o mini',
        inputUsdPer1M: 0.15,
        outputUsdPer1M: 0.6,
      },
      {
        key: 'anthropic:claude-sonnet-5',
        provider: 'anthropic',
        providerLabel: 'Anthropic (Claude)',
        label: 'Claude Sonnet 5',
        inputUsdPer1M: 2,
        outputUsdPer1M: 10,
      },
    ],
    attachments: {
      maxPerMessage: 5,
      maxImageBytes: 5 * 1024 * 1024,
      maxDocumentBytes: 10 * 1024 * 1024,
      accept: ['image/png', 'application/pdf'],
    },
    quota: { usedUsd: 1, quotaUsd: 50 },
    ...over,
  }
}

export function conversation(
  over: Partial<AiConversationDTO> = {},
): AiConversationDTO {
  return {
    id: 'c1',
    title: null,
    mode: 'EXPLORE',
    modelKey: null,
    pinnedAt: null,
    createdAt: '2026-10-06T12:00:00.000Z',
    updatedAt: '2026-10-06T12:00:00.000Z',
    ...over,
  }
}

export function pendingAction(
  over: Partial<AiPendingActionDTO> = {},
): AiPendingActionDTO {
  return {
    id: 'act_1',
    conversationId: 'c1',
    agentRunId: null,
    toolName: 'crm.update_opportunity',
    kind: 'UPDATE',
    module: 'CRM',
    preview: {
      title: 'Alterar a oportunidade “Contrato Acme”',
      summary: 'Move a oportunidade para Negociação.',
      fields: [{ label: 'Estágio', before: 'Proposta', after: 'Negociação' }],
      target: {
        type: 'crm_opportunity',
        id: 'op_1',
        label: 'Contrato Acme',
        href: '/acme/crm/opportunities/op_1',
      },
    },
    status: 'PENDING',
    requiresDoubleConfirm: false,
    autoExecuted: false,
    resultSummary: null,
    error: null,
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    decidedAt: null,
    executedAt: null,
    createdAt: '2026-10-06T12:00:00.000Z',
    ...over,
  }
}

/** A `text/event-stream` response that emits the given events. */
export function sseResponse(events: SteelAiStreamEvent[]): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) {
        controller.enqueue(
          encoder.encode(
            `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
          ),
        )
      }
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/event-stream' },
  })
}
