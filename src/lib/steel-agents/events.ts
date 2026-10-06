import type { ModuleKind } from '@prisma/client'

/**
 * Domain events a Steel Agent can be triggered by (`triggerType = EVENT`).
 * Pure catalog shared by the schema, the dispatcher and the editor UI. A new
 * event needs an entry here plus a `dispatchSteelAgentEvent` call at the
 * point where it happens.
 */
export const STEEL_AGENT_EVENTS = [
  {
    key: 'sd.ticket.created',
    module: 'SERVICE_DESK',
    label: 'Chamado aberto',
    description: 'Quando um chamado é aberto no ServiceDesk.',
  },
  {
    key: 'crm.lead.created',
    module: 'CRM',
    label: 'Lead criado',
    description: 'Quando um lead entra no CRM (manual, formulário ou API).',
  },
  {
    key: 'zap.conversation.assigned',
    module: 'COMMUNICATION',
    label: 'Conversa atribuída',
    description: 'Quando uma conversa do WhatsApp é atribuída a um atendente.',
  },
  {
    key: 'zap.ai.handoff',
    module: 'COMMUNICATION',
    label: 'IA transferiu a conversa',
    description:
      'Quando a IA do WhatsApp transfere a conversa para um atendente.',
  },
] as const satisfies readonly {
  key: string
  module: ModuleKind
  label: string
  description: string
}[]

export type SteelAgentEventKey = (typeof STEEL_AGENT_EVENTS)[number]['key']

export const STEEL_AGENT_EVENT_KEYS = STEEL_AGENT_EVENTS.map(
  (event) => event.key,
) as [SteelAgentEventKey, ...SteelAgentEventKey[]]

export function steelAgentEvent(key: string) {
  return STEEL_AGENT_EVENTS.find((event) => event.key === key)
}
