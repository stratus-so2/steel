import { z } from 'zod'
import { POSTHOG_DEFAULT_HOST } from '@/lib/posthog/constants'

const publicEnv = {
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_AXIOM_TOKEN: process.env.NEXT_PUBLIC_AXIOM_TOKEN,
  NEXT_PUBLIC_AXIOM_DATASET: process.env.NEXT_PUBLIC_AXIOM_DATASET,
  NEXT_PUBLIC_URL: process.env.NEXT_PUBLIC_URL,
  NEXT_PUBLIC_GA_ID: process.env.NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  // O default existe para o `posthog-js` ter um `ui_host` válido mesmo sem
  // configuração; nada o lê sem uma chave (ver `lib/posthog/client.ts`).
  NEXT_PUBLIC_POSTHOG_HOST:
    process.env.NEXT_PUBLIC_POSTHOG_HOST || POSTHOG_DEFAULT_HOST,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_RELEASE: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT,
}

const publicEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  NEXT_PUBLIC_AXIOM_TOKEN: z.string().startsWith('xaat-'),
  NEXT_PUBLIC_AXIOM_DATASET: z.string().min(1).max(128),
  NEXT_PUBLIC_URL: z.url().startsWith('http'),
  NEXT_PUBLIC_GA_ID: z.string().startsWith('G-').optional(),
  // Opcionais de propósito: sem chave, o PostHog nunca carrega e nunca pede
  // nada à rede — o app sobe igual (mesmo contrato do
  // `src/lib/storage/offsite-backup.ts`).
  NEXT_PUBLIC_POSTHOG_KEY: z.string().startsWith('phc_').optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.url().startsWith('https://'),
  // Mesmo contrato para o Sentry: sem DSN, sem SDK, sem rede.
  NEXT_PUBLIC_SENTRY_DSN: z.url().startsWith('https://').optional(),
  NEXT_PUBLIC_SENTRY_RELEASE: z.string().min(1).max(200).optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().min(1).max(64).optional(),
})

const validatedPublicEnv =
  process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true'
    ? (publicEnv as z.infer<typeof publicEnvSchema>)
    : publicEnvSchema.parse(publicEnv)

export const {
  NODE_ENV,
  NEXT_PUBLIC_AXIOM_TOKEN,
  NEXT_PUBLIC_AXIOM_DATASET,
  NEXT_PUBLIC_URL,
  NEXT_PUBLIC_GA_ID,
  NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_RELEASE,
  NEXT_PUBLIC_SENTRY_ENVIRONMENT,
} = validatedPublicEnv
