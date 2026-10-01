import { describe, expect, it } from 'vitest'
import { authErrorMessage } from '@/src/lib/auth-error-messages'

describe('authErrorMessage()', () => {
  it('translates the codes the sign-in screen can hit', () => {
    expect(
      authErrorMessage({
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      }),
    ).toBe('E-mail ou senha inválidos')
    expect(
      authErrorMessage({
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Email not verified',
      }),
    ).toBe('Confirme seu e-mail antes de entrar')
    expect(
      authErrorMessage({
        code: 'USER_ALREADY_EXISTS',
        message: 'User already exists.',
      }),
    ).toBe('Já existe uma conta com esse e-mail')
  })

  it('translates OTP and two factor codes', () => {
    expect(authErrorMessage({ code: 'INVALID_OTP' })).toBe('Código inválido')
    expect(authErrorMessage({ code: 'OTP_HAS_EXPIRED' })).toBe(
      'O código expirou. Peça um novo',
    )
    expect(authErrorMessage({ code: 'INVALID_BACKUP_CODE' })).toBe(
      'Código de backup inválido',
    )
  })

  it('never shows the english message of an unknown code', () => {
    const message = authErrorMessage(
      { code: 'SOME_NEW_CODE', message: 'Something in English' },
      'Não foi possível concluir',
    )
    expect(message).toBe('Não foi possível concluir')
  })

  it('falls back to the http status when there is no code', () => {
    expect(
      authErrorMessage({ status: 429, message: 'Too many requests' }),
    ).toBe('Muitas tentativas. Espere um pouco e tente de novo')
    expect(authErrorMessage({ status: 401 })).toBe('Não autorizado')
    expect(authErrorMessage({ status: 418 }, 'Erro na tela')).toBe(
      'Erro na tela',
    )
  })

  it('uses the default sentence without an error or fallback', () => {
    expect(authErrorMessage(null)).toBe('Algo deu errado. Tente de novo')
    expect(authErrorMessage({})).toBe('Algo deu errado. Tente de novo')
  })

  it('prefers the code over the status', () => {
    expect(
      authErrorMessage({ code: 'INVALID_OTP', status: 500 }, 'Erro na tela'),
    ).toBe('Código inválido')
  })
})
