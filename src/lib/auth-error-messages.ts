/**
 * Mensagens de erro do Better Auth em **pt-BR**.
 *
 * O cliente (`authClient`) devolve `{ code, message, status }` com a
 * mensagem em inglês ("Invalid email or password"), e as telas de entrada,
 * cadastro, recuperação de senha e 2FA mostravam esse texto cru. Aqui o
 * `code` vira uma frase em português; sem código conhecido, vale o
 * `fallback` da tela (nunca a mensagem em inglês).
 */

type AuthLikeError = {
  code?: string
  message?: string
  status?: number
} | null

const MESSAGES: Record<string, string> = {
  // Entrada e cadastro
  INVALID_EMAIL_OR_PASSWORD: 'E-mail ou senha inválidos',
  INVALID_USERNAME_OR_PASSWORD: 'Usuário ou senha inválidos',
  INVALID_PASSWORD: 'Senha inválida',
  INVALID_EMAIL: 'E-mail inválido',
  INVALID_EMAIL_FORMAT: 'E-mail em formato inválido',
  USER_NOT_FOUND: 'Não encontramos uma conta com esse e-mail',
  USER_ALREADY_EXISTS: 'Já existe uma conta com esse e-mail',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'Já existe uma conta com esse e-mail. Use outro endereço',
  CREDENTIAL_ACCOUNT_NOT_FOUND:
    'Esta conta entra por Google ou GitHub, não por senha',
  ACCOUNT_NOT_FOUND: 'Conta não encontrada',
  EMAIL_NOT_VERIFIED: 'Confirme seu e-mail antes de entrar',
  EMAIL_CAN_NOT_BE_UPDATED: 'Este e-mail não pode ser alterado',
  FAILED_TO_CREATE_USER: 'Não foi possível criar a conta',
  FAILED_TO_CREATE_SESSION: 'Não foi possível iniciar a sessão',
  COULD_NOT_CREATE_SESSION: 'Não foi possível iniciar a sessão',
  FAILED_TO_UPDATE_USER: 'Não foi possível atualizar a conta',
  PASSWORD_TOO_SHORT: 'A senha é curta demais',
  PASSWORD_TOO_LONG: 'A senha é longa demais',
  PASSWORD_COMPROMISED:
    'Esta senha apareceu em vazamentos conhecidos. Escolha outra',
  BANNED_USER: 'Esta conta está bloqueada. Fale com o suporte',
  SESSION_EXPIRED: 'Sua sessão expirou. Entre de novo',
  INVALID_SESSION_TOKEN: 'Sessão inválida. Entre de novo',
  SESSION_REQUIRED: 'É preciso estar autenticado',
  AUTHENTICATION_REQUIRED: 'É preciso estar autenticado',
  ACCESS_DENIED: 'Acesso negado',
  UNAUTHORIZED: 'Não autorizado',

  // Nome de usuário
  USERNAME_IS_ALREADY_TAKEN: 'Este nome de usuário já está em uso',
  INVALID_USERNAME: 'Nome de usuário inválido',
  USERNAME_TOO_SHORT: 'Nome de usuário curto demais',
  USERNAME_TOO_LONG: 'Nome de usuário longo demais',
  INVALID_DISPLAY_USERNAME: 'Nome de exibição inválido',

  // Verificação de e-mail, recuperação de senha e tokens
  INVALID_TOKEN: 'Link inválido ou já utilizado',
  TOKEN_EXPIRED: 'O link expirou. Peça um novo',
  VERIFICATION_EMAIL_NOT_SENT: 'Não foi possível enviar o e-mail',
  VERIFICATION_FAILED: 'Não foi possível concluir a verificação',

  // Códigos (OTP) e segundo fator
  INVALID_OTP: 'Código inválido',
  OTP_EXPIRED: 'O código expirou. Peça um novo',
  OTP_HAS_EXPIRED: 'O código expirou. Peça um novo',
  OTP_NOT_FOUND: 'Código não encontrado. Peça um novo',
  OTP_NOT_ENABLED: 'O acesso por código não está habilitado',
  INVALID_CODE: 'Código inválido',
  INVALID_BACKUP_CODE: 'Código de backup inválido',
  BACKUP_CODES_NOT_ENABLED: 'Os códigos de backup não estão habilitados',
  TOTP_NOT_ENABLED: 'O aplicativo autenticador não está habilitado',
  TWO_FACTOR_NOT_ENABLED: 'A verificação em duas etapas não está habilitada',
  INVALID_TWO_FACTOR_COOKIE:
    'A verificação em duas etapas expirou. Entre de novo',
  TOO_MANY_ATTEMPTS: 'Tentativas demais. Espere um pouco e tente de novo',
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: 'Tentativas demais. Peça um novo código',

  // Entrada social
  POPUP_BLOCKED: 'O navegador bloqueou a janela de login',
  POPUP_CLOSED: 'A janela de login foi fechada antes de concluir',
  POPUP_TIMEOUT: 'A janela de login expirou',
  POPUP_SIGN_IN_FAILED: 'Não foi possível entrar por esse provedor',
  PROVIDER_CONFIG_NOT_FOUND: 'Provedor de login não configurado',
  PROVIDER_ID_REQUIRED: 'Provedor de login não informado',
  INVALID_OAUTH_CONFIG: 'Configuração de login social inválida',
  INVALID_OAUTH_CONFIGURATION: 'Configuração de login social inválida',
  SOCIAL_ACCOUNT_ALREADY_LINKED: 'Esta conta social já está vinculada',
  ACCOUNT_NOT_LINKED: 'Esta conta social não está vinculada',

  // Genéricos
  UNEXPECTED_ERROR: 'Algo deu errado. Tente de novo',
  UNKNOWN_ERROR: 'Algo deu errado. Tente de novo',
  INTERNAL_SERVER_ERROR: 'Algo deu errado. Tente de novo',
  SERVICE_UNAVAILABLE: 'Serviço indisponível no momento',
  NO_DATA_TO_UPDATE: 'Nada para atualizar',
}

const BY_STATUS: Record<number, string> = {
  401: 'Não autorizado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  429: 'Muitas tentativas. Espere um pouco e tente de novo',
  500: 'Algo deu errado. Tente de novo',
  502: 'Serviço indisponível no momento',
  503: 'Serviço indisponível no momento',
}

/**
 * Frase em pt-BR para um erro do Better Auth. `fallback` é a mensagem da
 * tela (ex.: 'E-mail ou senha inválidos'); a mensagem em inglês do
 * provedor nunca é exibida.
 */
export function authErrorMessage(
  error: AuthLikeError,
  fallback = 'Algo deu errado. Tente de novo',
): string {
  if (!error) return fallback
  const byCode = error.code ? MESSAGES[error.code] : undefined
  if (byCode) return byCode
  if (error.status && BY_STATUS[error.status]) return BY_STATUS[error.status]
  return fallback
}
