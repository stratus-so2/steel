import { z } from 'zod'
import {
  SetUserAiPreferenceSchema,
  UpdateWorkspaceAiSettingsSchema,
} from '@/src/schemas/ai-settings.schema'
import { ValidateCouponSchema } from '@/src/schemas/coupon.schema'
import {
  AcceptInvitationSchema,
  CreateInvitationSchema,
  InviteToProjectSchema,
} from '@/src/schemas/invitation.schema'
import { MarkNotificationsReadSchema } from '@/src/schemas/notification.schema'
import { UpdateNotificationSettingSchema } from '@/src/schemas/notification-settings.schema'
import {
  CreateProfileSchema,
  UpdateProfileSchema,
} from '@/src/schemas/profile.schema'
import {
  CreateProjectSchema,
  UpdateProjectSchema,
} from '@/src/schemas/project.schema'
import { AddProjectMemberSchema } from '@/src/schemas/project-member.schema'
import {
  CreateShortLinkSchema,
  UpdateShortLinkSchema,
} from '@/src/schemas/short-link.schema'
import { StatusHistoryQuerySchema } from '@/src/schemas/status.schema'
import {
  CreateStickyNoteSchema,
  UpdateStickyNoteSchema,
} from '@/src/schemas/sticky-note.schema'
import { CreateSubscriptionSchema } from '@/src/schemas/subscription.schema'
import { TalkToSalesSchema } from '@/src/schemas/talk-to-sales.schema'
import { UpdateUserSchema } from '@/src/schemas/user.schema'
import { UpdateUserPreferenceSchema } from '@/src/schemas/user-preference.schema'
import {
  CreateWorkspaceSchema,
  UpdateWorkspaceSchema,
} from '@/src/schemas/workspace.schema'
import {
  SaveWorkspaceConnectionSchema,
  TestWorkspaceConnectionSchema,
} from '@/src/schemas/workspace-connection.schema'
import {
  fileUpload,
  flag,
  WORKSPACE_MEMBER_ERRORS,
  WORKSPACE_PRIVILEGED_ERRORS,
} from '../common'
import type { OpenApiRegistry, RouteConfig } from '../registry'
import {
  CouponPreviewDTO,
  DailyPointDTO,
  FeatureMapDTO,
  InvitationDTO,
  MediaUrlDTO,
  NotificationListDTO,
  NotificationSettingDTO,
  ProfileDTO,
  ProjectDTO,
  ProjectMemberDTO,
  ShortLinkDTO,
  StatusSnapshotDTO,
  StickyNoteDTO,
  SubscriptionDTO,
  UserDTO,
  UserPreferenceDTO,
  WorkspaceAiSettingsDTO,
  WorkspaceConnectionDTO,
  WorkspaceDTO,
  WorkspaceMemberDTO,
} from '../schemas/core'

/**
 * Rotas base (herdadas do Nexo + plataforma): usuário, workspaces e seus
 * sub-recursos, projetos, cobrança, status, comercial, redes sociais e o
 * legado (sticky notes, links curtos).
 */

const IMAGE_RULES =
  'Aceita JPEG, PNG ou WebP até 5 MB (senão `422 VALIDATION_ERROR`); a imagem é convertida para WebP e gravada no MinIO.'

const MODULE_PARAM = {
  description: 'Módulo cuja conexão será alterada.',
  schema: { type: 'string', enum: ['SERVICE_DESK', 'CRM', 'COMMUNICATION'] },
}

const SLUG_PARAM = {
  description: 'Slug do projeto dentro do workspace.',
  example: 'implantacao-servicedesk',
}

const SetMemberProfileSchema = z.object({
  profileId: z.string().min(1).nullable().meta({
    description: 'Perfil a atribuir; `null` volta ao padrão do papel.',
  }),
})

const InviteToProjectResult = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('added').meta({
      description:
        'O e-mail já era membro do workspace: entrou direto no projeto (200).',
    }),
    member: ProjectMemberDTO,
  }),
  z.object({
    kind: z
      .literal('invited')
      .meta({ description: 'Convite enviado por e-mail (201).' }),
    invitation: InvitationDTO,
  }),
])

