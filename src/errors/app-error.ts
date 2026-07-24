import type { ErrorCode } from './codes'

export interface AppError {
  readonly code: ErrorCode
  readonly message: string
  readonly details?: unknown
}

export const appError = (
  code: ErrorCode,
  message: string,
  details?: unknown,
): AppError => ({
  code,
  message,
  ...(details !== undefined && { details }),
})

export const unauthorized = (message = 'Não autorizado'): AppError =>
  appError('UNAUTHORIZED', message)

export const invalidCredentials = (
  message = 'Credenciais inválidas',
): AppError => appError('INVALID_CREDENTIALS', message)

export const forbidden = (message = 'Permissão insuficiente'): AppError =>
  appError('FORBIDDEN', message)

export const notFound = (resource: string): AppError =>
  appError('RESOURCE_NOT_FOUND', `${resource} not found`)

export const conflict = (message: string): AppError =>
  appError('CONFLICT', message)

export const usernameConflict = (
  message = 'Username já está em uso',
): AppError => appError('USERNAME_CONFLICT', message)

export const validationError = (message: string, details?: unknown): AppError =>
  appError('VALIDATION_ERROR', message, details)

export const badRequest = (message: string): AppError =>
  appError('BAD_REQUEST', message)

export const databaseError = (message = 'Database error'): AppError =>
  appError('DATABASE_ERROR', message)

export const rateLimited = (
  retryAfterSeconds: number,
  message = 'Muitas requisições',
): AppError => appError('RATE_LIMITED', message, { retryAfterSeconds })

export const projectNotFound = (): AppError =>
  appError('PROJECT_NOT_FOUND', 'Project not found')

export const projectForbidden = (
  message = 'Sem acesso a este projeto',
): AppError => appError('PROJECT_FORBIDDEN', message)

export const projectSlugConflict = (
  message = 'Slug já está em uso neste workspace',
): AppError => appError('PROJECT_SLUG_CONFLICT', message)

export const storageError = (
  message = 'Falha ao armazenar o arquivo',
): AppError => appError('STORAGE_ERROR', message)
export const invitationNotFound = (): AppError =>
  appError('INVITATION_NOT_FOUND', 'Convite não encontrado')

export const invitationNotPending = (
  message = 'Este convite não está mais disponível',
): AppError => appError('INVITATION_NOT_PENDING', message)

export const invitationExpired = (message = 'Este convite expirou'): AppError =>
  appError('INVITATION_EXPIRED', message)

export const invitationEmailMismatch = (
  message = 'Este convite foi enviado para outro e-mail',
): AppError => appError('INVITATION_EMAIL_MISMATCH', message)

export const invitationDuplicate = (
  message = 'Já existe um convite pendente para este e-mail',
): AppError => appError('INVITATION_DUPLICATE', message)

export const invitationAlreadyMember = (
  message = 'Este usuário já é membro do workspace',
): AppError => appError('INVITATION_ALREADY_MEMBER', message)

export const projectMemberAlreadyExists = (
  message = 'Usuário já é membro deste projeto',
): AppError => appError('PROJECT_MEMBER_ALREADY_EXISTS', message)

export const projectMemberNotFound = (
  message = 'Membro não encontrado neste projeto',
): AppError => appError('PROJECT_MEMBER_NOT_FOUND', message)

export const projectMemberNotInWorkspace = (
  message = 'Usuário não pertence a este workspace',
): AppError => appError('PROJECT_MEMBER_NOT_IN_WORKSPACE', message)

export const seatLimitReached = (
  message = 'Limite de assentos do plano atingido',
): AppError => appError('SEAT_LIMIT_REACHED', message)

export const featureNotInPlan = (
  message = 'Recurso não disponível no plano atual',
): AppError => appError('FEATURE_NOT_IN_PLAN', message)

export const paymentError = (
  message = 'Falha ao processar o pagamento',
): AppError => appError('PAYMENT_ERROR', message)

export const mailError = (
  message = 'Não foi possível enviar sua mensagem',
): AppError => appError('MAIL_ERROR', message)

