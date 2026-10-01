import { z } from 'zod'
import { dto } from '../../common'

/**
 * DTOs da central de notificações do ServiceDesk
 * (`types/sd-notification.d.ts`).
 */

const Channel = z.enum(['IN_APP', 'EMAIL', 'WHATSAPP'])

const Audience = z.enum([
  'assignee',
  'participants',
  'followers',
  'requester',
  'contact',
  'departmentLeads',
  'mentioned',
])

const SdNotificationEventPreference = z.object({
  event: z.string().meta({ example: 'ticket.message' }),
  label: z.string().meta({ example: 'Nova mensagem no chamado' }),
  description: z.string(),
  audience: z.array(Audience).meta({
    description: 'Quem o evento avisa, pelo catálogo do módulo.',
  }),
  agentOnly: z.boolean().meta({
    description: 'Evento de agente: nunca chega a solicitante ou contato.',
  }),
  channels: z.array(Channel).meta({
    description: 'Canais que este evento oferece.',
  }),
  defaultChannels: z.array(Channel).meta({
    description: 'Canais ligados quando o usuário não escolheu nada.',
  }),
  enabledChannels: z.array(Channel).meta({
    description: 'Canais ligados agora (padrão + o que o usuário salvou).',
  }),
  customized: z.boolean().meta({
    description: 'Há ao menos uma preferência salva para o evento.',
  }),
})

export const SdNotificationPreferencesDTO = dto(
  'SdNotificationPreferences',
  z.object({
    isAgent: z.boolean().meta({
      description: 'Solicitante não recebe os eventos `agentOnly`.',
    }),
    whatsappAvailable: z.boolean().meta({
      description:
        'O workspace tem conexão de WhatsApp do ServiceDesk ativa (senão o canal fica inerte).',
    }),
    groups: z.array(
      z.object({
        label: z.string().meta({ example: 'Conversas' }),
        events: z.array(SdNotificationEventPreference),
      }),
    ),
  }),
)

export const SdTicketFollowersDTO = dto(
  'SdTicketFollowers',
  z.object({
    items: z.array(
      z.object({
        userId: z.string(),
        name: z.string(),
        email: z.string(),
        image: z.string().nullable(),
        followedAt: z.iso.datetime(),
      }),
    ),
    following: z.boolean().meta({
      description: 'O usuário da sessão está na lista.',
    }),
  }),
)