const user: RouteConfig[] = [
  {
    method: 'get',
    path: '/users/me',
    tags: ['Usuário'],
    summary: 'Perfil do usuário autenticado',
    description:
      'Dados do usuário, estado do onboarding e workspaces dos quais é membro.',
    rateLimit: false,
    responses: { 200: { description: 'Perfil.', schema: UserDTO } },
  },
  {
    method: 'patch',
    path: '/users/me',
    tags: ['Usuário'],
    summary: 'Atualizar perfil',
    description: 'Atualização parcial de nome, e-mail, username e capa.',
    rateLimit: false,
    body: UpdateUserSchema,
    responses: { 200: { description: 'Perfil atualizado.', schema: UserDTO } },
    errors: [
      'USERNAME_CONFLICT',
      { code: 'CONFLICT', when: 'E-mail já em uso' },
    ],
  },
  {
    method: 'delete',
    path: '/users/me',
    tags: ['Privacidade (LGPD)'],
    summary: 'Agendar exclusão da conta',
    description:
      'Agenda a exclusão definitiva da conta para daqui a 30 dias (LGPD, art. 18, VI) e envia e-mail de confirmação. Pode ser cancelada com `DELETE /users/me/deletion` até a data. Bloqueada enquanto o usuário for o único OWNER de algum workspace. Chamada repetida devolve a data já agendada.',
    rateLimit: false,
    responses: {
      202: {
        description: 'Exclusão agendada.',
        schema: z.object({ scheduledAt: z.iso.datetime() }),
        example: { scheduledAt: '2026-10-18T12:00:00.000Z' },
      },
    },
    errors: [
      {
        code: 'CONFLICT',
        message:
          'Transfira a posse dos workspaces onde você é único OWNER antes de excluir a conta',
        when: 'Único OWNER de algum workspace',
      },
    ],
  },
  {
    method: 'delete',
    path: '/users/me/deletion',
    tags: ['Privacidade (LGPD)'],
    summary: 'Cancelar exclusão agendada',
    description:
      'Cancela a exclusão da conta agendada por `DELETE /users/me`. `canceled: false` quando não havia exclusão agendada.',
    rateLimit: false,
    responses: {
      200: {
        description: 'Resultado.',
        schema: z.object({ canceled: z.boolean() }),
      },
    },
  },
  {
    method: 'post',
    path: '/users/me/export',
    tags: ['Privacidade (LGPD)'],
    summary: 'Solicitar exportação dos dados',
    description:
      'Enfileira a exportação dos dados pessoais (LGPD, art. 18, II e V). O worker gera o arquivo e envia o link por e-mail. Limite de 1 pedido a cada 24 h.',
    rateLimit: false,
    responses: {
      202: {
        description: 'Exportação enfileirada.',
        schema: z.object({ requestedAt: z.iso.datetime() }),
      },
    },
    errors: [
      { code: 'RATE_LIMITED', when: 'Já houve um pedido nas últimas 24 h' },
    ],
  },
  {
    method: 'post',
    path: '/users/me/cookie-consent',
    tags: ['Privacidade (LGPD)'],
    summary: 'Registrar consentimento de cookies',
    description:
      'Registra a escolha do banner de cookies com IP e user-agent (prova do consentimento).',
    rateLimit: false,
    body: z.object({ accepted: z.boolean() }),
    responses: {
      200: {
        description: 'Consentimento registrado.',
        schema: z.object({ accepted: z.boolean() }),
      },
    },
  },
  {
    method: 'post',
    path: '/users/me/avatar',
    tags: ['Usuário'],
    summary: 'Enviar foto de perfil',
    description: IMAGE_RULES,
    rateLimit: 'upload',
    body: fileUpload('avatars', 'Imagem do avatar.'),
    responses: { 200: { description: 'Avatar salvo.', schema: MediaUrlDTO } },
    errors: [
      {
        code: 'VALIDATION_ERROR',
        message: 'Formato não suportado. Use JPEG, PNG ou WebP',
      },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'post',
    path: '/users/me/cover',
    tags: ['Usuário'],
    summary: 'Enviar capa do perfil',
    description: IMAGE_RULES,
    rateLimit: 'upload',
    body: fileUpload('cover', 'Imagem de capa.'),
    responses: { 200: { description: 'Imagem salva.', schema: MediaUrlDTO } },
    errors: [
      {
        code: 'VALIDATION_ERROR',
        message: 'Formato não suportado. Use JPEG, PNG ou WebP',
      },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: '/users/me/preferences',
    tags: ['Usuário'],
    summary: 'Preferências',
    description:
      'Tema, cursor, atalho de envio, fuso e semana. Também espelha tema/fuso em cookies para o SSR.',
    rateLimit: false,
    responses: {
      200: { description: 'Preferências.', schema: UserPreferenceDTO },
    },
  },
  {
    method: 'patch',
    path: '/users/me/preferences',
    tags: ['Usuário'],
    summary: 'Atualizar preferências',
    description:
      'Atualização parcial — informe ao menos um campo. `timezone` precisa ser um fuso IANA válido.',
    body: UpdateUserPreferenceSchema,
    responses: {
      200: {
        description: 'Preferências atualizadas.',
        schema: UserPreferenceDTO,
      },
    },
  },
  {
    method: 'get',
    path: '/users/me/notifications',
    tags: ['Usuário'],
    summary: 'Preferências de notificação',
    rateLimit: false,
    responses: {
      200: {
        description: 'Preferências de notificação por e-mail.',
        schema: NotificationSettingDTO,
      },
    },
  },
  {
    method: 'patch',
    path: '/users/me/notifications',
    tags: ['Usuário'],
    summary: 'Atualizar preferências de notificação',
    description: 'Atualização parcial — informe ao menos um campo.',
    body: UpdateNotificationSettingSchema,
    responses: {
      200: {
        description: 'Preferências atualizadas.',
        schema: NotificationSettingDTO,
      },
    },
  },
]

const workspaces: RouteConfig[] = [
  {
    method: 'post',
    path: '/workspaces',
    tags: ['Workspaces'],
    summary: 'Criar workspace',
    description:
      'Cria o workspace com o usuário como OWNER, perfis de acesso padrão e o período de trial do plano.',
    consent: true,
    body: CreateWorkspaceSchema,
    responses: {
      201: { description: 'Workspace criado.', schema: WorkspaceDTO },
    },
    errors: [
      {
        code: 'CONFLICT',
        message: 'Slug já está em uso',
        when: 'Slug já em uso',
      },
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}',
    tags: ['Workspaces'],
    summary: 'Detalhe do workspace',
    responses: { 200: { description: 'Workspace.', schema: WorkspaceDTO } },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}',
    tags: ['Workspaces'],
    summary: 'Atualizar workspace',
    description: 'Nome e/ou slug. Só OWNER/ADMIN.',
    consent: true,
    body: UpdateWorkspaceSchema,
    responses: {
      200: { description: 'Workspace atualizado.', schema: WorkspaceDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      {
        code: 'CONFLICT',
        message: 'Slug já está em uso',
        when: 'Slug já em uso',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}',
    tags: ['Workspaces'],
    summary: 'Excluir workspace',
    description: 'Exclui o workspace e seus dados. Só o OWNER.',
    consent: true,
    responses: { 200: { description: 'Workspace excluído.', schema: null } },
    errors: [
      {
        code: 'FORBIDDEN',
        message: 'Apenas o OWNER pode deletar o workspace',
        when: 'Usuário não é o OWNER',
      },
      'WORKSPACE_SUSPENDED',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/members',
    tags: ['Membros e convites'],
    summary: 'Membros do workspace',
    responses: {
      200: { description: 'Membros.', schema: z.array(WorkspaceMemberDTO) },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/members/{userId}/profile',
    tags: ['Membros e convites', 'Perfis de acesso'],
    summary: 'Atribuir perfil de acesso a um membro',
    description:
      'Só OWNER/ADMIN. `profileId: null` remove o perfil (volta ao padrão do papel).',
    params: { userId: 'ID do usuário membro.' },
    body: SetMemberProfileSchema,
    responses: {
      200: { description: 'Perfil atribuído.', schema: flag('updated') },
    },
    errors: [...WORKSPACE_PRIVILEGED_ERRORS, 'PROFILE_NOT_FOUND'],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/invitations',
    tags: ['Membros e convites'],
    summary: 'Convites do workspace',
    description: 'Convites pendentes e históricos. Só OWNER/ADMIN.',
    responses: {
      200: { description: 'Convites.', schema: z.array(InvitationDTO) },
    },
    errors: WORKSPACE_PRIVILEGED_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/invitations',
    tags: ['Membros e convites'],
    summary: 'Convidar por e-mail',
    description:
      'Envia convite com validade para o e-mail informado. Só OWNER/ADMIN. Respeita o limite de assentos do plano (`SEAT_LIMIT_REACHED`). `projectId` opcional já vincula o convidado a um projeto.',
    consent: true,
    body: CreateInvitationSchema,
    responses: {
      201: {
        description: 'Convite criado e e-mail enviado.',
        schema: InvitationDTO,
      },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'SEAT_LIMIT_REACHED',
      'INVITATION_DUPLICATE',
      'INVITATION_ALREADY_MEMBER',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/invitations/{invitationId}',
    tags: ['Membros e convites'],
    summary: 'Revogar convite',
    description: 'Só OWNER/ADMIN; apenas convites pendentes.',
    params: { invitationId: 'ID do convite.' },
    responses: {
      200: { description: 'Convite revogado.', schema: InvitationDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'INVITATION_NOT_FOUND',
      'INVITATION_NOT_PENDING',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/invitations/{invitationId}/resend',
    tags: ['Membros e convites'],
    summary: 'Reenviar convite',
    description: 'Renova a validade e reenvia o e-mail. Só OWNER/ADMIN.',
    params: { invitationId: 'ID do convite.' },
    responses: {
      200: { description: 'Convite reenviado.', schema: InvitationDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'INVITATION_NOT_FOUND',
      'INVITATION_NOT_PENDING',
    ],
  },
  {
    method: 'post',
    path: '/invitations/accept',
    tags: ['Membros e convites'],
    summary: 'Aceitar convite',
    description:
      'Aceita o convite do link do e-mail (`/invite?token=`). O e-mail da sessão precisa ser o do convite. Devolve o workspace para redirecionar.',
    body: AcceptInvitationSchema,
    responses: {
      200: {
        description: 'Convite aceito; usuário agora é membro.',
        schema: z.object({ workspaceId: z.string(), slug: z.string() }),
        example: { workspaceId: 'ckv9x2p0h0000ws7d3k1e5abc', slug: 'acme' },
      },
    },
    errors: [
      'INVITATION_NOT_FOUND',
      'INVITATION_NOT_PENDING',
      'INVITATION_EXPIRED',
      'INVITATION_EMAIL_MISMATCH',
      'SEAT_LIMIT_REACHED',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/profiles',
    tags: ['Perfis de acesso'],
    summary: 'Perfis de acesso',
    description: 'Perfis do workspace, incluindo os de sistema (`isSystem`).',
    responses: { 200: { description: 'Perfis.', schema: z.array(ProfileDTO) } },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/profiles',
    tags: ['Perfis de acesso'],
    summary: 'Criar perfil de acesso',
    description:
      'Só OWNER/ADMIN. `permissions` é um mapa `recurso → [VIEW|CREATE|EDIT|DELETE]`; pares fora do catálogo (`src/lib/permissions.ts`) são descartados.',
    body: {
      schema: CreateProfileSchema,
      example: {
        name: 'Vendas',
        permissions: { leads: ['VIEW', 'CREATE', 'EDIT'], documents: ['VIEW'] },
      },
    },
    responses: { 201: { description: 'Perfil criado.', schema: ProfileDTO } },
    errors: [...WORKSPACE_PRIVILEGED_ERRORS, 'PROFILE_NAME_TAKEN'],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/profiles/{profileId}',
    tags: ['Perfis de acesso'],
    summary: 'Atualizar perfil de acesso',
    description: 'Só OWNER/ADMIN. Perfis de sistema não podem ser alterados.',
    params: { profileId: 'ID do perfil.' },
    body: UpdateProfileSchema,
    responses: {
      200: { description: 'Perfil atualizado.', schema: ProfileDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'PROFILE_NOT_FOUND',
      'PROFILE_NAME_TAKEN',
      'PROFILE_SYSTEM_PROTECTED',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/profiles/{profileId}',
    tags: ['Perfis de acesso'],
    summary: 'Excluir perfil de acesso',
    description:
      'Só OWNER/ADMIN. Bloqueado para perfis de sistema e perfis atribuídos a membros.',
    params: { profileId: 'ID do perfil.' },
    responses: { 200: { description: 'Perfil excluído.', schema: null } },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'PROFILE_NOT_FOUND',
      'PROFILE_SYSTEM_PROTECTED',
      'PROFILE_IN_USE',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/connections',
    tags: ['Configurações do workspace'],
    summary: 'Conexões com banco externo',
    description:
      'Conexões Postgres externas por módulo (sem a senha). Só OWNER/ADMIN.',
    responses: {
      200: {
        description: 'Conexões.',
        schema: z.array(WorkspaceConnectionDTO),
      },
    },
    errors: [...WORKSPACE_PRIVILEGED_ERRORS, 'CONNECTION_FORBIDDEN'],
  },
  {
    method: 'put',
    path: '/workspaces/{id}/connections/{module}',
    tags: ['Configurações do workspace'],
    summary: 'Salvar conexão de um módulo',
    description:
      'Cria ou substitui a conexão Postgres externa do módulo. A senha é cifrada com `CONNECTION_SECRETS` e nunca é devolvida. Só OWNER/ADMIN; depende do plano (`CONNECTION_FORBIDDEN`).',
    consent: true,
    params: { module: MODULE_PARAM },
    body: SaveWorkspaceConnectionSchema,
    responses: {
      200: { description: 'Conexão salva.', schema: WorkspaceConnectionDTO },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'CONNECTION_FORBIDDEN',
      {
        code: 'VALIDATION_ERROR',
        message: 'Módulo inválido',
        when: 'Módulo inválido no path',
      },
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/connections/{module}',
    tags: ['Configurações do workspace'],
    summary: 'Remover conexão de um módulo',
    description: 'O módulo volta a usar o banco da plataforma. Só OWNER/ADMIN.',
    consent: true,
    params: { module: MODULE_PARAM },
    responses: { 200: { description: 'Conexão removida.', schema: null } },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'CONNECTION_NOT_FOUND',
      { code: 'VALIDATION_ERROR', message: 'Módulo inválido' },
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/connections/test',
    tags: ['Configurações do workspace'],
    summary: 'Testar conexão',
    description:
      'Tenta conectar com as credenciais informadas, sem salvar. Só OWNER/ADMIN.',
    body: TestWorkspaceConnectionSchema,
    responses: {
      200: { description: 'Conexão bem-sucedida.', schema: flag('ok') },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'CONNECTION_FORBIDDEN',
      'CONNECTION_TEST_FAILED',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai-settings',
    tags: ['Configurações do workspace'],
    summary: 'Ajustes de IA',
    description:
      'Provedores disponíveis, modelos habilitados, modelos padrão por uso (CRM, respostas e sentimento do WhatsApp), cota mensal e consumo do mês. `canManage` indica se o usuário pode alterar.',
    responses: {
      200: { description: 'Ajustes de IA.', schema: WorkspaceAiSettingsDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/ai-settings',
    tags: ['Configurações do workspace'],
    summary: 'Atualizar ajustes de IA',
    description:
      'PATCH parcial, só OWNER/ADMIN. Os modelos padrão precisam estar entre os habilitados e com provedor disponível.',
    body: UpdateWorkspaceAiSettingsSchema,
    responses: {
      200: {
        description: 'Ajustes atualizados.',
        schema: WorkspaceAiSettingsDTO,
      },
    },
    errors: [
      ...WORKSPACE_PRIVILEGED_ERRORS,
      'AI_MODEL_NOT_ENABLED',
      'AI_PROVIDER_UNAVAILABLE',
    ],
  },
  {
    method: 'put',
    path: '/workspaces/{id}/ai-settings/preference',
    tags: ['Configurações do workspace'],
    summary: 'Modelo de IA pessoal',
    description:
      'Qualquer membro. `modelKey: null` volta a seguir o padrão do workspace.',
    body: SetUserAiPreferenceSchema,
    responses: {
      200: {
        description: 'Ajustes com a nova preferência.',
        schema: WorkspaceAiSettingsDTO,
      },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'AI_MODEL_NOT_ENABLED',
      'AI_PROVIDER_UNAVAILABLE',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/features',
    tags: ['Configurações do workspace'],
    summary: 'Feature flags efetivas',
    description:
      'Mapa `feature → ligada?` (default do plano + override do admin) para a UI esconder o que está desligado.',
    responses: {
      200: {
        description: 'Mapa de features.',
        schema: FeatureMapDTO,
        example: {
          'crm.aiAssistant': true,
          'crm.socialPublishing': false,
          'communication.broadcasts': true,
        },
      },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'get',
    path: '/workspaces/{id}/notifications',
    tags: ['Configurações do workspace'],
    summary: 'Notificações in-app',
    description:
      'Caixa de entrada do usuário no workspace (ex.: alertas de sentimento negativo no WhatsApp), com a contagem de não lidas.',
    responses: {
      200: { description: 'Notificações.', schema: NotificationListDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/notifications/read',
    tags: ['Configurações do workspace'],
    summary: 'Marcar notificações como lidas',
    description:
      'Com `ids` (até 100), marca essas; sem `ids`, marca todas do usuário no workspace.',
    body: MarkNotificationsReadSchema,
    responses: {
      200: {
        description: 'Quantidade marcada.',
        schema: z.object({ updated: z.number().int() }),
      },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
]

const projects: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/projects',
    tags: ['Projetos'],
    summary: 'Listar projetos',
    description:
      'Projetos visíveis ao usuário. `archived=true` lista os arquivados.',
    query: {
      type: 'object',
      properties: {
        archived: {
          type: 'string',
          enum: ['true', 'false'],
          description:
            '`true` lista só os arquivados; omitido/`false`, só os ativos.',
        },
      },
    },
    responses: {
      200: { description: 'Projetos.', schema: z.array(ProjectDTO) },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects',
    tags: ['Projetos'],
    summary: 'Criar projeto',
    description: 'O criador vira o responsável (`leadId`) e membro do projeto.',
    body: CreateProjectSchema,
    responses: { 201: { description: 'Projeto criado.', schema: ProjectDTO } },
    errors: [...WORKSPACE_MEMBER_ERRORS, 'PROJECT_SLUG_CONFLICT'],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects/cover-image',
    tags: ['Projetos'],
    summary: 'Enviar imagem de capa de projeto',
    description: `Faz o upload e devolve a URL para usar em \`coverImage\` na criação/edição. ${IMAGE_RULES}`,
    body: fileUpload('file', 'Imagem de capa.'),
    responses: { 201: { description: 'Imagem salva.', schema: MediaUrlDTO } },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      { code: 'VALIDATION_ERROR', message: 'Arquivo não enviado' },
      'STORAGE_ERROR',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/projects/{slug}',
    tags: ['Projetos'],
    summary: 'Detalhe do projeto',
    params: { slug: SLUG_PARAM },
    responses: { 200: { description: 'Projeto.', schema: ProjectDTO } },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/projects/{slug}',
    tags: ['Projetos'],
    summary: 'Atualizar projeto',
    params: { slug: SLUG_PARAM },
    consent: true,
    body: UpdateProjectSchema,
    responses: {
      200: { description: 'Projeto atualizado.', schema: ProjectDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
      'PROJECT_SLUG_CONFLICT',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/projects/{slug}',
    tags: ['Projetos'],
    summary: 'Excluir projeto',
    params: { slug: SLUG_PARAM },
    consent: true,
    responses: { 200: { description: 'Projeto excluído.', schema: null } },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/projects/{slug}/archive',
    tags: ['Projetos'],
    summary: 'Arquivar projeto',
    params: { slug: SLUG_PARAM },
    consent: true,
    responses: {
      200: { description: 'Projeto arquivado.', schema: ProjectDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/projects/{slug}/restore',
    tags: ['Projetos'],
    summary: 'Restaurar projeto arquivado',
    params: { slug: SLUG_PARAM },
    consent: true,
    responses: {
      200: { description: 'Projeto restaurado.', schema: ProjectDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects/{slug}/favorite',
    tags: ['Projetos'],
    summary: 'Favoritar projeto',
    params: { slug: SLUG_PARAM },
    consent: true,
    responses: {
      200: {
        description: 'Estado de favorito.',
        schema: z.object({ favorited: z.boolean() }),
      },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, 'PROJECT_NOT_FOUND'],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/projects/{slug}/favorite',
    tags: ['Projetos'],
    summary: 'Desfavoritar projeto',
    params: { slug: SLUG_PARAM },
    consent: true,
    responses: {
      200: {
        description: 'Estado de favorito.',
        schema: z.object({ favorited: z.boolean() }),
      },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, 'PROJECT_NOT_FOUND'],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/projects/{slug}/members',
    tags: ['Projetos'],
    summary: 'Membros do projeto',
    params: { slug: SLUG_PARAM },
    responses: {
      200: { description: 'Membros.', schema: z.array(ProjectMemberDTO) },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects/{slug}/members',
    tags: ['Projetos'],
    summary: 'Adicionar membro ao projeto',
    description: 'O usuário precisa já ser membro do workspace.',
    params: { slug: SLUG_PARAM },
    consent: true,
    body: AddProjectMemberSchema,
    responses: {
      201: { description: 'Membro adicionado.', schema: ProjectMemberDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
      'PROJECT_MEMBER_ALREADY_EXISTS',
      'PROJECT_MEMBER_NOT_IN_WORKSPACE',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/projects/{slug}/members/{userId}',
    tags: ['Projetos'],
    summary: 'Remover membro do projeto',
    params: { slug: SLUG_PARAM, userId: 'ID do usuário a remover.' },
    responses: { 200: { description: 'Membro removido.', schema: null } },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
      'PROJECT_MEMBER_NOT_FOUND',
    ],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/projects/{slug}/members/invite',
    tags: ['Projetos'],
    summary: 'Convites pendentes do projeto',
    params: { slug: SLUG_PARAM },
    responses: {
      200: { description: 'Convites.', schema: z.array(InvitationDTO) },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects/{slug}/members/invite',
    tags: ['Projetos'],
    summary: 'Convidar para o projeto por e-mail',
    description:
      'Se o e-mail já é membro do workspace, entra direto no projeto (`kind: added`, 200); senão recebe um convite do workspace vinculado ao projeto (`kind: invited`, 201).',
    params: { slug: SLUG_PARAM },
    consent: true,
    body: InviteToProjectSchema,
    responses: {
      200: {
        description: 'Membro adicionado diretamente (`kind: added`).',
        schema: InviteToProjectResult,
      },
      201: {
        description: 'Convite enviado (`kind: invited`).',
        schema: InviteToProjectResult,
      },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_NOT_FOUND',
      'PROJECT_FORBIDDEN',
      'SEAT_LIMIT_REACHED',
      'INVITATION_DUPLICATE',
      'PROJECT_MEMBER_ALREADY_EXISTS',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/projects/{slug}/members/invite/{invitationId}',
    tags: ['Projetos'],
    summary: 'Revogar convite do projeto',
    params: { slug: SLUG_PARAM, invitationId: 'ID do convite.' },
    responses: {
      200: { description: 'Convite revogado.', schema: InvitationDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_FORBIDDEN',
      'INVITATION_NOT_FOUND',
      'INVITATION_NOT_PENDING',
    ],
  },
  {
    method: 'post',
    path: '/workspaces/{id}/projects/{slug}/members/invite/{invitationId}/resend',
    tags: ['Projetos'],
    summary: 'Reenviar convite do projeto',
    params: { slug: SLUG_PARAM, invitationId: 'ID do convite.' },
    responses: {
      200: { description: 'Convite reenviado.', schema: InvitationDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      'PROJECT_FORBIDDEN',
      'INVITATION_NOT_FOUND',
      'INVITATION_NOT_PENDING',
    ],
  },
]

const billing: RouteConfig[] = [
  {
    method: 'post',
    path: '/payment/plan',
    tags: ['Assinaturas'],
    summary: 'Assinar plano',
    description:
      'Cria a cobrança na AbacatePay para o plano, assentos e periodicidade informados e devolve a `paymentUrl` do checkout. Só OWNER/ADMIN do workspace. O plano só muda quando o webhook confirma o pagamento.',
    consent: true,
    body: {
      schema: CreateSubscriptionSchema,
      example: {
        plan: 'PRO',
        workspaceId: 'ckv9x2p0h0000ws7d3k1e5abc',
        seats: 5,
        interval: 'MONTHLY',
        coupon: 'BEMVINDO10',
      },
    },
    responses: {
      201: { description: 'Cobrança criada.', schema: SubscriptionDTO },
    },
    errors: [
      {
        code: 'FORBIDDEN',
        message: 'Apenas OWNER ou ADMIN podem alterar o plano',
        when: 'Não é OWNER/ADMIN',
      },
      'WORKSPACE_SUSPENDED',
      'COUPON_INVALID',
      'PAYMENT_ERROR',
    ],
  },
  {
    method: 'post',
    path: '/payment/webhook',
    tags: ['Assinaturas'],
    summary: 'Webhook da AbacatePay',
    description:
      'Recebe os eventos de cobrança. `subscription.completed` ativa o plano pago; `subscription.cancelled`/`subscription.expired` voltam o workspace ao FREE. Eventos desconhecidos são ignorados (200). Idempotente.',
    auth: 'abacatePayWebhook',
    body: {
      schema: z.object({
        event: z.string().meta({ example: 'subscription.completed' }),
        data: z.object({
          id: z.string().meta({ description: 'ID da cobrança (`billId`).' }),
        }),
      }),
    },
    responses: {
      200: { description: 'Evento recebido.', schema: flag('received') },
    },
    errors: [
      {
        code: 'UNAUTHORIZED',
        message: 'Invalid webhook secret',
        when: 'Segredo ausente ou inválido',
      },
    ],
  },
  {
    method: 'get',
    path: '/coupons/validate',
    tags: ['Assinaturas'],
    summary: 'Validar cupom',
    description:
      'Consulta o cupom na AbacatePay e devolve o desconto, para prévia no checkout.',
    query: ValidateCouponSchema,
    responses: {
      200: { description: 'Cupom válido.', schema: CouponPreviewDTO },
    },
    errors: ['COUPON_INVALID', 'PAYMENT_ERROR'],
  },
]

const platform: RouteConfig[] = [
  {
    method: 'get',
    path: '/status',
    tags: ['Status'],
    summary: 'Status atual da plataforma',
    description:
      'Situação geral e de cada componente (app, banco, cache, auth, pagamento, e-mail, storage) com uptime de 90 dias. Público, cacheável (`Cache-Control: public, max-age=30, stale-while-revalidate=60`).',
    auth: 'public',
    rateLimit: 'ip',
    responses: {
      200: { description: 'Snapshot do status.', schema: StatusSnapshotDTO },
    },
  },
  {
    method: 'get',
    path: '/status/history',
    tags: ['Status'],
    summary: 'Histórico diário de um componente',
    description:
      'Um ponto por dia (padrão 90, máximo 365). Público e cacheável.',
    auth: 'public',
    rateLimit: 'ip',
    query: StatusHistoryQuerySchema,
    responses: {
      200: { description: 'Pontos diários.', schema: z.array(DailyPointDTO) },
    },
  },
  ...(['core', 'peripheral'] as const).map(
    (tier): RouteConfig => ({
      method: 'post',
      path: `/status/collect/${tier}`,
      tags: ['Status'],
      summary: `Coletar health checks (${tier === 'core' ? 'componentes centrais' : 'componentes periféricos'})`,
      description: `Roda as sondas do nível \`${tier}\` e grava o resultado. O worker já coleta em agenda (core a cada 1 min, peripheral a cada 5 min — ADR 0004); a rota fica para disparo manual.`,
      auth: 'statusCollector',
      responses: {
        200: {
          description: 'Coleta concluída.',
          schema: z.object({
            tier: z.literal(tier),
            collectedAt: z.iso.datetime(),
          }),
        },
      },
      errors: [
        {
          code: 'UNAUTHORIZED',
          message: 'Invalid collector secret',
          when: 'Segredo ausente ou inválido',
        },
      ],
    }),
  ),
  {
    method: 'post',
    path: '/talk-to-sales',
    tags: ['Comercial'],
    summary: 'Fale com vendas',
    description:
      'Formulário público do site: envia os dados por e-mail ao time comercial.',
    auth: 'public',
    rateLimit: 'ip',
    body: {
      schema: TalkToSalesSchema,
      example: {
        name: 'Maria Souza',
        email: 'maria@acme.com.br',
        teamSize: '11-50',
        message: 'Queremos centralizar o atendimento no WhatsApp.',
      },
    },
    responses: {
      201: { description: 'Mensagem enviada.', schema: flag('received') },
    },
    errors: ['MAIL_ERROR'],
  },
  {
    method: 'get',
    path: '/social/callback/{platform}',
    tags: ['Redes sociais (OAuth e mídia)'],
    summary: 'Callback OAuth das redes sociais',
    description:
      'Destino do OAuth ao conectar uma rede social no CRM. Troca o `code` (com PKCE quando aplicável) pela conexão e redireciona para `/<slug>/crm/settings?social=connected` — ou `?social=error&reason=<código>`. Sem sessão, redireciona para `/sign-in`. Chamado pelo navegador.',
    rateLimit: false,
    autoErrors: false,
    params: {
      platform: {
        description: 'Rede social.',
        schema: {
          type: 'string',
          enum: [
            'facebook',
            'instagram',
            'tiktok',
            'twitter',
            'linkedin',
            'youtube',
            'google_ads',
            'google_analytics',
          ],
        },
      },
    },
    query: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Código de autorização do provedor.',
        },
        state: {
          type: 'string',
          description: 'Estado assinado gerado no início do fluxo.',
        },
        error: { type: 'string', description: 'Erro devolvido pelo provedor.' },
      },
    },
    responses: {
      302: {
        description:
          'Redireciona para as configurações do CRM (ou `/sign-in`).',
        envelope: false,
      },
    },
  },
  {
    method: 'get',
    path: '/social/blob/{token}',
    tags: ['Redes sociais (OAuth e mídia)'],
    summary: 'Blob temporário de mídia',
    description:
      'Serve bytes de mídia como URL pública temporária (~10 min) para as APIs das redes (ex.: o Instagram exige `image_url`/`video_url`). Sem autenticação: o token de 24 bytes aleatórios é o segredo. Suporta `Range` (206).',
    auth: 'public',
    params: { token: 'Token do blob.' },
    headers: { Range: { description: 'Faixa de bytes (`bytes=0-1023`).' } },
    responses: {
      200: {
        description: 'Conteúdo completo.',
        envelope: false,
        contentType: 'application/octet-stream',
        schema: { type: 'string', format: 'binary' },
      },
      206: {
        description: 'Conteúdo parcial (`Content-Range`).',
        envelope: false,
        contentType: 'application/octet-stream',
        schema: { type: 'string', format: 'binary' },
      },
      404: {
        description: 'Blob não encontrado ou expirado (texto puro).',
        envelope: false,
      },
    },
  },
  {
    method: 'head',
    path: '/social/blob/{token}',
    tags: ['Redes sociais (OAuth e mídia)'],
    summary: 'Metadados do blob temporário',
    description:
      'Mesmos headers do GET (`Content-Type`, `Content-Length`, `Accept-Ranges`), sem corpo.',
    auth: 'public',
    params: { token: 'Token do blob.' },
    responses: {
      200: { description: 'Blob disponível.', envelope: false },
      404: { description: 'Blob não encontrado ou expirado.', envelope: false },
    },
  },
]

const LEGACY = 'Recurso legado da base Nexo, mantido por compatibilidade.'

const legacy: RouteConfig[] = [
  {
    method: 'get',
    path: '/sticky-notes',
    tags: ['Sticky Notes'],
    summary: 'Listar sticky notes',
    description: `Notas do usuário autenticado. ${LEGACY}`,
    responses: {
      200: { description: 'Notas.', schema: z.array(StickyNoteDTO) },
    },
  },
  {
    method: 'post',
    path: '/sticky-notes',
    tags: ['Sticky Notes'],
    summary: 'Criar sticky note',
    description: `\`content\` é um documento TipTap (até 100 KB serializado). ${LEGACY}`,
    consent: true,
    body: CreateStickyNoteSchema,
    responses: { 201: { description: 'Nota criada.', schema: StickyNoteDTO } },
  },
  {
    method: 'patch',
    path: '/sticky-notes/{id}',
    tags: ['Sticky Notes'],
    summary: 'Atualizar sticky note',
    description: `Só o dono. ${LEGACY}`,
    params: { id: 'ID da nota.' },
    consent: true,
    body: UpdateStickyNoteSchema,
    responses: {
      200: { description: 'Nota atualizada.', schema: StickyNoteDTO },
    },
    errors: [
      { code: 'FORBIDDEN', when: 'Nota de outro usuário' },
      'RESOURCE_NOT_FOUND',
    ],
  },
  {
    method: 'delete',
    path: '/sticky-notes/{id}',
    tags: ['Sticky Notes'],
    summary: 'Excluir sticky note',
    description: `Só o dono. ${LEGACY}`,
    params: { id: 'ID da nota.' },
    consent: true,
    responses: { 200: { description: 'Nota excluída.', schema: null } },
    errors: [
      { code: 'FORBIDDEN', when: 'Nota de outro usuário' },
      'RESOURCE_NOT_FOUND',
    ],
  },
  {
    method: 'get',
    path: '/short-links',
    tags: ['Links Curtos'],
    summary: 'Listar links',
    description: `Links salvos pelo usuário. ${LEGACY}`,
    responses: {
      200: { description: 'Links.', schema: z.array(ShortLinkDTO) },
    },
  },
  {
    method: 'post',
    path: '/short-links',
    tags: ['Links Curtos'],
    summary: 'Criar link',
    description: LEGACY,
    consent: true,
    body: CreateShortLinkSchema,
    responses: { 201: { description: 'Link criado.', schema: ShortLinkDTO } },
  },
  {
    method: 'patch',
    path: '/short-links/{id}',
    tags: ['Links Curtos'],
    summary: 'Atualizar link',
    description: `Só o dono. ${LEGACY}`,
    params: { id: 'ID do link.' },
    consent: true,
    body: UpdateShortLinkSchema,
    responses: {
      200: { description: 'Link atualizado.', schema: ShortLinkDTO },
    },
    errors: [
      { code: 'FORBIDDEN', when: 'Link de outro usuário' },
      'RESOURCE_NOT_FOUND',
    ],
  },
  {
    method: 'delete',
    path: '/short-links/{id}',
    tags: ['Links Curtos'],
    summary: 'Excluir link',
    description: `Só o dono. ${LEGACY}`,
    params: { id: 'ID do link.' },
    consent: true,
    responses: { 200: { description: 'Link excluído.', schema: null } },
    errors: [
      { code: 'FORBIDDEN', when: 'Link de outro usuário' },
      'RESOURCE_NOT_FOUND',
    ],
  },
]

export function registerCorePaths(registry: OpenApiRegistry): void {
  for (const route of [
    ...user,
    ...workspaces,
    ...projects,
    ...billing,
    ...platform,
    ...legacy,
  ]) {
    registry.registerRoute(route)
  }
}
