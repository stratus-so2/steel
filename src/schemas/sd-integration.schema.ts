import z from 'zod'
import { SD_SLACK_TICKET_TYPES } from '@/src/lib/servicedesk/integrations'
import { sdId } from './sd-config.schema'

/**
 * Integrações do ServiceDesk (Slack e GitHub): configuração do admin, vínculo
 * de issue/PR com o chamado e o que chega pelos webhooks públicos.
 *
 * Tokens e segredos **só entram** (nunca saem): o DTO de leitura não tem
 * campo para eles, nem mascarado.
 */

export const SdIntegrationKindEnum = z.enum(['SLACK', 'GITHUB'])
export type SdIntegrationKindInput = z.infer<typeof SdIntegrationKindEnum>

export const SdIntegrationLinkKindEnum = z.enum([
  'SLACK_THREAD',
  'GITHUB_ISSUE',
  'GITHUB_PULL_REQUEST',
])

const slackChannelId = z
  .string()
  .trim()
  .min(1, 'Informe o canal')
  .max(64, 'Canal inválido')
  .regex(/^[A-Za-z0-9._-]+$/, 'Canal inválido')

/** Mapa departamento → canal (`departmentId: null` = canal padrão). */
export const SdSlackChannelMapSchema = z.object({
  departmentId: sdId.nullable().default(null),
  channelId: slackChannelId,
  channelName: z.string().trim().max(120).nullable().default(null),
})
export type SdSlackChannelMapDTO = z.infer<typeof SdSlackChannelMapSchema>

export const SdSlackChannelsSchema = z
  .array(SdSlackChannelMapSchema)
  .max(60, 'Até 60 canais')
  .refine(
    (rows) =>
      new Set(rows.map((r) => r.departmentId ?? '*')).size === rows.length,
    { message: 'Há mais de um canal para o mesmo time' },
  )

export const UpdateSdSlackConfigSchema = z
  .object({
    channels: SdSlackChannelsSchema.optional(),
    /** Chaves de `SD_NOTIFICATION_EVENTS` enviadas ao canal do time. */
    events: z
      .array(z.string().trim().min(1).max(80))
      .max(40, 'Até 40 eventos')
      .optional(),
    allowTicketFromMessage: z.boolean().optional(),
    mirrorThreadReplies: z.boolean().optional(),
    ticketType: z.enum(SD_SLACK_TICKET_TYPES).optional(),
    departmentId: sdId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdSlackConfigDTO = z.infer<typeof UpdateSdSlackConfigSchema>

/** Token do GitHub: PAT fine-grained (`github_pat_…`) ou clássico (`ghp_…`). */
const githubToken = z
  .string()
  .trim()
  .min(20, 'Token muito curto')
  .max(255, 'Token muito longo')

export const ConnectSdGithubSchema = z.object({
  /** `owner/repo` ou a URL do repositório. */
  repo: z.string().trim().min(3, 'Informe o repositório').max(255),
  token: githubToken,
  /** Segredo do webhook do repositório (`X-Hub-Signature-256`). */
  webhookSecret: z
    .string()
    .trim()
    .min(16, 'Use pelo menos 16 caracteres')
    .max(255)
    .nullable()
    .optional(),
  suggestPhaseOnClose: z.boolean().default(true),
  allowIssueFromTicket: z.boolean().default(true),
})
export type ConnectSdGithubDTO = z.infer<typeof ConnectSdGithubSchema>

export const UpdateSdGithubConfigSchema = z
  .object({
    /** Troca o token (o anterior é descartado). */
    token: githubToken.optional(),
    webhookSecret: z
      .string()
      .trim()
      .min(16, 'Use pelo menos 16 caracteres')
      .max(255)
      .nullable()
      .optional(),
    suggestPhaseOnClose: z.boolean().optional(),
    allowIssueFromTicket: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdGithubConfigDTO = z.infer<typeof UpdateSdGithubConfigSchema>

export const ListSdIntegrationLinksSchema = z.object({
  ticketId: sdId,
})
export type ListSdIntegrationLinksDTO = z.infer<
  typeof ListSdIntegrationLinksSchema
>

/** Vincular uma issue/PR que já existe: número, `owner/repo#n` ou URL. */
export const LinkSdGithubItemSchema = z.object({
  ticketId: sdId,
  ref: z.string().trim().min(1, 'Informe a issue ou o pull request').max(255),
})
export type LinkSdGithubItemDTO = z.infer<typeof LinkSdGithubItemSchema>

/** Abrir uma issue a partir do chamado. */
export const CreateSdGithubIssueSchema = z.object({
  ticketId: sdId,
  /** Sobrescreve o título montado a partir do chamado. */
  title: z.string().trim().min(1).max(255).optional(),
})
export type CreateSdGithubIssueDTO = z.infer<typeof CreateSdGithubIssueSchema>
