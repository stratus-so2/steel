import { vi } from 'vitest'
import type { SdTicketDTO } from '@/types/sd-ticket'
import { ticketDTO, WS } from '../../ticket/__tests__/sd-ticket-tab-fixtures'

/** Fixtures das telas do portal do solicitante. */

export { ticketDTO, WS }
export const SLUG = 'acme'
export const API = `/api/workspaces/${WS}/servicedesk`

export function portalTicket(
  overrides: Partial<SdTicketDTO> = {},
): SdTicketDTO {
  return ticketDTO({
    channel: 'PORTAL',
    requester: {
      id: 'u-req',
      name: 'Rui Solicitante',
      email: 'rui@example.com',
      image: null,
    },
    ...overrides,
  })
}

/** Fase resolvida (libera CSAT e a reabertura). */
export const RESOLVED_PHASE = {
  id: 'p-done',
  name: 'Resolvido',
  color: null,
  category: 'RESOLVED' as const,
  completionPercent: 100,
  position: 4,
  wipLimit: 0,
}

/** Recorte do bootstrap de configuração usado pelo formulário do portal. */
export const PORTAL_CONFIG = {
  urgencies: [
    {
      id: 'urg-low',
      kind: 'urgency',
      name: 'Posso esperar',
      description: null,
      color: null,
      level: 1,
      isDefault: true,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'urg-high',
      kind: 'urgency',
      name: 'Preciso agora',
      description: null,
      color: null,
      level: 3,
      isDefault: false,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  categories: [
    {
      id: 'cat-1',
      parentId: null,
      level: 'CATEGORY',
      name: 'Acesso e senhas',
      description: null,
      icon: null,
      ticketTypes: [],
      departmentId: null,
      slaPolicyId: null,
      portalVisible: true,
      active: true,
      position: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      children: [
        {
          id: 'sub-1',
          parentId: 'cat-1',
          level: 'SUBCATEGORY',
          name: 'E-mail',
          description: null,
          icon: null,
          ticketTypes: [],
          departmentId: null,
          slaPolicyId: null,
          portalVisible: true,
          active: true,
          position: 0,
          createdAt: '2026-09-01T00:00:00.000Z',
          updatedAt: '2026-09-01T00:00:00.000Z',
          children: [],
        },
      ],
    },
    {
      id: 'cat-internal',
      parentId: null,
      level: 'CATEGORY',
      name: 'Interno de TI',
      description: null,
      icon: null,
      ticketTypes: [],
      departmentId: null,
      slaPolicyId: null,
      portalVisible: false,
      active: true,
      position: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
      children: [],
    },
  ],
  templates: [
    {
      id: 'tpl-1',
      ticketType: 'SERVICE_REQUEST',
      name: 'Pedir acesso a um sistema',
      description: null,
      defaults: { title: 'Pedido de acesso', urgencyId: 'urg-high' },
      tasks: [],
      portalVisible: true,
      active: true,
      position: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'tpl-hidden',
      ticketType: 'SERVICE_REQUEST',
      name: 'Modelo interno',
      description: null,
      defaults: {},
      tasks: [],
      portalVisible: false,
      active: true,
      position: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  customFields: [
    {
      id: 'cf-1',
      entity: 'TICKET',
      key: 'patrimonio',
      label: 'Número do patrimônio',
      description: null,
      type: 'TEXT',
      options: [],
      ticketTypes: [],
      categoryIds: [],
      required: false,
      visibleInPortal: true,
      defaultValue: null,
      active: true,
      position: 0,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
    {
      id: 'cf-2',
      entity: 'TICKET',
      key: 'custo',
      label: 'Centro de custo',
      description: null,
      type: 'TEXT',
      options: [],
      ticketTypes: [],
      categoryIds: [],
      required: false,
      visibleInPortal: false,
      defaultValue: null,
      active: true,
      position: 1,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: '2026-09-01T00:00:00.000Z',
    },
  ],
  cannedResponses: [],
}

export const REQUESTER_ME = {
  userId: 'u-req',
  isAgent: false,
  isAdmin: false,
  departmentIds: [],
  leadDepartmentIds: [],
}

/** `useSdTicketRealtime` abre um EventSource — jsdom não tem. */
export function stubPortalEventSource() {
  class FakeEventSource {
    onmessage: ((event: MessageEvent) => void) | null = null
    close() {}
  }
  vi.stubGlobal('EventSource', FakeEventSource)
}
