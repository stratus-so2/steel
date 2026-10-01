import { UpdateSdNotificationPreferencesSchema } from '@/src/schemas/sd-notification.schema'
import type { ErrorEntry, RouteConfig } from '../../registry'
import {
  SdNotificationPreferencesDTO,
  SdTicketFollowersDTO,
} from '../../schemas/servicedesk/notifications'

/**
 * ServiceDesk · notificações — preferências do próprio usuário
 * (`app/api/workspaces/[id]/servicedesk/notification-preferences`) e
 * seguidores do chamado
 * (`.../servicedesk/tickets/[ticketId]/followers`). O catálogo de eventos
 * (`src/config/servicedesk-notifications.ts`) é a fonte da verdade: a matriz
 * devolvida já vem com os padrões aplicados.
 */

const NOTIFICATIONS = 'ServiceDesk · Notificações' as const

const base = '/workspaces/{id}/servicedesk'
const ticket = `${base}/tickets/{ticketId}`
const TICKET_PARAM = {
  ticketId: 'Id do chamado, número (`123`) ou código (`INC-000123`).',
}

const ACCESS_ERRORS: ErrorEntry[] = [
  {
    code: 'FORBIDDEN',
    when: 'Não é membro do workspace ou o perfil não concede a permissão',
  },
  'WORKSPACE_SUSPENDED',
  { code: 'MODULE_DISABLED', when: 'Módulo ServiceDesk desabilitado' },
]

const TICKET_ERRORS: ErrorEntry[] = [
  ...ACCESS_ERRORS,
  'SD_TICKET_NOT_FOUND',
  {
    code: 'SD_TICKET_FORBIDDEN',
    when: 'Solicitante sem vínculo com o chamado',
  },
]

const ACCESS =
  'Acesso: sessão + membro com o módulo **ServiceDesk** habilitado. As preferências são sempre as do usuário da sessão — não há visão de administrador.'

export const sdNotificationRoutes: RouteConfig[] = [
  {
    method: 'get',
    path: `${base}/notification-preferences`,
    tags: [NOTIFICATIONS],
    summary: 'Minhas preferências de notificação',
    description: `Matriz evento × canal do usuário, agrupada por tema, com os padrões do catálogo já aplicados (\`enabledChannels\`). Eventos \`agentOnly\` não aparecem para solicitantes. ${ACCESS}`,
    responses: {
      200: {
        description: 'Matriz de preferências.',
        schema: SdNotificationPreferencesDTO,
      },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'put',
    path: `${base}/notification-preferences`,
    tags: [NOTIFICATIONS],
    summary: 'Salvar preferências de notificação',
    description: `Grava só as células enviadas (\`items\`); as demais seguem no padrão do catálogo. Recusa um canal que o evento não oferece e um evento \`agentOnly\` para quem é solicitante. Devolve a matriz inteira já atualizada. ${ACCESS}`,
    consent: true,
    body: UpdateSdNotificationPreferencesSchema,
    responses: {
      200: {
        description: 'Preferências salvas.',
        schema: SdNotificationPreferencesDTO,
      },
    },
    errors: [
      ...ACCESS_ERRORS,
      'VALIDATION_ERROR',
      {
        code: 'SD_NOTIFICATION_EVENT_UNKNOWN',
        when: 'Chave de evento fora do catálogo',
      },
      {
        code: 'SD_NOT_AGENT',
        when: 'Solicitante tentou configurar um evento de agente',
      },
    ],
  },
  {
    method: 'delete',
    path: `${base}/notification-preferences`,
    tags: [NOTIFICATIONS],
    summary: 'Restaurar os padrões de notificação',
    description: `Apaga todas as preferências salvas do usuário no workspace: tudo volta ao padrão do catálogo. ${ACCESS}`,
    consent: true,
    responses: {
      200: {
        description: 'Padrões restaurados.',
        schema: SdNotificationPreferencesDTO,
      },
    },
    errors: ACCESS_ERRORS,
  },
  {
    method: 'get',
    path: `${ticket}/followers`,
    tags: [NOTIFICATIONS],
    summary: 'Quem segue o chamado',
    description:
      'Lista de seguidores e se o usuário da sessão é um deles. Quem segue recebe os eventos cujo público inclui `followers` no catálogo. Acesso: quem pode ver o chamado.',
    params: TICKET_PARAM,
    responses: {
      200: { description: 'Seguidores.', schema: SdTicketFollowersDTO },
    },
    errors: TICKET_ERRORS,
  },
  {
    method: 'post',
    path: `${ticket}/followers`,
    tags: [NOTIFICATIONS],
    summary: 'Seguir o chamado',
    description:
      'Sempre em nome do usuário da sessão (não dá para inscrever outra pessoa — para isso existem os participantes). Idempotente: seguir de novo não duplica nem gera evento de rastreabilidade.',
    consent: true,
    params: TICKET_PARAM,
    body: undefined,
    responses: {
      200: {
        description: 'Seguidores após a mudança.',
        schema: SdTicketFollowersDTO,
      },
    },
    errors: TICKET_ERRORS,
  },
  {
    method: 'delete',
    path: `${ticket}/followers`,
    tags: [NOTIFICATIONS],
    summary: 'Parar de seguir o chamado',
    description:
      'Idempotente: parar de seguir o que não seguia não é erro. Também sempre em nome do usuário da sessão.',
    consent: true,
    params: TICKET_PARAM,
    responses: {
      200: {
        description: 'Seguidores após a mudança.',
        schema: SdTicketFollowersDTO,
      },
    },
    errors: TICKET_ERRORS,
  },
]
