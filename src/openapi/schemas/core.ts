import { z } from 'zod'
import { FEATURE_KEYS } from '@/src/config/features'
import { BILLING_INTERVALS } from '@/src/config/plan-prices'
import { ProfileOutputSchema } from '@/src/schemas/profile.schema'
import { dto } from '../common'

/**
 * Schemas de resposta (DTOs) dos domínios base. Os DTOs só existem como
 * `interface` em `types/*.d.ts`; aqui ficam as versões Zod, usadas apenas
 * para a documentação. Mantenha-as alinhadas aos mappers.
 */

const id = (example: string) => z.string().meta({ example })
const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const ROLES = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const
const PLANS = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'] as const
const MODULES = ['SERVICE_DESK', 'CRM', 'COMMUNICATION'] as const

/* -------------------------------- usuário -------------------------------- */

export const MembershipDTO = dto(
  'Membership',
  z
    .object({
      workspaceId: id('ckv9x2p0h0000ws7d3k1e5abc'),
      slug: z.string().meta({ example: 'acme' }),
      name: z.string().meta({ example: 'ACME' }),
      role: z.enum(ROLES),
    })
    .meta({ description: 'Vínculo do usuário com um workspace.' }),
)

export const UserDTO = dto(
  'User',
  z
    .object({
      id: id('ckv9x2p0h0000us7d3k1e5abc'),
      name: z.string().meta({ example: 'Maria Souza' }),
      email: z.email().meta({ example: 'maria@acme.com.br' }),
      username: z.string().meta({ example: 'maria.souza' }),
      emailVerified: z.boolean(),
      image: z.string().nullable(),
      coverImage: z.string().nullable(),
      createdAt: dateTime(),
      deletionScheduledAt: nullableDateTime().meta({
        description: 'Preenchido quando a exclusão da conta está agendada.',
      }),
      acceptedTermsAt: nullableDateTime(),
      acceptedPrivacyAt: nullableDateTime(),
      onboardingStep: z
        .enum(['PROFILE', 'ROLE', 'BRINGS', 'WORKSPACE'])
        .nullable()
        .meta({ description: '`null` quando o onboarding foi concluído.' }),
      role: z
        .enum([
          'PRODUCT_MANAGER',
          'ENGINEERING_MANAGER',
          'DESIGNER',
          'DEVELOPER',
          'FOUNDER_EXECUTIVE',
          'OPERATIONS_MANAGER',
          'OTHER',
        ])
        .nullable(),
      goals: z.array(
        z.enum([
          'ROADMAP',
          'SPRINTS',
          'CROSS_FUNCTIONAL',
          'REPLACE_TOOL',
          'EXPLORING',
        ]),
      ),
      memberships: z.array(MembershipDTO),
    })
    .meta({ description: 'Perfil do usuário autenticado.' }),
)

export const UserPreferenceDTO = dto(
  'UserPreference',
  z.object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    smoothCursor: z.boolean(),
    quickSendShortcut: z.enum(['ENTER', 'CTRL_ENTER']),
    timezone: z
      .string()
      .meta({ description: 'Fuso IANA.', example: 'America/Sao_Paulo' }),
    weekStartsOn: z
      .number()
      .int()
      .min(0)
      .max(6)
      .meta({ description: '0 = domingo … 6 = sábado.' }),
    weekendDays: z
      .array(z.number().int().min(0).max(6))
      .meta({ example: [0, 6] }),
  }),
)

export const NotificationSettingDTO = dto(
  'NotificationSetting',
  z.object({
    priorityChanges: z.boolean(),
    stateChanges: z.boolean(),
    comments: z.boolean(),
    mentions: z.boolean(),
  }),
)

export const MediaUrlDTO = dto(
  'MediaUrl',
  z
    .object({
      url: z.string().meta({
        example:
          'https://homologacao.stratustelecom.com.br/media/avatars/users/abc/avatar.webp',
      }),
    })
    .meta({ description: 'URL pública do arquivo enviado.' }),
)

export const TotpStatusDTO = dto(
  'TotpStatus',
  z
    .object({
      twoFactorEnabled: z.boolean().meta({
        description:
          'Interruptor único do plugin two-factor do better-auth: vale para o OTP por e-mail e para o aplicativo autenticador.',
      }),
      totpEnabled: z.boolean().meta({
        description:
          'A conta escaneou o QR e confirmou um código que o aplicativo gerou.',
      }),
      hasSecret: z.boolean().meta({
        description:
          'Já existe segredo TOTP gravado para a conta (o enable() do plugin rodou).',
      }),
    })
    .meta({ description: 'Estado do segundo fator da conta da sessão.' }),
)

