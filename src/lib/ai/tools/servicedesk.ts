import { SD_DIRECTORY_TOOLS } from './servicedesk/directory'
import { SD_KNOWLEDGE_TOOLS } from './servicedesk/knowledge'
import { SD_TICKET_WORK_TOOLS } from './servicedesk/ticket-work'
import { SD_TICKET_READ_TOOLS } from './servicedesk/tickets-read'
import { SD_TICKET_WRITE_TOOLS } from './servicedesk/tickets-write'
import type { AnySteelAiTool } from './types'

/**
 * Steel AI tools for ServiceDesk (`sd_*`). Every tool calls the SD services
 * with the caller's id, so `SdAccess` (agent × requester, RBAC `sd-*`,
 * module enabled) stays the authority; tickets go through `SdTicketEngine`
 * as the user. Tickets are never deleted here — canceling is an ACTION.
 */
export const SERVICEDESK_AI_TOOLS: AnySteelAiTool[] = [
  ...SD_TICKET_READ_TOOLS,
  ...SD_DIRECTORY_TOOLS,
  ...SD_KNOWLEDGE_TOOLS,
  ...SD_TICKET_WRITE_TOOLS,
  ...SD_TICKET_WORK_TOOLS,
]
