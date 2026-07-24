import { z } from 'zod'

const serverEnv = {
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_TLS_ENABLED: process.env.REDIS_TLS_ENABLED,
  REDIS_TLS_CA_PATH: process.env.REDIS_TLS_CA_PATH,
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT,
  MINIO_PUBLIC_URL: process.env.MINIO_PUBLIC_URL,
  MINIO_USER: process.env.MINIO_USER,
  MINIO_PASSWORD: process.env.MINIO_PASSWORD,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_SECRETS: process.env.BETTER_AUTH_SECRETS,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  HUGEICONS_TOKEN: process.env.HUGEICONS_TOKEN,
  ABACATE_PAY: process.env.ABACATE_PAY,
  ABACATE_PAY_WEBHOOK_SECRET: process.env.ABACATE_PAY_WEBHOOK_SECRET,
  STATUS_COLLECTOR_SECRET: process.env.STATUS_COLLECTOR_SECRET,
  CONNECTION_SECRETS: process.env.CONNECTION_SECRETS,
  ACCOUNT_DELETION_GRACE_OVERRIDE_MS:
    process.env.ACCOUNT_DELETION_GRACE_OVERRIDE_MS,
  WHATSAPP_META_APP_SECRET: process.env.WHATSAPP_META_APP_SECRET,
  WHATSAPP_META_VERIFY_TOKEN: process.env.WHATSAPP_META_VERIFY_TOKEN,
  JITSI_DOMAIN: process.env.JITSI_DOMAIN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
  SOCIAL_TOKEN_ENCRYPTION_KEY: process.env.SOCIAL_TOKEN_ENCRYPTION_KEY,
  FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET,
  FACEBOOK_CONFIG_ID: process.env.FACEBOOK_CONFIG_ID,
  TIKTOK_CLIENT_KEY: process.env.TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET: process.env.TIKTOK_CLIENT_SECRET,
  TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET,
  LINKEDIN_CLIENT_ID: process.env.LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET: process.env.LINKEDIN_CLIENT_SECRET,
  GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
}

/** String opcional que trata `""` como ausente (não só `undefined`). */
const blankOptional = z.preprocess(
  (v) => (v === '' ? undefined : v),
  z.string().min(1).optional(),
)

