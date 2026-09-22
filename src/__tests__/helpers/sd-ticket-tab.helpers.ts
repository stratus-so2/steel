import { createFakeSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'
import type { SdAccessContext } from '@/src/services/sd-access'
import { sdUserActor } from '@/src/services/sd-ticket-engine'
import type { SdTicketTabScope } from '@/src/services/sd-ticket-tab-support'

/**
 * Escopo pronto de `loadSdTicketTab` para os testes unitários dos services
 * das abas do chamado (que mockam `sd-ticket-tab-support`).
 */
export function sdTabScope(
  options: {
    userId?: string
    isAgent?: boolean
    ticket?: Partial<SdTicketWithRelations>
    settings?: Parameters<typeof createFakeSdSettings>[0]
  } = {},
): SdTicketTabScope {
  const userId = options.userId ?? 'u1'
  const isAgent = options.isAgent ?? true
  const ctx: SdAccessContext = {
    role: 'MEMBER',
    isPrivileged: false,
    permissions: null,
    userId,
    isAdmin: false,
    isAgent,
    departmentIds: isAgent ? ['d1'] : [],
    leadDepartmentIds: [],
  }
  const ticket = createFakeSdTicket({
    id: 't1',
    number: 7,
    requesterId: 'req',
    ...options.ticket,
  })
  return {
    ctx,
    config: {
      settings: createFakeSdSettings(options.settings),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    },
    ticket,
    actor: sdUserActor(ctx),
    code: 'INC-000007',
  }
}
