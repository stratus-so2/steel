import { z } from 'zod'

/**
 * Entradas do segundo fator por **aplicativo autenticador** (TOTP).
 *
 * O resto do 2FA (ativar, desativar, OTP por e-mail, código de backup) é
 * atendido pelos endpoints do próprio better-auth em `/api/auth/**`. Só o
 * passo que o plugin não tem na versão 1.6 mora aqui: confirmar que o usuário
 * realmente escaneou o QR, e desfazer isso.
 */

/** Código de 6 dígitos que o aplicativo mostra. */
export const confirmTotpSchema = z.object({
  // `trim` antes de validar porque colar o código de um gerenciador de senhas
  // costuma trazer espaço em volta. Só dígitos: o campo é numérico e o
  // better-auth rejeitaria qualquer outra coisa de todo jeito.
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Informe os 6 dígitos que o aplicativo mostra'),
})

/**
 * Senha da conta. Desligar o aplicativo autenticador é um rebaixamento de
 * segurança, então exige a mesma prova que ativar e desativar a 2FA já exige.
 */
export const disableTotpSchema = z.object({
  password: z.string().min(1, 'Informe sua senha para continuar'),
})

export type ConfirmTotpInput = z.infer<typeof confirmTotpSchema>
export type DisableTotpInput = z.infer<typeof disableTotpSchema>
