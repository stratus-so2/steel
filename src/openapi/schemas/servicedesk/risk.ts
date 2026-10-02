import { z } from 'zod'
import { dto } from '../../common'
import { SdUserSummaryDTO } from '../servicedesk-tickets'

/**
 * DTOs dos agrupamentos de incidentes (`types/sd-risk.d.ts`). A previsão de
 * risco de um chamado é o `SdTicketRisk`, declarado junto do `SdTicket` em
 * `../servicedesk-tickets.ts` — o selo viaja dentro do chamado.
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const PhaseCategory = z.enum([
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
])

const ClusterTicket = z.object({
  id: z.string(),
  number: z.number().int().meta({ example: 123 }),
  code: z.string().meta({ example: 'INC-000123' }),
  title: z.string(),
  phase: z.object({
    name: z.string(),
    color: z.string().nullable(),
    category: PhaseCategory,
  }),
  priority: z
    .object({
      id: z.string(),
      name: z.string(),
      color: z.string().nullable(),
    })
    .nullable(),
  createdAt: dateTime(),
})

export const SdIncidentClusterDTO = dto(
  'SdIncidentCluster',
  z.object({
    id: z.string(),
    signature: z.string().meta({
      example: 'cat1:sub2:srv3:email-fora-servidor',
      description:
        'Chave do agrupamento: categoria, subcategoria, serviço e os termos normalizados do título.',
    }),
    title: z.string().meta({ example: 'Servidor de e-mail fora do ar' }),
    ticketCount: z.number().int().meta({ example: 4 }),
    firstSeenAt: dateTime(),
    lastSeenAt: dateTime(),
    tickets: z
      .array(ClusterTicket)
      .meta({ description: 'Os incidentes do grupo (mais recentes antes).' }),
    problemTicket: z
      .object({
        id: z.string(),
        number: z.number().int(),
        code: z.string().meta({ example: 'PRB-000007' }),
        title: z.string(),
        type: TicketType,
      })
      .nullable()
      .meta({ description: 'Problema aberto a partir do grupo, se houve.' }),
    dismissedAt: nullableDateTime(),
    dismissedBy: SdUserSummaryDTO.nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)
