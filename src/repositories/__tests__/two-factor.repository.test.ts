import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { TwoFactorRepository } from '../two-factor.repository'

/**
 * O segredo gravado aqui é texto qualquer: o repositório nunca o decifra (só
 * o plugin do better-auth sabe fazer isso), ele só precisa saber se a linha
 * existe.
 */
async function seedSecret(userId: string) {
  return prisma.twoFactor.create({
    data: { userId, secret: 'cifrado', backupCodes: 'cifrados' },
  })
}

/**
 * Id que o Postgres recusa (byte nulo em coluna `text`), para exercitar o
 * caminho de catch sem mockar o Prisma — o `setup.integration.ts` precisa do
 * client real para o TRUNCATE entre os testes.
 */
const UNQUERYABLE_ID = 'bad\u0000id'

describe('TwoFactorRepository', () => {
  describe('hasSecret()', () => {
    it('is false for an account the plugin never touched', async () => {
      const user = await seedUser()
      expect(expectOk(await TwoFactorRepository.hasSecret(user.id))).toBe(false)
    })

    it('is true once a two_factors row exists', async () => {
      const user = await seedUser()
      await seedSecret(user.id)
      expect(expectOk(await TwoFactorRepository.hasSecret(user.id))).toBe(true)
    })

    it('is false for an unknown user id instead of failing', async () => {
      expect(expectOk(await TwoFactorRepository.hasSecret('missing'))).toBe(
        false,
      )
    })

    it('returns DATABASE_ERROR when the query itself fails', async () => {
      expect(
        expectErr(await TwoFactorRepository.hasSecret(UNQUERYABLE_ID)).code,
      ).toBe('DATABASE_ERROR')
    })
  })

  describe('findStatus()', () => {
    it('reports both switches off for a fresh account', async () => {
      const user = await seedUser()
      expect(expectOk(await TwoFactorRepository.findStatus(user.id))).toEqual({
        twoFactorEnabled: false,
        totpEnabled: false,
      })
    })

    it('reports the flags the row carries', async () => {
      const user = await seedUser({
        twoFactorEnabled: true,
        twoFactorTotpEnabled: true,
      })
      expect(expectOk(await TwoFactorRepository.findStatus(user.id))).toEqual({
        twoFactorEnabled: true,
        totpEnabled: true,
      })
    })

    it('returns null for an unknown user', async () => {
      expect(
        expectOk(await TwoFactorRepository.findStatus('missing')),
      ).toBeNull()
    })

    it('returns DATABASE_ERROR when the query itself fails', async () => {
      expect(
        expectErr(await TwoFactorRepository.findStatus(UNQUERYABLE_ID)).code,
      ).toBe('DATABASE_ERROR')
    })
  })

  describe('setTotpEnabled()', () => {
    it('turns the authenticator flag on', async () => {
      const user = await seedUser({ twoFactorEnabled: true })

      expectOk(await TwoFactorRepository.setTotpEnabled(user.id, true))

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { twoFactorEnabled: true, twoFactorTotpEnabled: true },
      })
      // Desligar/ligar o app não encosta no interruptor geral da 2FA.
      expect(stored).toEqual({
        twoFactorEnabled: true,
        twoFactorTotpEnabled: true,
      })
    })

    it('turns the authenticator flag off again', async () => {
      const user = await seedUser({
        twoFactorEnabled: true,
        twoFactorTotpEnabled: true,
      })

      expectOk(await TwoFactorRepository.setTotpEnabled(user.id, false))

      const stored = await prisma.user.findUniqueOrThrow({
        where: { id: user.id },
        select: { twoFactorEnabled: true, twoFactorTotpEnabled: true },
      })
      expect(stored).toEqual({
        twoFactorEnabled: true,
        twoFactorTotpEnabled: false,
      })
    })

    it('returns DATABASE_ERROR for an unknown user', async () => {
      expect(
        expectErr(await TwoFactorRepository.setTotpEnabled('missing', true))
          .code,
      ).toBe('DATABASE_ERROR')
    })
  })

  describe('the lockout columns the better-auth plugin writes', () => {
    // Antes da migration `two_factor_totp_and_lockout` estas colunas não
    // existiam, e o plugin as escreve em TODA verificação de segundo fator,
    // inclusive no caminho de sucesso — então um código de e-mail correto
    // falhava o login igual a um errado. O teste existe para essa regressão
    // não voltar em silêncio.
    it('accept the write the plugin does on every verification', async () => {
      const user = await seedUser({ twoFactorEnabled: true })
      const row = await seedSecret(user.id)

      const updated = await prisma.twoFactor.update({
        where: { id: row.id },
        data: { failedVerificationCount: 3, lockedUntil: new Date() },
      })
      expect(updated.failedVerificationCount).toBe(3)
      expect(updated.lockedUntil).not.toBeNull()

      const reset = await prisma.twoFactor.update({
        where: { id: row.id },
        data: { failedVerificationCount: 0, lockedUntil: null },
      })
      expect(reset.failedVerificationCount).toBe(0)
      expect(reset.lockedUntil).toBeNull()
    })

    it('default to "never failed, not locked"', async () => {
      const user = await seedUser()
      const row = await seedSecret(user.id)
      expect(row.failedVerificationCount).toBe(0)
      expect(row.lockedUntil).toBeNull()
    })
  })
})