export const couponInvalid = (
  message = 'Cupom inválido ou expirado',
): AppError => appError('COUPON_INVALID', message)

export const connectionNotFound = (): AppError =>
  appError('CONNECTION_NOT_FOUND', 'Conexão não encontrada')

export const connectionForbidden = (
  message = 'Apenas OWNER ou ADMIN podem gerenciar conexões',
): AppError => appError('CONNECTION_FORBIDDEN', message)

export const connectionTestFailed = (
  message = 'Não foi possível conectar ao banco de dados informado',
): AppError => appError('CONNECTION_TEST_FAILED', message)

export const whatsappConnectionNotFound = (): AppError =>
  appError(
    'WHATSAPP_CONNECTION_NOT_FOUND',
    'Conexão do WhatsApp não encontrada',
  )

export const whatsappConnectionConflict = (
  message = 'Já existe uma conexão com este número neste workspace',
): AppError => appError('WHATSAPP_CONNECTION_CONFLICT', message)

export const whatsappContactNotFound = (): AppError =>
  appError('WHATSAPP_CONTACT_NOT_FOUND', 'Contato não encontrado')

export const whatsappConversationNotFound = (): AppError =>
  appError('WHATSAPP_CONVERSATION_NOT_FOUND', 'Conversa não encontrada')

export const whatsappMessageNotFound = (): AppError =>
  appError('WHATSAPP_MESSAGE_NOT_FOUND', 'Mensagem não encontrada')

export const whatsappConversationAiHandling = (
  message = 'A IA está atendendo esta conversa. Remova-a do atendimento da IA para enviar mensagens.',
): AppError => appError('WHATSAPP_CONVERSATION_AI_HANDLING', message)

export const whatsappQuickReplyNotFound = (): AppError =>
  appError('WHATSAPP_QUICK_REPLY_NOT_FOUND', 'Mensagem rápida não encontrada')

export const whatsappQuickReplyConflict = (
  message = 'Já existe uma mensagem rápida com este atalho',
): AppError => appError('WHATSAPP_QUICK_REPLY_CONFLICT', message)

export const whatsappTemplateNotFound = (): AppError =>
  appError('WHATSAPP_TEMPLATE_NOT_FOUND', 'Template não encontrado')

export const whatsappTemplateNotApproved = (): AppError =>
  appError(
    'WHATSAPP_TEMPLATE_NOT_APPROVED',
    'Este template ainda não foi aprovado pela Meta',
  )

export const whatsappBroadcastNotFound = (): AppError =>
  appError(
    'WHATSAPP_BROADCAST_NOT_FOUND',
    'Lista de transmissão não encontrada',
  )

export const whatsappBroadcastLocked = (
  message = 'Esta lista de transmissão já foi iniciada e não pode ser editada',
): AppError => appError('WHATSAPP_BROADCAST_LOCKED', message)

export const whatsappAiConfigNotFound = (): AppError =>
  appError(
    'WHATSAPP_AI_CONFIG_NOT_FOUND',
    'Configuração de IA não encontrada para este workspace',
  )

export const whatsappProviderError = (
  message = 'Falha ao comunicar com o provedor do WhatsApp',
): AppError => appError('WHATSAPP_PROVIDER_ERROR', message)

export const whatsappWebhookUnauthorized = (): AppError =>
  appError('WHATSAPP_WEBHOOK_UNAUTHORIZED', 'Assinatura do webhook inválida')

export const whatsappGroupNotFound = (): AppError =>
  appError('WHATSAPP_GROUP_NOT_FOUND', 'Grupo não encontrado')

export const whatsappGroupMessageNotFound = (): AppError =>
  appError(
    'WHATSAPP_GROUP_MESSAGE_NOT_FOUND',
    'Mensagem do grupo não encontrada',
  )

export const whatsappGroupProviderUnsupported = (): AppError =>
  appError(
    'WHATSAPP_GROUP_PROVIDER_UNSUPPORTED',
    'Grupos só são suportados em conexões Z-API — a API oficial da Meta não expõe esse recurso',
  )