/* ------------------------------- workspaces ------------------------------ */

export const WorkspaceDTO = dto(
  'Workspace',
  z.object({
    id: id('ckv9x2p0h0000ws7d3k1e5abc'),
    name: z.string().meta({ example: 'ACME' }),
    slug: z.string().meta({ example: 'acme' }),
    activePlan: z.enum(PLANS),
    trialEndsAt: nullableDateTime(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const WorkspaceMemberDTO = dto(
  'WorkspaceMember',
  z.object({
    userId: z.string(),
    name: z.string(),
    email: z.email(),
    image: z.string().nullable(),
    role: z.enum(ROLES),
    profileId: z.string().nullable().meta({
      description: 'Perfil de acesso atribuído (`null` = padrão do papel).',
    }),
  }),
)

export const InvitationDTO = dto(
  'Invitation',
  z.object({
    id: z.string(),
    email: z.email(),
    role: z.enum(ROLES),
    status: z.enum(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED']),
    expiresAt: dateTime(),
    workspaceId: z.string(),
    projectId: z.string().nullable(),
    invitedById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const ProfileDTO = dto('Profile', ProfileOutputSchema)

export const WorkspaceConnectionDTO = dto(
  'WorkspaceConnection',
  z
    .object({
      id: z.string(),
      workspaceId: z.string(),
      module: z.enum(MODULES),
      host: z.string().meta({ example: 'db.cliente.com.br' }),
      port: z.number().int().meta({ example: 5432 }),
      username: z.string(),
      database: z.string(),
      sslEnabled: z.boolean(),
      createdById: z.string(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({
      description:
        'Conexão de um módulo com um Postgres externo. A senha nunca é devolvida (fica cifrada com `CONNECTION_SECRETS`).',
    }),
)

const AiProvider = z.enum(['openai', 'anthropic'])

export const WorkspaceAiSettingsDTO = dto(
  'WorkspaceAiSettings',
  z.object({
    workspaceId: z.string(),
    providers: z.array(
      z.object({
        id: AiProvider,
        label: z.string(),
        available: z.boolean().meta({
          description:
            '`false` quando a chave da plataforma não está configurada.',
        }),
      }),
    ),
    models: z.array(
      z.object({
        key: z.string(),
        provider: AiProvider,
        model: z.string(),
        label: z.string(),
        available: z.boolean(),
        enabled: z.boolean(),
      }),
    ),
    enabledModels: z.array(z.string()),
    crmAssistantModel: z.string(),
    whatsappReplyModel: z.string(),
    whatsappSentimentModel: z.string(),
    monthlyQuotaUsd: z.number(),
    usdPer1kTokens: z.number(),
    agentModeEnabled: z.boolean().meta({
      description:
        'Modo agente do Steel AI (ferramentas de escrita, sempre com confirmação). Desligado = só exploração.',
    }),
    usage: z.object({
      periodStart: dateTime().meta({ description: '1º dia do mês (UTC).' }),
      inputTokens: z.number().int(),
      outputTokens: z.number().int(),
      usedUsd: z.number(),
      remainingUsd: z.number(),
      exceeded: z.boolean(),
    }),
    userPreference: z.string().nullable().meta({
      description: 'Modelo pessoal do usuário (`null` = segue o padrão).',
    }),
    canManage: z.boolean().meta({
      description: 'O usuário pode alterar os ajustes (OWNER/ADMIN).',
    }),
  }),
)

export const FeatureMapDTO = dto(
  'WorkspaceFeatureMap',
  z
    .object(
      Object.fromEntries(
        FEATURE_KEYS.map((key) => [key, z.boolean()]),
      ) as Record<(typeof FEATURE_KEYS)[number], z.ZodBoolean>,
    )
    .meta({
      description:
        'Mapa efetivo `feature → ligada?` (default do plano + override do admin).',
    }),
)

export const ModuleAccessSummaryDTO = dto(
  'WorkspaceModuleAccessSummary',
  z.object({
    module: z.enum(MODULES),
    enabled: z.boolean(),
    grantedById: z.string().nullable(),
    updatedAt: nullableDateTime(),
  }),
)

export const ModuleAccessDTO = dto(
  'WorkspaceModuleAccess',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    module: z.enum(MODULES),
    enabled: z.boolean(),
    grantedById: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const NotificationListDTO = dto(
  'NotificationList',
  z.object({
    items: z.array(
      z.object({
        id: z.string(),
        workspaceId: z.string(),
        kind: z.enum([
          'WHATSAPP_NEGATIVE_SENTIMENT',
          'SD_TICKET_ASSIGNED',
          'SD_TICKET_MESSAGE',
          'SD_SLA_AT_RISK',
          'SD_SLA_BREACHED',
          'SD_TICKET_ESCALATED',
          'SD_APPROVAL_RESPONDED',
          'SD_TICKET_CREATED',
          'SD_TICKET_MENTIONED',
          'SD_TICKET_PHASE_CHANGED',
          'SD_TICKET_RESOLVED',
          'SD_TICKET_REOPENED',
          'SD_APPROVAL_REQUESTED',
          'SD_TASK_ASSIGNED',
          'SD_TICKET_CSAT',
          'SD_DIGEST',
          'CRM_LEAD_ASSIGNED',
          'CRM_OPPORTUNITY_ASSIGNED',
          'CRM_DEAL_CLOSED',
          'CRM_TASK_ASSIGNED',
          'CRM_TASK_DUE',
          'CRM_PROPOSAL_VIEWED',
          'CRM_PROPOSAL_ACCEPTED',
          'CRM_PROPOSAL_EXPIRED',
          'CRM_FORM_SUBMITTED',
          'CRM_CAMPAIGN_FINISHED',
          'CRM_WORKFLOW_FAILED',
          'CRM_WORKFLOW_WAITING',
          'CRM_SOCIAL_POST_FAILED',
          'CRM_COMPETITOR_SYNC_FAILED',
          'MEMBER_JOINED',
          'DATA_EXPORT_READY',
          'TRIAL_ENDED',
          'BILLING_PAYMENT_FAILED',
          'BILLING_SUBSCRIPTION_CANCELED',
          'AI_QUOTA_WARNING',
          'AI_QUOTA_EXCEEDED',
          'SD_APPROVAL_CANCELED',
          'SD_APPROVAL_EXPIRED',
          'SD_TASK_DUE',
          'SD_ONCALL_SHIFT',
          'SD_CONTRACT_FRANCHISE',
          'SD_KB_COMMENT',
          'SD_MONITOR_ALERT',
          'WHATSAPP_CONVERSATION_ASSIGNED',
          'WHATSAPP_AI_HANDOFF',
          'WHATSAPP_CONNECTION_LOST',
          'WHATSAPP_BROADCAST_FINISHED',
          'WHATSAPP_TEMPLATE_REJECTED',
        ]),
        title: z.string(),
        body: z.string(),
        href: z
          .string()
          .nullable()
          .meta({ description: 'Link interno do app.' }),
        read: z.boolean(),
        readAt: dateTime()
          .nullable()
          .meta({ description: 'Quando foi lida, ou `null`.' }),
        archived: z.boolean(),
        archivedAt: dateTime()
          .nullable()
          .meta({ description: 'Quando foi arquivada, ou `null`.' }),
        module: z.enum(['SERVICE_DESK', 'COMMUNICATION', 'CRM', 'OTHER']).meta({
          description: 'Módulo de origem, derivado do `kind`.',
        }),
        moduleLabel: z.string().meta({
          description: 'Nome do módulo em pt-BR.',
          example: 'ServiceDesk',
        }),
        kindLabel: z.string().meta({
          description: 'O que aconteceu, em pt-BR.',
          example: 'SLA violado',
        }),
        icon: z.string().meta({
          description: 'Chave de ícone resolvida pela interface.',
          example: 'alarm',
        }),
        color: z
          .string()
          .meta({ description: 'Cor base do marcador.', example: 'rose' }),
        createdAt: dateTime(),
      }),
    ),
    unreadCount: z.number().int(),
    nextCursor: z
      .string()
      .nullable()
      .meta({ description: 'Cursor da próxima página, ou `null` no fim.' }),
    counts: z
      .object({
        all: z.number().int(),
        unread: z.number().int(),
        archived: z.number().int(),
      })
      .meta({ description: 'Contagem por pasta (marcadores das abas).' }),
  }),
)

export const NotificationRealtimeEventDTO = dto(
  'NotificationRealtimeEvent',
  z.object({
    type: z.literal('notification.created'),
    kind: z.string().meta({ example: 'SD_SLA_BREACHED' }),
    at: dateTime(),
  }),
)

/* -------------------------------- projetos ------------------------------- */

export const ProjectDTO = dto(
  'Project',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Implantação ServiceDesk' }),
    slug: z.string().meta({ example: 'implantacao-servicedesk' }),
    description: z.string().nullable(),
    emoji: z.string().nullable(),
    coverImage: z.string().nullable(),
    isPublic: z.boolean(),
    isFavorited: z.boolean(),
    leadId: z
      .string()
      .meta({ description: 'Usuário responsável pelo projeto.' }),
    workspaceId: z.string(),
    archivedAt: nullableDateTime(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const ProjectMemberDTO = dto(
  'ProjectMember',
  z.object({
    userId: z.string(),
    name: z.string(),
    username: z.string(),
    image: z.string().nullable(),
    isLead: z.boolean(),
    createdAt: dateTime(),
  }),
)

/* ------------------------------ cobrança --------------------------------- */

export const SubscriptionDTO = dto(
  'Subscription',
  z.object({
    id: z.string(),
    billId: z.string().meta({ description: 'ID da cobrança na AbacatePay.' }),
    plan: z.enum(['PRO', 'BUSINESS']),
    status: z.enum(['PENDING', 'PAID', 'CANCELLED', 'EXPIRED', 'REFUNDED']),
    amount: z
      .number()
      .int()
      .meta({ description: 'Valor em centavos (BRL).', example: 14990 }),
    seats: z.number().int(),
    interval: z.enum(BILLING_INTERVALS),
    coupon: z.string().nullable(),
    paymentUrl: z.string().meta({ description: 'Checkout da AbacatePay.' }),
    workspaceId: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const CouponPreviewDTO = dto(
  'CouponPreview',
  z.object({
    code: z.string().meta({ example: 'BEMVINDO10' }),
    discount: z.number().meta({
      description: 'Percentual (0–100) ou centavos, conforme `discountKind`.',
    }),
    discountKind: z.enum(['PERCENTAGE', 'FIXED']),
  }),
)

/* -------------------------------- status --------------------------------- */

const ComponentStatus = z.enum([
  'OPERATIONAL',
  'DEGRADED',
  'PARTIAL_OUTAGE',
  'MAJOR_OUTAGE',
  'MAINTENANCE',
])

export const DailyPointDTO = dto(
  'StatusDailyPoint',
  z.object({
    day: z
      .string()
      .meta({ description: '`YYYY-MM-DD`.', example: '2026-09-17' }),
    status: ComponentStatus,
    uptimePct: z.number().meta({ example: 99.95 }),
    incidentId: z
      .string()
      .optional()
      .meta({ description: 'Presente quando houve incidente no dia.' }),
  }),
)

export const StatusSnapshotDTO = dto(
  'StatusSnapshot',
  z.object({
    overallStatus: ComponentStatus,
    generatedAt: dateTime(),
    components: z.array(
      z.object({
        key: z.enum([
          'app',
          'database',
          'cache',
          'auth',
          'payment',
          'email',
          'storage',
        ]),
        name: z.string().meta({ example: 'Aplicação' }),
        description: z.string(),
        tier: z.enum(['core', 'peripheral']),
        currentStatus: ComponentStatus,
        uptime90d: z.number(),
        history: z.array(DailyPointDTO),
      }),
    ),
  }),
)

/* --------------------------------- legado -------------------------------- */

export const StickyNoteDTO = dto(
  'StickyNote',
  z.object({
    id: z.string(),
    content: z.record(z.string(), z.unknown()).meta({
      description: 'Documento TipTap/ProseMirror serializado.',
      example: { type: 'doc', content: [] },
    }),
    color: z.enum(['RED', 'YELLOW', 'BLUE', 'GREEN', 'PURPLE', 'ZINC']),
    userId: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const ShortLinkDTO = dto(
  'ShortLink',
  z.object({
    id: z.string(),
    title: z.string().meta({ example: 'Documentação' }),
    url: z
      .url()
      .meta({ example: 'https://homologacao.stratustelecom.com.br/docs' }),
    userId: z.string(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const NotificationPreferenceListDTO = dto(
  'NotificationPreferenceList',
  z.array(
    z.object({
      kind: z.string().meta({ example: 'CRM_LEAD_ASSIGNED' }),
      module: z.enum(['COMMUNICATION', 'CRM', 'OTHER']),
      moduleLabel: z.string().meta({ example: 'CRM' }),
      label: z.string().meta({ example: 'Lead atribuído' }),
      icon: z.string().meta({ example: 'assign' }),
      color: z.string().meta({ example: 'violet' }),
      inApp: z
        .boolean()
        .meta({ description: 'Entrega na caixa de entrada (padrão: ligada).' }),
    }),
  ),
)
