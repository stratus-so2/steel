import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  lastTwoFactorMethod,
  rememberTwoFactorMethod,
} from '../two-factor-method-hint'

// O projeto `unit` roda em Node, sem `window`. A dica é um módulo de
// navegador, então cada caso monta o `localStorage` que quer observar — e um
// deles monta um que lança, que é o que acontece em janela privativa ou com
// dado de site bloqueado.
type StoreStub = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

function installStorage(storage: StoreStub | null) {
  if (storage === null) {
    Reflect.deleteProperty(globalThis, 'window')
    return
  }
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage: storage },
    configurable: true,
    writable: true,
  })
}

function memoryStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    map,
  }
}

beforeEach(() => {
  installStorage(memoryStorage())
})

afterEach(() => {
  installStorage(null)
})

describe('rememberTwoFactorMethod / lastTwoFactorMethod', () => {
  it('remembers the authenticator app', () => {
    rememberTwoFactorMethod('totp')
    expect(lastTwoFactorMethod()).toBe('totp')
  })

  it('remembers the e-mail code', () => {
    rememberTwoFactorMethod('otp')
    expect(lastTwoFactorMethod()).toBe('otp')
  })

  it('overwrites the previous hint', () => {
    rememberTwoFactorMethod('otp')
    rememberTwoFactorMethod('totp')
    expect(lastTwoFactorMethod()).toBe('totp')
  })

  it('returns null when nothing was stored yet', () => {
    expect(lastTwoFactorMethod()).toBeNull()
  })

  it('ignores a stored value that is not a known method', () => {
    const storage = memoryStorage()
    storage.map.set('steel.2fa.method', 'passkey')
    installStorage(storage)
    expect(lastTwoFactorMethod()).toBeNull()
  })

  it('stays silent when the browser refuses to write', () => {
    installStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error('SecurityError')
      },
    })
    // Private window / blocked site data: a dica é opcional, nunca pode
    // quebrar a tela de login.
    expect(() => rememberTwoFactorMethod('totp')).not.toThrow()
  })

  it('reads as "no hint" when the browser refuses to read', () => {
    installStorage({
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: vi.fn(),
    })
    expect(lastTwoFactorMethod()).toBeNull()
  })
})
