import { z } from 'zod'
import { SdConditionSchema } from '@/src/schemas/sd-rule.schema'
import { dto } from '../../common'
import { SdUserSummaryDTO as SdUserSummary } from '../servicedesk-tickets'

/**
 * DTOs do calendário de mudanças e do comitê (CAB) — `types/sd-change.d.ts` e
 * `types/sd-cab.d.ts`.
 */

const WindowKind = z.enum(['MAINTENANCE', 'FREEZE']).meta({
  description:
    '`MAINTENANCE` = quando pode mexer; `FREEZE` = quando não pode (vira aviso de congelamento ao agendar).',
})

const Recurrence = z
  .object({
    freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    interval: z.number().int().meta({ example: 1 }),
    byDay: z.array(z.string()).meta({
      description: 'Só em `WEEKLY` (`mon`…`sun`); vazio = o dia do início.',
      example: ['sat'],
    }),
    until: z.string().nullable().meta({
      description: 'Data final inclusiva (AAAA-MM-DD).',
      example: '2026-12-31',
    }),
    count: z.number().int().nullable().meta({
      description: 'Número máximo de ocorrências (`null` = série aberta).',
    }),
  })
  .meta({
    description:
      'RRULE simplificada. A expansão em ocorrências é feita no servidor (`src/lib/servicedesk/change-calendar.ts`).',
  })

export const SdChangeWindowDTO = dto(
  'SdChangeWindow',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Janela de manutenção · sábados' }),
    kind: WindowKind,
    startsAt: z.string(),
    endsAt: z.string(),
    recurrence: Recurrence.nullable(),
    timezone: z.string().meta({ example: 'America/Sao_Paulo' }),
    configItemIds: z.array(z.string()).meta({
      description: 'Itens de configuração alvo; vazio = toda a workspace.',
    }),
    departmentIds: z.array(z.string()).meta({
      description: 'Departamentos alvo; vazio = todos.',
    }),
    description: z.string().nullable(),
    createdBy: SdUserSummary.nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
)

export const SdChangeWindowListDTO = dto(
  'SdChangeWindowList',
  z.array(SdChangeWindowDTO),
)

const SdChangeWindowOccurrence = z.object({
  windowId: z.string(),
  name: z.string(),
  kind: WindowKind,
  startsAt: z.string(),
  endsAt: z.string(),
  timezone: z.string(),
  configItemIds: z.array(z.string()),
  departmentIds: z.array(z.string()),
  description: z.string().nullable(),
  recurring: z.boolean().meta({
    description: '`true` quando vem de uma repetição, não da janela original.',
  }),
})

const SdChangeCalendarEntry = z.object({
  ticketId: z.string(),
  number: z.number().int(),
  code: z.string().meta({ example: 'CHG-000042' }),
  title: z.string(),
  type: z.string().meta({ example: 'CHANGE' }),
  plannedStartAt: z.string(),
  plannedEndAt: z.string(),
  phaseName: z.string(),
  phaseCategory: z.string(),
  changeType: z.string().nullable(),
  changeRisk: z.string().nullable(),
  configItemId: z.string().nullable(),
  configItemName: z.string().nullable(),
  departmentId: z.string().nullable(),
  assignee: SdUserSummary.nullable(),
  conflictTicketIds: z.array(z.string()).meta({
    description: 'Outras mudanças que disputam o mesmo item de configuração.',
  }),
  frozenWindowIds: z.array(z.string()).meta({
    description: 'Janelas FREEZE que cobrem o período planejado.',
  }),
})

export const SdChangeCalendarDTO = dto(
  'SdChangeCalendar',
  z.object({
    from: z.string(),
    to: z.string(),
    windows: z.array(SdChangeWindowOccurrence).meta({
      description:
        'Ocorrências já expandidas das janelas — as faixas de fundo do calendário.',
    }),
    changes: z.array(SdChangeCalendarEntry),
  }),
)

const SdChangeWarning = z.object({
  kind: z.enum(['FREEZE', 'CONFLICT']),
  message: z.string(),
  windowId: z.string().nullable(),
  windowName: z.string().nullable(),
  ticketId: z.string().nullable(),
  ticketNumber: z.number().int().nullable(),
  ticketTitle: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string(),
})

export const SdTicketChangeScheduleDTO = dto(
  'SdTicketChangeSchedule',
  z.object({
    ticketId: z.string(),
    plannedStartAt: z.string().nullable(),
    plannedEndAt: z.string().nullable(),
    configItemId: z.string().nullable(),
    configItemName: z.string().nullable(),
    windows: z.array(SdChangeWindowOccurrence),
    warnings: z.array(SdChangeWarning).meta({
      description:
        'Avisos, não bloqueios: um admin pode agendar mesmo assim com `confirmChangeSchedule`.',
    }),
  }),
)

const SdCabMember = z.object({
  id: z.string(),
  userId: z.string(),
  user: SdUserSummary.nullable(),
  required: z.boolean().meta({
    description: 'Voto obrigatório: a rodada não fecha sem ele.',
  }),
})

export const SdCabBoardDTO = dto(
  'SdCabBoard',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'CAB de infraestrutura' }),
    description: z.string().nullable(),
    quorum: z.number().int().meta({
      description: 'Como está salvo (`0` = todos os membros).',
    }),
    effectiveQuorum: z.number().int().meta({
      description: 'Quantos votos de fato fecham a rodada hoje.',
    }),
    rejectEnds: z.boolean().meta({
      description: 'Uma reprovação encerra a rodada como reprovada.',
    }),
    conditions: z.array(SdConditionSchema).meta({
      description:
        'Condições do chamado que fazem este comitê ser o responsável (lista vazia = serve a qualquer mudança).',
    }),
    active: z.boolean(),
    position: z.number().int(),
    members: z.array(SdCabMember),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
)

export const SdCabBoardListDTO = dto('SdCabBoardList', z.array(SdCabBoardDTO))

const SdApprovalRoundTally = z.object({
  total: z.number().int(),
  approved: z.number().int(),
  rejected: z.number().int(),
  pending: z.number().int(),
  requiredPending: z.number().int().meta({
    description: 'Votos obrigatórios ainda pendentes.',
  }),
  remaining: z.number().int().meta({
    description: 'Quantas aprovações faltam para o quórum (`0` = atingido).',
  }),
})

const SdRoundApproval = z.object({
  id: z.string(),
  ticketId: z.string(),
  approverName: z.string().nullable(),
  approverEmail: z.string(),
  approver: SdUserSummary.nullable(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED']),
  message: z.string().nullable(),
  comment: z.string().nullable(),
  requestedBy: SdUserSummary.nullable(),
  roundId: z.string().nullable(),
  sentAt: z.string().nullable(),
  respondedAt: z.string().nullable(),
  expiresAt: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const SdApprovalRoundDTO = dto(
  'SdApprovalRound',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    boardId: z.string().nullable(),
    boardName: z.string().nullable(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELED', 'EXPIRED']),
    quorum: z.number().int().meta({
      description: 'Quórum aplicado na abertura (já resolvido: nunca `0`).',
    }),
    rejectEnds: z.boolean(),
    requestedBy: SdUserSummary.nullable(),
    decidedAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
    approvals: z.array(SdRoundApproval).meta({
      description: 'Um pedido por membro do comitê, com o voto de cada um.',
    }),
    tally: SdApprovalRoundTally,
  }),
)

export const SdApprovalRoundListDTO = dto(
  'SdApprovalRoundList',
  z.array(SdApprovalRoundDTO),
)
