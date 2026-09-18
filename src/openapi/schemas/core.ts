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
        kind: z.enum(['WHATSAPP_NEGATIVE_SENTIMENT']),
        title: z.string(),
        body: z.string(),
        href: z
          .string()
          .nullable()
          .meta({ description: 'Link interno do app.' }),
        read: z.boolean(),
        createdAt: dateTime(),
      }),
    ),
    unreadCount: z.number().int(),
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