export const whatsappContactPhotoUnavailable = (
  message = 'Buscar foto de perfil exige uma conexão Z-API — a API oficial da Meta não expõe fotos de contato',
): AppError => appError('WHATSAPP_CONTACT_PHOTO_UNAVAILABLE', message)

export const crmCompanyNotFound = (): AppError =>
  appError('CRM_COMPANY_NOT_FOUND', 'Empresa não encontrada')

export const crmCompanyConflict = (
  message = 'Já existe uma empresa com este domínio ou CNPJ neste workspace',
): AppError => appError('CRM_COMPANY_CONFLICT', message)

export const crmPersonNotFound = (): AppError =>
  appError('CRM_PERSON_NOT_FOUND', 'Pessoa não encontrada')

export const crmPipelineNotFound = (): AppError =>
  appError('CRM_PIPELINE_NOT_FOUND', 'Pipeline não encontrado')

export const crmPipelineStageNotFound = (): AppError =>
  appError('CRM_PIPELINE_STAGE_NOT_FOUND', 'Etapa do pipeline não encontrada')

export const crmPipelineStageInUse = (
  message = 'Esta etapa possui oportunidades vinculadas e não pode ser removida',
): AppError => appError('CRM_PIPELINE_STAGE_IN_USE', message)

export const crmProductNotFound = (): AppError =>
  appError('CRM_PRODUCT_NOT_FOUND', 'Produto não encontrado')

export const crmProductConflict = (
  message = 'Já existe um produto com este SKU neste workspace',
): AppError => appError('CRM_PRODUCT_CONFLICT', message)

export const crmOpportunityNotFound = (): AppError =>
  appError('CRM_OPPORTUNITY_NOT_FOUND', 'Oportunidade não encontrada')

export const crmOpportunityLineItemNotFound = (): AppError =>
  appError(
    'CRM_OPPORTUNITY_LINE_ITEM_NOT_FOUND',
    'Item da oportunidade não encontrado',
  )

export const crmLeadNotFound = (): AppError =>
  appError('CRM_LEAD_NOT_FOUND', 'Lead não encontrado')

export const crmLeadAlreadyConverted = (
  message = 'Este lead já foi convertido',
): AppError => appError('CRM_LEAD_ALREADY_CONVERTED', message)

export const crmLeadScoringRuleNotFound = (): AppError =>
  appError(
    'CRM_LEAD_SCORING_RULE_NOT_FOUND',
    'Regra de pontuação não encontrada',
  )

export const crmLeadRoutingRuleNotFound = (): AppError =>
  appError(
    'CRM_LEAD_ROUTING_RULE_NOT_FOUND',
    'Regra de roteamento não encontrada',
  )

export const crmCustomFieldNotFound = (): AppError =>
  appError('CRM_CUSTOM_FIELD_NOT_FOUND', 'Campo customizado não encontrado')

export const crmCustomFieldConflict = (
  message = 'Já existe um campo customizado com esta chave para esta entidade',
): AppError => appError('CRM_CUSTOM_FIELD_CONFLICT', message)

export const crmCustomFieldInvalid = (message: string): AppError =>
  appError('CRM_CUSTOM_FIELD_INVALID', message)

export const crmTaskNotFound = (): AppError =>
  appError('CRM_TASK_NOT_FOUND', 'Tarefa não encontrada')

export const crmNoteNotFound = (): AppError =>
  appError('CRM_NOTE_NOT_FOUND', 'Nota não encontrada')

export const crmQuotaNotFound = (): AppError =>
  appError('CRM_QUOTA_NOT_FOUND', 'Meta não encontrada')

export const crmQuotaConflict = (
  message = 'Já existe uma meta para este responsável neste período',
): AppError => appError('CRM_QUOTA_CONFLICT', message)

export const crmReportNotFound = (): AppError =>
  appError('CRM_REPORT_NOT_FOUND', 'Relatório não encontrado')

