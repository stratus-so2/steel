import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './_fetch'

/**
 * Estado e ações do segundo fator por aplicativo autenticador.
 *
 * Só o que o better-auth não oferece passa por aqui. Pedir a `totpURI`,
 * ativar/desativar a 2FA, gerar códigos de recuperação e verificar o código
 * no login continuam indo pelo `authClient` (endpoints `/api/auth/**`).
 */

export interface TotpStatus {
  /** Interruptor único do plugin: vale para e-mail e para aplicativo. */
  twoFactorEnabled: boolean
  /** O usuário escaneou o QR e confirmou um código do aplicativo. */
  totpEnabled: boolean
  /** Já existe segredo TOTP gravado para a conta. */
  hasSecret: boolean
}

const TOTP_KEY = ['two-factor-totp'] as const
const ENDPOINT = '/api/users/me/two-factor/totp'

export function useTwoFactorTotp() {
  return useQuery({
    queryKey: TOTP_KEY,
    queryFn: () =>
      apiFetch<TotpStatus>(
        ENDPOINT,
        undefined,
        'Erro ao carregar o segundo fator',
      ),
    staleTime: 30 * 1000,
  })
}

/** Confirma o cadastro do aplicativo com o primeiro código de 6 dígitos. */
export function useConfirmTwoFactorTotp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (code: string) =>
      apiFetch<TotpStatus>(
        ENDPOINT,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        },
        'Código inválido ou expirado',
      ),
    onSuccess: (status) => {
      queryClient.setQueryData(TOTP_KEY, status)
    },
  })
}

/** Desliga o aplicativo autenticador; exige a senha da conta. */
export function useDisableTwoFactorTotp() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (password: string) =>
      apiFetch<TotpStatus>(
        ENDPOINT,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        },
        'Não foi possível desligar o aplicativo autenticador',
      ),
    onSuccess: (status) => {
      queryClient.setQueryData(TOTP_KEY, status)
    },
  })
}
