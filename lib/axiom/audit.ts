import { logger } from '@/lib/axiom/logger'

type AuditEntity =
  | 'user'
  | 'session'
  | 'workspace'
  | 'subscription'
  | 'incident'
  | 'status_check'
  | 'storage_object'
  | 'short_link'
  | 'sticky_note'
  | 'consent'
  | 'project'
  | 'user_preference'
  | 'notification_setting'
  | 'invitation'
  | 'workspace_module_connection'
  | 'whatsapp_connection'
  | 'whatsapp_contact'
  | 'whatsapp_conversation'
  | 'whatsapp_message'
  | 'whatsapp_quick_reply'
  | 'whatsapp_broadcast_list'
  | 'whatsapp_template'
  | 'whatsapp_ai_config'
  | 'whatsapp_group'
  | 'whatsapp_group_message'
  | 'crm_company'
  | 'crm_person'
  | 'crm_pipeline'
  | 'crm_pipeline_stage'
  | 'crm_product'
  | 'crm_opportunity'
  | 'crm_opportunity_line_item'
  | 'crm_lead'
  | 'crm_lead_scoring_rule'
  | 'crm_lead_routing_rule'
  | 'crm_custom_field_definition'
  | 'crm_task'
  | 'crm_note'
  | 'crm_quota'
  | 'crm_report'
  | 'crm_dashboard'
  | 'crm_dashboard_widget'
  | 'crm_proposal'
  | 'crm_form'

type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'activate'
  | 'cancel'
  | 'upload'
  | 'aggregate'
  | 'prune'
  | 'grant'
  | 'revoke'
  | 'export_requested'
  | 'export_completed'
  | 'archive'
  | 'test'
  | 'restore'
  | 'onboarding_step_completed'
  | 'onboarding_role_saved'
  | 'onboarding_goals_saved'
  | 'onboarding_profile_saved'
  | 'onboarding_step_reverted'
  | 'accept'
  | 'send'
  | 'assign'
  | 'sync'
  | 'start'
  | 'connect'
  | 'disconnect'

type AuditOutcome = 'success' | 'failure'

type AuditAuthEvent =
  | 'user.created'
  | 'user.email_verified'
  | 'user.deletion_canceled_on_login'
  | 'user.deletion_cancel_failed'
  | 'session.created'
  | 'session.revoked'
  | 'auth.email_otp.requested'
  | 'auth.email_otp.send_failed'
  | 'auth.reset_password.requested'
  | 'auth.reset_password.send_failed'
  | 'auth.reset_password.completed'
  | 'auth.2fa_otp.send_failed'
  | 'auth.welcome_email.send_failed'
  | 'auth.sign_in.success'
  | 'auth.sign_in.failure'
  | 'auth.sign_out'

interface AuditMutationInput {
  entity: AuditEntity
  action: AuditAction
  actorId: string | null
  targetId?: string | null
  outcome?: AuditOutcome
  reason?: string
  meta?: Record<string, unknown>
}

interface AuditAuthInput {
  event: AuditAuthEvent
  userId?: string | null
  outcome?: AuditOutcome
  reason?: string
  meta?: Record<string, unknown>
}

export function auditMutation(input: AuditMutationInput): void {
  const outcome = input.outcome ?? 'success'
  const fields = {
    category: 'audit',
    auditType: 'mutation',
    entity: input.entity,
    action: input.action,
    actorId: input.actorId,
    targetId: input.targetId ?? null,
    outcome,
    reason: input.reason,
    timestamp: new Date().toISOString(),
    ...(input.meta ?? {}),
  }
  if (outcome === 'failure') {
    logger.warn(`audit.mutation.${input.entity}.${input.action}`, fields)
  } else {
    logger.info(`audit.mutation.${input.entity}.${input.action}`, fields)
  }
}

export function auditAuth(input: AuditAuthInput): void {
  const outcome = input.outcome ?? 'success'
  const fields = {
    category: 'audit',
    auditType: 'auth',
    event: input.event,
    actorId: input.userId ?? null,
    outcome,
    reason: input.reason,
    timestamp: new Date().toISOString(),
    ...(input.meta ?? {}),
  }
  if (outcome === 'failure') {
    logger.warn(`audit.auth.${input.event}`, fields)
  } else {
    logger.info(`audit.auth.${input.event}`, fields)
  }
}

type AuditAccessEvent = 'consent.gate.blocked'

interface AuditAccessInput {
  event: AuditAccessEvent
  actorId: string | null
  resource: string
  reason: 'CONSENT_MISSING' | 'USER_LOOKUP_FAILED'
  meta?: Record<string, unknown>
}

export function auditAccess(input: AuditAccessInput): void {
  logger.warn(`audit.access.${input.event}`, {
    category: 'audit',
    auditType: 'access',
    event: input.event,
    actorId: input.actorId,
    resource: input.resource,
    reason: input.reason,
    timestamp: new Date().toISOString(),
    ...(input.meta ?? {}),
  })
}
