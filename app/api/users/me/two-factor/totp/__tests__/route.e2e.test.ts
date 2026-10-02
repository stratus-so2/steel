import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  createAuthenticatedUser,
  defaultHeaders,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { BASE_URL } from '@/src/__tests__/setup.e2e'
import { prisma } from '@/src/lib/prisma'

/**
 * Segundo fator por aplicativo autenticador, de ponta a ponta.
 *
 * O teste faz o papel do aplicativo: pega a `totpURI` que o better-auth
 * devolve, decodifica o segredo que está nela e gera o código de 6 dígitos
 * pelo RFC 6238 — as 20 linhas abaixo são o Google Authenticator. Sem isso não
 * haveria como provar que um código **válido** passa, que é exatamente o que
 * estava quebrado antes da migration `two_factor_totp_and_lockout`.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/** RFC 4648 sem padding — é como o better-auth escreve o segredo na URI. */
function base32Decode(input: string): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const char of input.replace(/=+$/, '').toUpperCase()) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index === -1) throw new Error(`base32 inválido: ${char}`)
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((value >>> bits) & 0xff)
    }
  }
  return out
}

/**
 * RFC 6238 com os parâmetros que o `totpOptions` do `auth.ts` configura
 * (SHA-1, 30 s, 6 dígitos). A chave do HMAC é o segredo em texto, como o
 * `@better-auth/utils` faz.
 */
function totpCode(secret: string, offsetSteps = 0): string {
  const counter = Math.floor(Date.now() / 30_000) + offsetSteps
  const counterBytes = Buffer.alloc(8)
  counterBytes.writeBigUInt64BE(BigInt(counter))
  const digest = createHmac('sha1', secret).update(counterBytes).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const truncated =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return (truncated % 1_000_000).toString().padStart(6, '0')
}

function secretFromUri(totpURI: string): string {
  const encoded = new URL(totpURI).searchParams.get('secret')
  if (!encoded) throw new Error('totpURI sem o parâmetro secret')
  return base32Decode(encoded)
}

const PASSWORD = 'Test@12345678'

/**
 * O limiter de auth do Steel conta 10 tentativas por IP a cada 15 min, e os
 * casos abaixo batem várias vezes em `/api/auth/**`. Um IP novo por chamada
 * põe cada uma no próprio balde — o mesmo truque que `createAuthenticatedUser`
 * usa no sign-up.
 */
function clientIp(): string {
  const octet = () => Math.floor(Math.random() * 200) + 10
  return `${octet()}.${octet()}.${octet()}.${octet()}`
}

function authHeaders(cookie?: string) {
  return {
    ...defaultHeaders,
    'x-forwarded-for': clientIp(),
    ...(cookie ? { Cookie: cookie } : {}),
  }
}

/** Liga a 2FA pelo endpoint do better-auth e devolve o segredo do app. */
async function enableTwoFactor(cookie: string) {
  const res = await fetch(`${BASE_URL}/api/auth/two-factor/enable`, {
    method: 'POST',
    headers: authHeaders(cookie),
    body: JSON.stringify({ password: PASSWORD }),
  })
  expect(res.status).toBe(200)
  const body = await res.json()
  return {
    secret: secretFromUri(body.totpURI),
    backupCodes: body.backupCodes as string[],
  }
}

