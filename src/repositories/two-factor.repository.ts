import { prisma } from '../lib/prisma'
import { err, ok, type Result } from '../lib/result'
import { dbError } from './db-error'

/**
 * Acesso ao estado do segundo fator por aplicativo autenticador.
 *
 * O segredo TOTP e os códigos de backup pertencem ao plugin do better-auth e
 * **não** são lidos nem escritos aqui: o segredo está cifrado com
 * `BETTER_AUTH_SECRET` e só o plugin sabe decifrá-lo. Este repositório cuida
 * de duas coisas: saber se existe linha de `two_factors` para a conta (há
 * segredo a confirmar?) e ligar/desligar o nosso marcador
 * `users.two_factor_totp_enabled`.
 */
export const TwoFactorRepository = {
  /** Existe segredo TOTP para esta conta (isto é, o `enable()` já rodou)? */
  async hasSecret(userId: string): Promise<Result<boolean>> {
    try {
      const row = await prisma.twoFactor.findFirst({
        where: { userId },
        select: { id: true },
      })
      return ok(row !== null)
    } catch (error) {
      return err(dbError('Failed to read the two-factor secret', error))
    }
  },

  /** Estado do 2FA da conta, como a aba de segurança precisa ver. */
  async findStatus(
    userId: string,
  ): Promise<
    Result<{ twoFactorEnabled: boolean; totpEnabled: boolean } | null>
  > {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true, twoFactorTotpEnabled: true },
      })
      if (!user) return ok(null)
      return ok({
        twoFactorEnabled: user.twoFactorEnabled,
        totpEnabled: user.twoFactorTotpEnabled,
      })
    } catch (error) {
      return err(dbError('Failed to read the two-factor status', error))
    }
  },

  /** Liga ou desliga o marcador de aplicativo autenticador confirmado. */
  async setTotpEnabled(
    userId: string,
    enabled: boolean,
  ): Promise<Result<void>> {
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorTotpEnabled: enabled },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to update the authenticator flag', error))
    }
  },
}
