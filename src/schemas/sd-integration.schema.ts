import z from 'zod'
import { SD_SLACK_TICKET_TYPES } from '@/src/lib/servicedesk/integrations'
import { sdId } from './sd-config.schema'

/**
 * ServiceDesk side of the integrations: the module settings of the
 * workspace-level connections (ADR 0024), the ticket ↔ issue/PR/MR links and
 * the public webhooks. Connecting, rotating tokens and the Slack
 * notification rules live in `workspace-integration.schema.ts`.
 */

export const SdIntegrationKindEnum = z.enum(['SLACK', 'GITHUB', 'GITLAB'])
export type SdIntegrationKindInput = z.infer<typeof SdIntegrationKindEnum>

export const SdRepoProviderEnum = z.enum(['GITHUB', 'GITLAB'])

export const SdIntegrationLinkKindEnum = z.enum([
  'SLACK_THREAD',
  'GITHUB_ISSUE',
  'GITHUB_PULL_REQUEST',
  'GITLAB_ISSUE',
  'GITLAB_MERGE_REQUEST',
])

const slackChannelId = z
  .string()
  .trim()
  .min(1, 'Informe o canal')
  .max(64, 'Canal inválido')
  .regex(/^[A-Za-z0-9._-]+$/, 'Canal inválido')

/** Team → channel (the default channel now lives in the workspace rules). */
export const SdSlackChannelMapSchema = z.object({
  departmentId: sdId,
  channelId: slackChannelId,
  channelName: z.string().trim().max(120).nullable().default(null),
})
export type SdSlackChannelMapDTO = z.infer<typeof SdSlackChannelMapSchema>

export const SdSlackChannelsSchema = z
  .array(SdSlackChannelMapSchema)
  .max(60, 'Até 60 canais')
  .refine(
    (rows) => new Set(rows.map((r) => r.departmentId)).size === rows.length,
    {
      message: 'Há mais de um canal para o mesmo time',
    },
  )

export const UpdateSdSlackConfigSchema = z
  .object({
    channels: SdSlackChannelsSchema.optional(),
    allowTicketFromMessage: z.boolean().optional(),
    mirrorThreadReplies: z.boolean().optional(),
    ticketType: z.enum(SD_SLACK_TICKET_TYPES).optional(),
    departmentId: sdId.nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdSlackConfigDTO = z.infer<typeof UpdateSdSlackConfigSchema>

/** ServiceDesk settings of a GitHub/GitLab connection. */
export const UpdateSdRepoConfigSchema = z
  .object({
    suggestPhaseOnClose: z.boolean().optional(),
    allowIssueFromTicket: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateSdRepoConfigDTO = z.infer<typeof UpdateSdRepoConfigSchema>

export const ListSdIntegrationLinksSchema = z.object({
  ticketId: sdId,
})
export type ListSdIntegrationLinksDTO = z.infer<
  typeof ListSdIntegrationLinksSchema
>

/**
 * Link an existing item: number, `owner/repo#n`, `group/project!n` or the
 * URL. Without `provider` it is inferred from the reference (GitLab sigil or
 * URL, github.com URL) or from the only connected repository.
 */
export const LinkSdGithubItemSchema = z.object({
  ticketId: sdId,
  ref: z.string().trim().min(1, 'Informe a issue ou o pull request').max(255),
  provider: SdRepoProviderEnum.optional(),
})
export type LinkSdGithubItemDTO = z.infer<typeof LinkSdGithubItemSchema>

/** Open an issue from the ticket (provider comes from the route). */
export const CreateSdGithubIssueSchema = z.object({
  ticketId: sdId,
  /** Overrides the title built from the ticket. */
  title: z.string().trim().min(1).max(255).optional(),
})
export type CreateSdGithubIssueDTO = z.infer<typeof CreateSdGithubIssueSchema>
