/**
 * Lembra, por navegador, qual segundo fator esta pessoa usou da última vez.
 *
 * A tela de login não pode perguntar ao servidor qual fator a conta cadastrou:
 * não existe sessão ainda, e responder contaria a quem chegou na etapa da
 * senha o que um determinado endereço usa. Então a dica fica aqui, local,
 * onde não é da conta de mais ninguém, e serve para uma coisa só: decidir se
 * mandamos um e-mail antes de a pessoa pedir. Quem usa aplicativo
 * autenticador recebia um e-mail que nunca ia abrir em todo login.
 *
 * É conveniência, nunca portão: dica errada ou ausente custa um clique, e
 * todos os fatores seguem alcançáveis na tela, diga ela o que disser.
 */
export type TwoFactorMethod = 'otp' | 'totp'

const KEY = 'steel.2fa.method'

export function rememberTwoFactorMethod(method: TwoFactorMethod): void {
  try {
    window.localStorage.setItem(KEY, method)
  } catch {
    // Janela privativa, dado de site bloqueado, ou um navegador que
    // simplesmente recusa. A dica é opcional por design.
  }
}

export function lastTwoFactorMethod(): TwoFactorMethod | null {
  try {
    const stored = window.localStorage.getItem(KEY)
    return stored === 'otp' || stored === 'totp' ? stored : null
  } catch {
    return null
  }
}
