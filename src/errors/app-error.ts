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
