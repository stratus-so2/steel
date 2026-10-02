import { auditAuth } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  invalidCredentials,
  notFound,
  totpInvalidCode,
  totpNotEnabled,
} from '../errors'
import { auth } from '../lib/auth'
import { err, ok, type Result } from '../lib/result'
import { TwoFactorRepository } from '../repositories/two-factor.repository'

export interface TwoFactorTotpStatus {
  /** Interruptor único do plugin: vale para e-mail **e** aplicativo. */
  twoFactorEnabled: boolean
  /** O usuário escaneou o QR e confirmou um código que o app gerou. */
  totpEnabled: boolean
  /** Já existe segredo TOTP gravado (o `enable()` do plugin rodou). */
  hasSecret: boolean
}

/**
 * Provas que o serviço delega ao better-auth, declaradas como dependência
 * para o serviço poder ser testado sem subir um servidor de autenticação.
 *
 * As duas são **verificações reais**, não formalidades: `verifyTotpCode` roda
 * o `verifyTOTP` do plugin, que decifra o segredo da conta e confere a janela
 * de 30 s; `verifyPassword` roda o `/verify-password` do better-auth, que é o
 * mesmo caminho que `twoFactor.enable()` e `twoFactor.disable()` usam.
 */
export interface TwoFactorVerifiers {
  verifyTotpCode: (code: string, headers: Headers) => Promise<boolean>
  verifyPassword: (password: string, headers: Headers) => Promise<boolean>
}

/**
 * O `verifyTOTP` do plugin, chamado **com a sessão viva**. Nesse modo ele não
 * cria sessão nem conta tentativa de login: só confere o código contra o
 * segredo da conta e marca a linha de `two_factors` como verificada.
 */
async function verifyTotpCode(code: string, headers: Headers) {
  try {
    await auth.api.verifyTOTP({ body: { code }, headers })
    return true
  } catch {
    // O plugin lança `APIError` para código errado, segredo ausente e conta
    // em lockout. Aqui os três significam a mesma coisa para quem está
    // confirmando o cadastro: o código não valeu.
    return false
  }
}

/** `/verify-password` do better-auth (endpoint server-only). */
async function verifyPassword(password: string, headers: Headers) {
  try {
    const result = await auth.api.verifyPassword({
      body: { password },
      headers,
    })
    return result?.status === true
  } catch {
    return false
  }
}

const defaultVerifiers: TwoFactorVerifiers = { verifyTotpCode, verifyPassword }

/**
 * Segundo fator por **aplicativo autenticador** (TOTP).
 *
 * Só este pedaço do 2FA mora aqui; ativar/desativar a 2FA, mandar o OTP por
 * e-mail e consumir código de backup continuam sendo endpoints do better-auth
 * em `/api/auth/**`. O que falta no plugin 1.6 é o passo de **confirmação**:
 * o `enable()` já grava o segredo e devolve a `totpURI`, mas nada registra se
 * o usuário escaneou o QR. Sem esse registro a tela de login ofereceria a
 * etapa do aplicativo a quem não tem aplicativo, e a aba de segurança não
 * conseguiria diferenciar os dois métodos.
 *
 * Autorização: todo método age **sobre a própria conta** da sessão — o
 * `userId` vem de `getAuthSession()` na rota, nunca do corpo do request, então
 * não existe caminho para mexer no fator de outra pessoa.
 */
export const TwoFactorService = {
  /** Estado que a aba de segurança desenha. */
  async status(actorId: string): Promise<Result<TwoFactorTotpStatus>> {
    const status = await TwoFactorRepository.findStatus(actorId)
    if (!status.ok) return status
    if (!status.value) return err(notFound('User'))

    const secret = await TwoFactorRepository.hasSecret(actorId)
    if (!secret.ok) return secret

    return ok({
      twoFactorEnabled: status.value.twoFactorEnabled,
      totpEnabled: status.value.totpEnabled,
      hasSecret: secret.value,
    })
  },

  /**
   * Confirma o cadastro do aplicativo com o primeiro código.
   *
   * É o único caminho que liga `users.two_factor_totp_enabled`, e ele só liga
   * depois de o plugin aceitar um código de 6 dígitos — ninguém fica com
   * "aplicativo ativo" por um QR que nunca escaneou.
   */
  async confirmTotp(
    actorId: string,
    code: string,
    headers: Headers,
    verifiers: TwoFactorVerifiers = defaultVerifiers,
  ): Promise<Result<TwoFactorTotpStatus>> {
    const secret = await TwoFactorRepository.hasSecret(actorId)
    if (!secret.ok) return secret
    if (!secret.value) {
      auditAuth({
        event: 'auth.2fa_totp.confirm_failed',
        userId: actorId,
        outcome: 'failure',
        reason: 'TOTP_NOT_ENABLED',
      })
      return err(totpNotEnabled())
    }

    const valid = await verifiers.verifyTotpCode(code, headers)
    if (!valid) {
      auditAuth({
        event: 'auth.2fa_totp.confirm_failed',
        userId: actorId,
        outcome: 'failure',
        reason: 'TOTP_INVALID_CODE',
      })
      return err(totpInvalidCode())
    }

    const updated = await TwoFactorRepository.setTotpEnabled(actorId, true)
    if (!updated.ok) return updated

    logger.info('two_factor.totp_enabled', { userId: actorId })
    auditAuth({ event: 'auth.2fa_totp.enabled', userId: actorId })

    return this.status(actorId)
  },

  /**
   * Desliga o aplicativo autenticador, mantendo o OTP por e-mail de pé.
   *
   * Exige a senha, como ativar e desativar a 2FA já exigem: é rebaixamento de
   * segurança, e uma sessão roubada não pode conseguir isso sozinha. O
   * segredo TOTP em si fica onde está — ele só volta a valer depois de uma
   * nova confirmação, e apagá-lo exigiria rotacionar os códigos de backup de
   * quem usa só o e-mail.
   */
  async disableTotp(
    actorId: string,
    password: string,
    headers: Headers,
    verifiers: TwoFactorVerifiers = defaultVerifiers,
  ): Promise<Result<TwoFactorTotpStatus>> {
    const status = await TwoFactorRepository.findStatus(actorId)
    if (!status.ok) return status
    if (!status.value) return err(notFound('User'))
    if (!status.value.totpEnabled) return err(totpNotEnabled())

    const valid = await verifiers.verifyPassword(password, headers)
    if (!valid) {
      auditAuth({
        event: 'auth.2fa_totp.disabled',
        userId: actorId,
        outcome: 'failure',
        reason: 'INVALID_PASSWORD',
      })
      return err(invalidCredentials('Senha inválida'))
    }

    const updated = await TwoFactorRepository.setTotpEnabled(actorId, false)
    if (!updated.ok) return updated

    logger.info('two_factor.totp_disabled', { userId: actorId })
    auditAuth({ event: 'auth.2fa_totp.disabled', userId: actorId })

    return this.status(actorId)
  },
}
