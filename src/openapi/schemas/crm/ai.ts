import { z } from 'zod'
import { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'
import { dto } from '../../common'

/** DTOs do assistente de IA e do Hook Vault (`types/crm-ai.d.ts`, `types/crm-hook-vault.d.ts`). */

const dateTime = () => z.iso.datetime()

export const CrmAiConversationDTO = dto(
  'CrmAiConversation',
  z
    .object({
      id: z.string().meta({ example: 'ckw1aicv0000ab7d3k1e5xyz' }),
      workspaceId: z.string(),
      userId: z
        .string()
        .meta({ description: 'Dono da conversa (conversas são pessoais).' }),
      title: z.string().nullable(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({ description: 'Conversa com o assistente de IA do CRM.' }),
)

export const CrmAiAttachmentDTO = dto(
  'CrmAiAttachment',
  z.object({
    id: z.string(),
    conversationId: z.string(),
    messageId: z.string().nullable().meta({
      description:
        '`null` até o anexo ser enviado numa mensagem (`attachmentIds`).',
    }),
    kind: z.enum(['IMAGE', 'DOCUMENT']),
    filename: z.string().meta({ example: 'print.png' }),
    contentType: z.string().meta({ example: 'image/png' }),
    sizeBytes: z.number().int(),
    createdAt: dateTime(),
    url: z.string().nullable().meta({
      description: 'URL assinada de download (expira em 15 minutos).',
    }),
  }),
)

export const CrmAiMessageDTO = dto(
  'CrmAiMessage',
  z.object({
    id: z.string(),
    conversationId: z.string(),
    role: z.enum(['USER', 'ASSISTANT']),
    content: z
      .string()
      .meta({ example: 'Quantos leads entraram esta semana?' }),
    createdAt: dateTime(),
    attachments: z.array(CrmAiAttachmentDTO).optional(),
  }),
)

export const CrmHookVaultItemDTO = dto(
  'CrmHookVaultItem',
  z
    .object({
      id: z.string(),
      text: z.string().meta({
        example: 'Você está perdendo leads por um motivo simples…',
      }),
      platform: z.enum(CRM_SOCIAL_PLATFORMS).nullable(),
      usageCount: z.number().int(),
      notes: z.string().nullable(),
      workspaceId: z.string(),
      createdById: z.string(),
      updatedById: z.string().nullable(),
      position: z.number(),
      createdAt: dateTime(),
      updatedAt: dateTime(),
    })
    .meta({
      description:
        'Gancho (hook) de conteúdo salvo no Hook Vault para reutilizar em posts.',
    }),
)