export const crmReportInvalidSource = (
  message = 'Fonte de dados do relatório não suportada',
): AppError => appError('CRM_REPORT_INVALID_SOURCE', message)

export const crmDashboardNotFound = (): AppError =>
  appError('CRM_DASHBOARD_NOT_FOUND', 'Dashboard não encontrado')

export const crmDashboardWidgetNotFound = (): AppError =>
  appError('CRM_DASHBOARD_WIDGET_NOT_FOUND', 'Widget não encontrado')

export const crmProposalNotFound = (): AppError =>
  appError('CRM_PROPOSAL_NOT_FOUND', 'Proposta não encontrada')

export const crmFormNotFound = (): AppError =>
  appError('CRM_FORM_NOT_FOUND', 'Formulário não encontrado')

export const crmFormNotPublished = (): AppError =>
  appError('CRM_FORM_NOT_PUBLISHED', 'Este formulário não está publicado')

export const crmAiConversationNotFound = (): AppError =>
  appError('CRM_AI_CONVERSATION_NOT_FOUND', 'Conversa não encontrada')

export const crmAiNotConfigured = (): AppError =>
  appError(
    'CRM_AI_NOT_CONFIGURED',
    'Assistente de IA não configurado neste ambiente (OPENAI_API_KEY ausente)',
  )

export const crmIntegrationKeyNotFound = (): AppError =>
  appError(
    'CRM_INTEGRATION_KEY_NOT_FOUND',
    'Chave de integração não encontrada',
  )

export const crmIntegrationKeyInvalid = (): AppError =>
  appError('CRM_INTEGRATION_KEY_INVALID', 'Chave de API inválida ou revogada')

export const crmEmailTemplateNotFound = (): AppError =>
  appError('CRM_EMAIL_TEMPLATE_NOT_FOUND', 'Template não encontrado')

export const crmEmailCampaignNotFound = (): AppError =>
  appError('CRM_EMAIL_CAMPAIGN_NOT_FOUND', 'Campanha não encontrada')

export const crmEmailCampaignAlreadySent = (
  message = 'Esta campanha já foi enviada ou está em envio',
): AppError => appError('CRM_EMAIL_CAMPAIGN_ALREADY_SENT', message)

export const crmMailingListNotFound = (): AppError =>
  appError('CRM_MAILING_LIST_NOT_FOUND', 'Lista de e-mail não encontrada')

export const crmMailingListMemberConflict = (
  message = 'Este e-mail já está nesta lista',
): AppError => appError('CRM_MAILING_LIST_MEMBER_CONFLICT', message)

export const crmWorkflowNotFound = (): AppError =>
  appError('CRM_WORKFLOW_NOT_FOUND', 'Workflow não encontrado')

export const crmWorkflowNotActive = (): AppError =>
  appError(
    'CRM_WORKFLOW_NOT_ACTIVE',
    'Workflow precisa estar ativo para ser disparado por webhook',
  )

export const crmWorkflowVersionNotFound = (): AppError =>
  appError(
    'CRM_WORKFLOW_VERSION_NOT_FOUND',
    'Versão do workflow não encontrada',
  )

export const crmWorkflowVersionNotDraft = (): AppError =>
  appError(
    'CRM_WORKFLOW_VERSION_NOT_DRAFT',
    'Workflow não tem um draft editável',
  )

export const crmWorkflowInvalidDefinition = (
  message = 'Definição de workflow inválida',
  details?: unknown,
): AppError => appError('CRM_WORKFLOW_INVALID_DEFINITION', message, details)

export const crmWorkflowExecutionFailed = (
  message = 'Falha ao executar o workflow',
  details?: unknown,
): AppError => appError('CRM_WORKFLOW_EXECUTION_FAILED', message, details)

export const crmWorkflowWebhookInvalid = (): AppError =>
  appError(
    'CRM_WORKFLOW_WEBHOOK_INVALID',
    'Webhook inválido ou workflow inativo',
  )

