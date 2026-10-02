import {
  emailOTPClient,
  inferAdditionalFields,
  twoFactorClient,
} from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/react'

// Mirror the server-side `user.additionalFields` declaration so
// `authClient.signUp.email(...)` typechecks the consent timestamps. The
// server hook in `auth.ts` overwrites these with the server clock.
const consentFieldsSchema = {
  user: {
    acceptedTermsAt: { type: 'date', required: false },
    acceptedPrivacyAt: { type: 'date', required: false },
    // Aplicativo autenticador confirmado. A aba de segurança lê isto de
    // `session.user` para distinguir 2FA por e-mail de 2FA por app;
    // `input: false` no servidor garante que só o nosso serviço escreve.
    twoFactorTotpEnabled: { type: 'boolean', required: false },
  },
} as const

// Sem `baseURL`: o client fala com a mesma origem que serviu a página. A
// versão anterior lia `NEXT_PUBLIC_APP_URL`, variável que não existe em
// nenhum ambiente — ou seja, já caía nesse default.
export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
    inferAdditionalFields(consentFieldsSchema),
  ],
})
