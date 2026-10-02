import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs das integrações do ServiceDesk (`types/sd-integration.d.ts`). O token
 * do app e o segredo do webhook **não existem** nestes schemas: só o
 * indicador `hasWebhookSecret`.
 */

const dateTime = () => z.iso.datetime()

const Kind = z.enum(['SLACK', 'GITHUB'])
const Status = z.enum(['ACTIVE', 'ERROR', 'DISCONNECTED'])
const LinkKind = z.enum(['SLACK_THREAD', 'GITHUB_ISSUE', 'GITHUB_PULL_REQUEST'])
const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])

const SlackChannelMap = z.object({
  departmentId: z.string().nullable().meta({
    description: 'Departamento do ServiceDesk; `null` é o canal padrão.',
  }),
  channelId: z.string().meta({ example: 'C024BE91L' }),
  channelName: z.string().nullable().meta({ example: 'suporte-n1' }),
})

const SlackConfig = z.object({
  channels: z.array(SlackChannelMap).meta({
    description:
      'Canal por time. O evento vai ao canal do departamento do chamado; sem canal do time, ao canal padrão.',
  }),
  events: z.array(z.string()).meta({
    description:
      'Chaves do catálogo de notificações (`SD_NOTIFICATION_EVENTS`) enviadas ao canal.',
    example: ['ticket.created_in_department', 'sla.breached'],
  }),
  allowTicketFromMessage: z.boolean().meta({
    description: 'Atalho de mensagem / slash command abrem chamado.',
  }),
  mirrorThreadReplies: z.boolean().meta({
    description:
      'Resposta na thread do chamado vira mensagem pública no histórico.',
  }),
  ticketType: TicketType,
  departmentId: z.string().nullable(),
})

const GithubConfig = z.object({
  suggestPhaseOnClose: z.boolean().meta({
    description:
      'Fechar/mesclar o item **sugere** a mudança de fase (registra evento e mensagem); quem move a fase é o agente.',
  }),
  allowIssueFromTicket: z.boolean(),
})

export const SdIntegrationDTO = dto(
  'SdIntegration',
  z.object({
    id: z.string(),
    kind: Kind,
    status: Status,
    statusError: z.string().nullable().meta({
      description: 'Último motivo recusado pelo serviço externo.',
    }),
    externalId: z.string().meta({
      description:
        'Workspace do Slack (`T…`) ou `owner/repo` no GitHub — é por aqui que o webhook acha o workspace.',
      example: 'stratus-so2/steel',
    }),
    externalName: z.string().nullable(),
    hasWebhookSecret: z.boolean().meta({
      description:
        'Existe segredo de assinatura guardado. O valor **nunca** volta, nem mascarado.',
    }),
    slack: SlackConfig.nullable(),
    github: GithubConfig.nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdIntegrationsOverviewDTO = dto(
  'SdIntegrationsOverview',
  z.object({
    slackConfigured: z.boolean().meta({
      description:
        'O app do Slack tem credenciais neste servidor (`SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`). `false` deixa a integração inerte.',
    }),
    slackEventsUrl: z.string().nullable().meta({
      description:
        'URL a cadastrar em Event Subscriptions e Interactivity & Shortcuts do app do Slack.',
    }),
    githubWebhookUrl: z.string().meta({
      description: 'URL a cadastrar no webhook do repositório do GitHub.',
    }),
    slack: SdIntegrationDTO.nullable(),
    github: SdIntegrationDTO.nullable(),
  }),
)

export const SdIntegrationLinkDTO = dto(
  'SdIntegrationLink',
  z.object({
    id: z.string(),
    integrationId: z.string(),
    kind: LinkKind,
    ticketId: z.string(),
    externalKey: z.string().meta({
      description: '`canal:ts` (thread do Slack) ou `owner/repo#numero`.',
      example: 'stratus-so2/steel#42',
    }),
    externalUrl: z.string().nullable(),
    externalState: z.string().nullable().meta({
      description: '`open`, `closed` ou `merged`; `null` na thread do Slack.',
    }),
    externalStateLabel: z.string().nullable().meta({ example: 'Mesclada' }),
    title: z.string().nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdSlackChannelOptionDTO = dto(
  'SdSlackChannelOption',
  z.object({
    id: z.string().meta({ example: 'C024BE91L' }),
    name: z.string().meta({ example: 'suporte-n1' }),
    isPrivate: z.boolean(),
  }),
)

export const SdSlackInboundDTO = dto(
  'SdSlackInbound',
  z.object({
    outcome: z.enum([
      'challenge',
      'ticket_created',
      'message_mirrored',
      'duplicate',
      'ignored',
    ]),
    ticketCode: z.string().nullable(),
  }),
)

export const SdGithubWebhookDTO = dto(
  'SdGithubWebhook',
  z.object({
    outcome: z.enum(['state_updated', 'duplicate', 'ignored', 'unlinked']),
    state: z.enum(['open', 'closed', 'merged']).nullable(),
  }),
)

/** Corpo do webhook do Slack (eventos ou formulário de atalho/comando). */
export const SdSlackWebhookPayload = z
  .object({
    type: z.string().optional().meta({ example: 'event_callback' }),
    challenge: z.string().optional(),
    team_id: z.string().optional(),
    event_id: z.string().optional(),
    event: z.record(z.string(), z.unknown()).optional(),
  })
  .meta({
    id: 'SdSlackWebhookPayload',
    description:
      'Envelope de eventos do Slack. Atalho de mensagem e slash command chegam como `application/x-www-form-urlencoded` (`payload=<json>` ou os campos do comando) no mesmo endereço.',
  })

/** Corpo do webhook do GitHub (recorte usado). */
export const SdGithubWebhookPayload = z
  .object({
    action: z.string().optional().meta({ example: 'closed' }),
    repository: z
      .object({ full_name: z.string().optional() })
      .optional()
      .meta({ description: 'Usado só para achar a integração e o segredo.' }),
    issue: z.record(z.string(), z.unknown()).optional(),
    pull_request: z.record(z.string(), z.unknown()).optional(),
  })
  .meta({
    id: 'SdGithubWebhookPayload',
    description:
      'Payload de `issues` e `pull_request`. Chaves desconhecidas são ignoradas.',
  })
