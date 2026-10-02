import { logger } from '@/lib/axiom/logger'

export type AuditEntity =
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
  | 'workspace_module_access'
  | 'workspace_feature_override'
  | 'changelog'
  | 'whatsapp_connection'
  | 'whatsapp_contact'
  | 'whatsapp_conversation'
  | 'whatsapp_message'
  | 'whatsapp_quick_reply'
  | 'whatsapp_broadcast_list'
  | 'whatsapp_template'
  | 'whatsapp_ai_config'
  | 'whatsapp_settings'
  | 'notification'
  | 'whatsapp_ai_knowledge_document'
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
  | 'crm_settings'
  | 'crm_custom_field_definition'
  | 'crm_task'
  | 'crm_note'
  | 'crm_quota'
  | 'crm_report'
  | 'crm_dashboard'
  | 'crm_dashboard_widget'
  | 'crm_proposal'
  | 'crm_proposal_template'
  | 'crm_form'
  | 'crm_ai_conversation'
  | 'crm_integration_api_key'
  | 'crm_email_template'
  | 'crm_email_campaign'
  | 'crm_email_opt_out'
  | 'crm_mailing_list'
  | 'crm_workflow'
  | 'crm_landing_page'
  | 'crm_social_connection'
  | 'crm_scheduled_post'
  | 'crm_email_account'
  | 'crm_email_message'
  | 'crm_calendar_event'
  | 'crm_ai_attachment'
  | 'crm_hook_vault_item'
  | 'crm_tracked_competitor'
  | 'backup'
  | 'workspace_ai_settings'
  | 'user_ai_preference'
  | 'sd_kb_article'
  | 'sd_kb_comment'
  | 'sd_kb_review'
  | 'sd_ticket_kb_link'
  // ServiceDesk — configuração
  | 'sd_settings'
  | 'sd_department'
  | 'sd_department_member'
  | 'sd_category'
  | 'sd_classification'
  | 'sd_priority_scale'
  | 'sd_priority_matrix'
  | 'sd_phase'
  | 'sd_phase_transition'
  | 'sd_business_calendar'
  | 'sd_sla_policy'
  | 'sd_escalation_rule'
  | 'sd_automation_rule'
  | 'sd_custom_field_definition'
  | 'sd_ticket_template'
  | 'sd_canned_response'
  | 'sd_part'
  | 'sd_seed'
  // ServiceDesk — chamados
  | 'sd_ticket'
  | 'sd_ticket_csat'
  | 'sd_saved_view'
  | 'sd_customer'
  | 'sd_contact'
  | 'sd_config_item'
  | 'sd_config_item_type'
  // ServiceDesk — abas do chamado
  | 'sd_ticket_message'
  | 'sd_ticket_attachment'
  | 'sd_ticket_task'
  | 'sd_ticket_cost'
  | 'sd_ticket_part'
  | 'sd_ticket_approval'
  | 'sd_ticket_signature'
  // ServiceDesk — central de notificações
  | 'sd_notification_preference'
  | 'sd_ticket_follower'
  // ServiceDesk — portal do contato externo (link mágico)
  | 'sd_portal_access'
  | 'sd_portal_session'
  // ServiceDesk — WhatsApp e IA
  | 'sd_ai_conversation'
  // ServiceDesk — canais de entrada
  | 'sd_monitor_source'
  | 'sd_monitor_alert'
  // ServiceDesk — canal de e-mail
  | 'sd_mailbox'
  // ServiceDesk — plantão (on-call)
  | 'sd_oncall_schedule'
  | 'sd_oncall_override'
  // ServiceDesk — chamados recorrentes (manutenção preventiva)
  | 'sd_recurring_ticket'
  // ServiceDesk — calendário de mudanças e comitê (CAB)
  | 'sd_change_window'
  | 'sd_cab_board'
  | 'sd_approval_round'
  // ServiceDesk — risco preditivo e incidentes repetidos
  | 'sd_incident_cluster'
  // ServiceDesk — integrações (Slack e GitHub)
  | 'sd_integration'
  | 'sd_integration_link'
  // ServiceDesk — contratos e apontamento de horas
  | 'sd_contract'
  | 'sd_contract_period'
  | 'sd_time_entry'
  // ServiceDesk — relatórios de SLA agendados
  | 'sd_scheduled_report'

export type AuditAction =
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
  | 'opt_out'
  | 'opt_in'
  | 'close'
  | 'reopen'
  | 'alert'
  | 'suspend'
  | 'reactivate'
  | 'download'
  | 'move'
  | 'publish'
  | 'unpublish'
  | 'resolve'
  | 'unresolve'
  | 'escalate'
  | 'respond'
  | 'sign'
  | 'reorder'
  | 'verify'
  | 'link'
  | 'unlink'
  | 'request'

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
  // Concessão OAuth do app do Slack para um workspace (ServiceDesk).
  | 'auth.oauth_grant.servicedesk_slack'

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
