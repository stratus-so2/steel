import z from 'zod'
import {
  integrationNotificationEvent,
  MAX_WAITING_MINUTES,
  MIN_WAITING_MINUTES,
  WORKSPACE_INTEGRATION_KINDS,
} from '@/src/lib/integrations/catalog'
import { MAX_SLACK_ROUTES } from '@/src/lib/integrations/config'

/**
 * Workspace-level integrations (Ajustes > Integrações): Slack, GitHub and
 * GitLab, configured once by OWNER/ADMIN and used by every module.
 *
 * Tokens and secrets **only go in**: no read DTO has a field for them, not
 * even masked.
 */

export const WorkspaceIntegrationKindEnum = z.enum(WORKSPACE_INTEGRATION_KINDS)
export type WorkspaceIntegrationKindInput = z.infer<
  typeof WorkspaceIntegrationKindEnum
>

const slackChannelId = z
  .string()
  .trim()
  .min(1, 'Informe o canal')
  .max(64, 'Canal inválido')
  .regex(/^[A-Za-z0-9._-]+$/, 'Canal inválido')

/** One rule: event → channel (`null` = team channel, ServiceDesk only). */
export const SlackNotificationRouteSchema = z
  .object({
    event: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine((key) => integrationNotificationEvent(key) !== null, {
        message: 'Evento desconhecido',
      }),
    channelId: slackChannelId.nullable().default(null),
    channelName: z.string().trim().max(120).nullable().default(null),
  })
  .refine(
    (route) =>
      route.channelId !== null ||
      integrationNotificationEvent(route.event)?.allowsTeamChannel === true,
    { message: 'Escolha um canal para este evento', path: ['channelId'] },
  )
export type SlackNotificationRouteDTO = z.infer<
  typeof SlackNotificationRouteSchema
>

export const UpdateWorkspaceSlackSchema = z
  .object({
    routes: z
      .array(SlackNotificationRouteSchema)
      .max(MAX_SLACK_ROUTES, `Até ${MAX_SLACK_ROUTES} regras`)
      .refine(
        (rows) =>
          new Set(rows.map((r) => `${r.event}|${r.channelId ?? '*'}`)).size ===
          rows.length,
        { message: 'Há regras repetidas (mesmo evento e canal)' },
      )
      .optional(),
    waitingMinutes: z
      .number()
      .int('Informe minutos inteiros')
      .min(MIN_WAITING_MINUTES, `No mínimo ${MIN_WAITING_MINUTES} minutos`)
      .max(MAX_WAITING_MINUTES, 'No máximo 24 horas')
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateWorkspaceSlackDTO = z.infer<typeof UpdateWorkspaceSlackSchema>

/** PAT/project/group token (GitHub `github_pat_…`/`ghp_…`, GitLab `glpat-…`). */
const accessToken = z
  .string()
  .trim()
  .min(20, 'Token muito curto')
  .max(255, 'Token muito longo')

const webhookSecret = z
  .string()
  .trim()
  .min(16, 'Use pelo menos 16 caracteres')
  .max(255)
  .nullable()
  .optional()

export const ConnectGithubSchema = z.object({
  /** `owner/repo` or the repository URL. */
  repo: z.string().trim().min(3, 'Informe o repositório').max(255),
  token: accessToken,
  /** Repository webhook secret (`X-Hub-Signature-256`). */
  webhookSecret,
})
export type ConnectGithubDTO = z.infer<typeof ConnectGithubSchema>

export const ConnectGitlabSchema = z.object({
  /** Instance URL; empty = gitlab.com. HTTPS only. */
  baseUrl: z.string().trim().max(255).nullable().optional(),
  /** `group/project`, the project URL or the clone URL. */
  project: z.string().trim().min(3, 'Informe o projeto').max(255),
  token: accessToken,
  /** Project webhook "Secret token" (`X-Gitlab-Token`). */
  webhookSecret,
})
export type ConnectGitlabDTO = z.infer<typeof ConnectGitlabSchema>

/** Rotate the token and/or the webhook secret (the old one is discarded). */
export const UpdateRepoCredentialsSchema = z
  .object({
    token: accessToken.optional(),
    webhookSecret,
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Informe ao menos um campo',
  })
export type UpdateRepoCredentialsDTO = z.infer<
  typeof UpdateRepoCredentialsSchema
>