describe('GET /api/users/me/two-factor/totp', () => {
  it('returns 401 without authentication', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me/two-factor/totp`)
    expect(res.status).toBe(401)
  })

  it('reports every switch off for a fresh account', async () => {
    const { cookie } = await createAuthenticatedUser()

    const res = await getJson('/api/users/me/two-factor/totp', cookie)

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      twoFactorEnabled: false,
      totpEnabled: false,
      hasSecret: false,
    })
  })

  it('reports a secret once the better-auth enable ran', async () => {
    const { cookie } = await createAuthenticatedUser()
    await enableTwoFactor(cookie)

    const body = await (
      await getJson('/api/users/me/two-factor/totp', cookie)
    ).json()

    expect(body.data).toMatchObject({ hasSecret: true, totpEnabled: false })
  })
})

describe('POST /api/users/me/two-factor/totp', () => {
  it('returns 401 without authentication', async () => {
    const res = await fetch(`${BASE_URL}/api/users/me/two-factor/totp`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ code: '123456' }),
    })
    expect(res.status).toBe(401)
  })

  it('rejects a malformed code with 422', async () => {
    const { cookie } = await createAuthenticatedUser()

    const res = await postJson(
      '/api/users/me/two-factor/totp',
      { code: 'abc' },
      cookie,
    )

    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('VALIDATION_ERROR')
  })

  it('refuses with TOTP_NOT_ENABLED when the account has no secret', async () => {
    const { cookie } = await createAuthenticatedUser()

    const res = await postJson(
      '/api/users/me/two-factor/totp',
      { code: '123456' },
      cookie,
    )

    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('TOTP_NOT_ENABLED')
  })

  it('refuses a wrong code and leaves the flag off', async () => {
    const { id, cookie } = await createAuthenticatedUser()
    const { secret } = await enableTwoFactor(cookie)
    // Um código de um passo distante o bastante para cair fora da janela.
    const wrong = totpCode(secret, 50)

    const res = await postJson(
      '/api/users/me/two-factor/totp',
      { code: wrong },
      cookie,
    )

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('TOTP_INVALID_CODE')
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(user.twoFactorTotpEnabled).toBe(false)
  })

  it('confirms the app with a real code and turns the flag on', async () => {
    const { id, cookie } = await createAuthenticatedUser()
    const { secret } = await enableTwoFactor(cookie)

    const res = await postJson(
      '/api/users/me/two-factor/totp',
      { code: totpCode(secret) },
      cookie,
    )

    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({
      twoFactorEnabled: true,
      totpEnabled: true,
      hasSecret: true,
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(user.twoFactorTotpEnabled).toBe(true)
  })
})

describe('DELETE /api/users/me/two-factor/totp', () => {
  async function enrolledUser() {
    const user = await createAuthenticatedUser()
    const { secret } = await enableTwoFactor(user.cookie)
    const confirmed = await postJson(
      '/api/users/me/two-factor/totp',
      { code: totpCode(secret) },
      user.cookie,
    )
    expect(confirmed.status).toBe(200)
    return { ...user, secret }
  }

  async function deleteTotp(body: unknown, cookie?: string) {
    return fetch(`${BASE_URL}/api/users/me/two-factor/totp`, {
      method: 'DELETE',
      headers: authHeaders(cookie),
      body: JSON.stringify(body),
    })
  }

  it('returns 401 without authentication', async () => {
    expect((await deleteTotp({ password: PASSWORD })).status).toBe(401)
  })

  it('rejects a missing password with 422', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await deleteTotp({}, cookie)
    expect(res.status).toBe(422)
  })

  it('refuses with TOTP_NOT_ENABLED when no app is enrolled', async () => {
    const { cookie } = await createAuthenticatedUser()
    const res = await deleteTotp({ password: PASSWORD }, cookie)
    expect(res.status).toBe(409)
    expect((await res.json()).error.code).toBe('TOTP_NOT_ENABLED')
  })

  it('refuses a wrong password and keeps the app enrolled', async () => {
    const { id, cookie } = await enrolledUser()

    const res = await deleteTotp({ password: 'nao-e-a-senha' }, cookie)

    expect(res.status).toBe(401)
    expect((await res.json()).error.code).toBe('INVALID_CREDENTIALS')
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(user.twoFactorTotpEnabled).toBe(true)
  })

  it('switches the app off with the password, keeping 2FA by e-mail up', async () => {
    const { id, cookie } = await enrolledUser()

    const res = await deleteTotp({ password: PASSWORD }, cookie)

    expect(res.status).toBe(200)
    expect((await res.json()).data).toMatchObject({
      twoFactorEnabled: true,
      totpEnabled: false,
    })
    const user = await prisma.user.findUniqueOrThrow({ where: { id } })
    expect(user.twoFactorEnabled).toBe(true)
    expect(user.twoFactorTotpEnabled).toBe(false)
  })
})

describe('the second factor at sign-in', () => {
  /**
   * Regressão da migration `two_factor_totp_and_lockout`.
   *
   * O plugin do better-auth liga `accountLockout` por padrão e, no caminho de
   * **sucesso** da verificação, chama `resetTwoFactorFailures`, que escreve
   * `failed_verification_count` e `locked_until`. Essas colunas não existiam
   * em `two_factors`, então o Prisma recusava a escrita e um código CORRETO
   * falhava o login igual a um errado — com a 2FA por e-mail, que já estava no
   * ar, isso era um bug de produção silencioso.
   *
   * Este caso prova o caminho de sucesso ponta a ponta: senha correta levanta
   * o desafio, o código válido é aceito e volta uma sessão.
   */
  it('accepts a valid authenticator code and issues a session', async () => {
    const { email, cookie } = await createAuthenticatedUser()
    const { secret } = await enableTwoFactor(cookie)
    expect(
      (
        await postJson(
          '/api/users/me/two-factor/totp',
          { code: totpCode(secret) },
          cookie,
        )
      ).status,
    ).toBe(200)

    // Login novo, sem a sessão anterior: agora o segundo fator é um desafio.
    const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    expect(signIn.status).toBe(200)
    expect((await signIn.json()).twoFactorRedirect).toBe(true)

    const challengeCookie = (signIn.headers.getSetCookie?.() ?? [])
      .map((entry) => entry.split(';')[0])
      .join('; ')
    expect(challengeCookie).toContain('two_factor')

    const verify = await fetch(`${BASE_URL}/api/auth/two-factor/verify-totp`, {
      method: 'POST',
      headers: authHeaders(challengeCookie),
      body: JSON.stringify({ code: totpCode(secret) }),
    })

    // Antes da migration isto era 500: a escrita do reset de lockout batia em
    // coluna inexistente DEPOIS de o código já ter sido aceito.
    expect(verify.status).toBe(200)
    const body = await verify.json()
    expect(body.token).toBeTruthy()
  })

  it('refuses a wrong authenticator code at the challenge', async () => {
    const { email, cookie } = await createAuthenticatedUser()
    const { secret } = await enableTwoFactor(cookie)
    await postJson(
      '/api/users/me/two-factor/totp',
      { code: totpCode(secret) },
      cookie,
    )

    const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ email, password: PASSWORD }),
    })
    const challengeCookie = (signIn.headers.getSetCookie?.() ?? [])
      .map((entry) => entry.split(';')[0])
      .join('; ')

    const verify = await fetch(`${BASE_URL}/api/auth/two-factor/verify-totp`, {
      method: 'POST',
      headers: authHeaders(challengeCookie),
      body: JSON.stringify({ code: totpCode(secret, 50) }),
    })

    expect(verify.status).toBe(401)
  })
})