export const crmLandingPageNotFound = (): AppError =>
  appError('CRM_LANDING_PAGE_NOT_FOUND', 'Landing page não encontrada')

export const crmSocialConnectionNotFound = (): AppError =>
  appError('CRM_SOCIAL_CONNECTION_NOT_FOUND', 'Conexão social não encontrada')

export const crmSocialConnectionConflict = (): AppError =>
  appError(
    'CRM_SOCIAL_CONNECTION_CONFLICT',
    'Já existe uma conexão para esta plataforma neste workspace',
  )

export const crmSocialOauthFailed = (): AppError =>
  appError('CRM_SOCIAL_OAUTH_FAILED', 'Falha ao conectar com a plataforma')

export const crmSocialStateInvalid = (): AppError =>
  appError(
    'CRM_SOCIAL_STATE_INVALID',
    'Solicitação de conexão inválida ou expirada',
  )

export const crmSocialNotConfigured = (): AppError =>
  appError(
    'CRM_SOCIAL_NOT_CONFIGURED',
    'Plataforma não configurada no servidor',
  )

export const crmSocialNoPage = (): AppError =>
  appError(
    'CRM_SOCIAL_NO_PAGE',
    'Nenhuma Página do Facebook disponível para esta conta',
  )

export const crmSocialIgNotLinked = (): AppError =>
  appError(
    'CRM_SOCIAL_IG_NOT_LINKED',
    'Nenhuma conta do Instagram vinculada a uma Página do Facebook',
  )

export const crmSocialTokenExpired = (): AppError =>
  appError(
    'CRM_SOCIAL_TOKEN_EXPIRED',
    'A conexão expirou — reconecte a conta para continuar',
  )

export const crmSocialScopeMissing = (): AppError =>
  appError(
    'CRM_SOCIAL_SCOPE_MISSING',
    'A conexão não concedeu a permissão necessária — reconecte a conta',
  )

export const crmScheduledPostNotFound = (): AppError =>
  appError('CRM_SCHEDULED_POST_NOT_FOUND', 'Post agendado não encontrado')

export const crmScheduledPostAlreadyPublished = (): AppError =>
  appError('CRM_SCHEDULED_POST_ALREADY_PUBLISHED', 'Este post já foi publicado')

export const crmEmailAccountNotFound = (): AppError =>
  appError('CRM_EMAIL_ACCOUNT_NOT_FOUND', 'Conta de e-mail não encontrada')

export const crmEmailAccountConflict = (): AppError =>
  appError(
    'CRM_EMAIL_ACCOUNT_CONFLICT',
    'Já existe uma conta deste provedor para este usuário neste workspace',
  )

export const crmEmailMessageNotFound = (): AppError =>
  appError('CRM_EMAIL_MESSAGE_NOT_FOUND', 'E-mail não encontrado')

export const crmCalendarEventNotFound = (): AppError =>
  appError('CRM_CALENDAR_EVENT_NOT_FOUND', 'Evento não encontrado')

export const crmAiAttachmentNotFound = (): AppError =>
  appError('CRM_AI_ATTACHMENT_NOT_FOUND', 'Anexo não encontrado')

export const profileNotFound = (): AppError =>
  appError('PROFILE_NOT_FOUND', 'Perfil não encontrado')

export const profileNameTaken = (): AppError =>
  appError('PROFILE_NAME_TAKEN', 'Já existe um perfil com esse nome')

export const profileSystemProtected = (): AppError =>
  appError(
    'PROFILE_SYSTEM_PROTECTED',
    'Perfis de sistema não podem ser alterados',
  )

export const profileInUse = (): AppError =>
  appError('PROFILE_IN_USE', 'Perfil em uso por membros do workspace')

export const crmHookVaultItemNotFound = (): AppError =>
  appError('CRM_HOOK_VAULT_ITEM_NOT_FOUND', 'Hook não encontrado')

export const crmTrackedCompetitorNotFound = (): AppError =>
  appError('CRM_TRACKED_COMPETITOR_NOT_FOUND', 'Concorrente não encontrado')