const serverEnvSchema = z.object({
  POSTGRES_USER: z.string().min(2).max(63),
  POSTGRES_PASSWORD: z.string().min(8).max(128),
  POSTGRES_DB: z.string().min(1).max(63),
  DATABASE_URL: z.url().startsWith('postgresql://'),
  REDIS_URL: z
    .url()
    .refine((v) => v.startsWith('redis://') || v.startsWith('rediss://'), {
      message: 'REDIS_URL must start with redis:// or rediss://',
    }),
  REDIS_PASSWORD: z.string().min(8).max(128),
  REDIS_TLS_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  REDIS_TLS_CA_PATH: z.string().min(1).optional(),
  MINIO_ENDPOINT: z.url().startsWith('http'),
  // Publicly reachable base URL for objects in public buckets (browsers and
  // external providers like Z-API fetch media from here). Defaults to
  // MINIO_ENDPOINT for local dev, where it's directly reachable; production
  // must set this to a domain the internal MINIO_ENDPOINT (Docker service
  // name) isn't.
  MINIO_PUBLIC_URL: z.url().startsWith('http').optional(),
  MINIO_USER: z.string().min(3).max(63),
  MINIO_PASSWORD: z.string().min(8).max(128),
  BETTER_AUTH_SECRET: z.string().min(16).startsWith('ba_'),
  BETTER_AUTH_SECRETS: z
    .string()
    .regex(/^\d+:.{32,}(,\d+:.{32,})*$/, {
      message:
        'BETTER_AUTH_SECRETS must be "v:secret[,v:secret...]" with secrets >= 32 chars',
    })
    .optional(),
  BETTER_AUTH_URL: z.url().startsWith('http'),
  GOOGLE_CLIENT_ID: z.string().min(10).endsWith('.apps.googleusercontent.com'),
  GOOGLE_CLIENT_SECRET: z.string().min(10).startsWith('GOCSPX-'),
  GITHUB_CLIENT_ID: z.string().min(10).max(40),
  GITHUB_CLIENT_SECRET: z.string().length(40),
  RESEND_API_KEY: z.string().startsWith('re_'),
  HUGEICONS_TOKEN: z.string().regex(/^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/),
  ABACATE_PAY: z.string().min(1).max(100),
  ABACATE_PAY_WEBHOOK_SECRET: z.string().min(1).max(100),
  STATUS_COLLECTOR_SECRET: z.string().min(32).max(128),
  CONNECTION_SECRETS: z.string().regex(/^\d+:.{32,}(,\d+:.{32,})*$/, {
    message:
      'CONNECTION_SECRETS must be "v:secret[,v:secret...]" with secrets >= 32 chars',
  }),
  ACCOUNT_DELETION_GRACE_OVERRIDE_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0), {
      message: 'ACCOUNT_DELETION_GRACE_OVERRIDE_MS must be a non-negative number',
    }),
  WHATSAPP_META_APP_SECRET: z.string().min(1).max(255).optional(),
  WHATSAPP_META_VERIFY_TOKEN: z.string().min(8).max(255).optional(),
  JITSI_DOMAIN: z.string().min(1).max(255).default('meet.jit.si'),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().min(1).optional(),
  // Cifra tokens OAuth de redes sociais em repouso (AES-256-GCM). Sem ela,
  // isTokenCryptoConfigured() é false e o handshake OAuth fica indisponível.
  // `blankOptional`: cada plataforma é opcional e independente — deploys
  // parciais deixam algumas dessas vars como string vazia em vez de ausentes.
  SOCIAL_TOKEN_ENCRYPTION_KEY: blankOptional,
  FACEBOOK_APP_ID: blankOptional,
  FACEBOOK_APP_SECRET: blankOptional,
  FACEBOOK_CONFIG_ID: blankOptional,
  TIKTOK_CLIENT_KEY: blankOptional,
  TIKTOK_CLIENT_SECRET: blankOptional,
  TWITTER_CLIENT_ID: blankOptional,
  TWITTER_CLIENT_SECRET: blankOptional,
  LINKEDIN_CLIENT_ID: blankOptional,
  LINKEDIN_CLIENT_SECRET: blankOptional,
  GOOGLE_ADS_DEVELOPER_TOKEN: blankOptional,
})

const validatedServerEnv =
  process.env.NODE_ENV === 'test' || process.env.SKIP_ENV_VALIDATION === 'true'
    ? (serverEnv as unknown as z.infer<typeof serverEnvSchema>)
    : serverEnvSchema.parse(serverEnv)

export const {
  POSTGRES_USER,
  POSTGRES_PASSWORD,
  POSTGRES_DB,
  DATABASE_URL,
  REDIS_URL,
  REDIS_PASSWORD,
  REDIS_TLS_ENABLED,
  REDIS_TLS_CA_PATH,
  MINIO_ENDPOINT,
  MINIO_PUBLIC_URL,
  MINIO_USER,
  MINIO_PASSWORD,
  BETTER_AUTH_SECRET,
  BETTER_AUTH_SECRETS,
  BETTER_AUTH_URL,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  RESEND_API_KEY,
  HUGEICONS_TOKEN,
  ABACATE_PAY,
  ABACATE_PAY_WEBHOOK_SECRET,
  STATUS_COLLECTOR_SECRET,
  CONNECTION_SECRETS,
  ACCOUNT_DELETION_GRACE_OVERRIDE_MS,
  WHATSAPP_META_APP_SECRET,
  WHATSAPP_META_VERIFY_TOKEN,
  JITSI_DOMAIN,
  OPENAI_API_KEY,
  OPENAI_MODEL,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  SOCIAL_TOKEN_ENCRYPTION_KEY,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  FACEBOOK_CONFIG_ID,
  TIKTOK_CLIENT_KEY,
  TIKTOK_CLIENT_SECRET,
  TWITTER_CLIENT_ID,
  TWITTER_CLIENT_SECRET,
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  GOOGLE_ADS_DEVELOPER_TOKEN,
} = validatedServerEnv
