import '@/src/lib/zod-locale'
import 'dotenv/config'
import { vi } from 'vitest'

// Tokens assinados (ex.: descadastro LGPD) usam o BETTER_AUTH_SECRET e os
// links montados usam o BETTER_AUTH_URL. Os jobs de unit/coverage do CI não
// os definem; valores só de teste evitam que a suíte dependa do .env local.
process.env.BETTER_AUTH_SECRET ??= 'test-only-better-auth-secret'
process.env.BETTER_AUTH_URL ??= 'http://localhost:3001'

// A developer who put a real webhook in the local .env (to try the alerts end
// to end) must not have every test run post to Slack. Tests that exercise the
// alerts set the webhook explicitly on a mocked env.
delete process.env.SLACK_ALERTS_WEBHOOK_URL

// `next/font/google` só resolve fontes de verdade via o transform SWC do
// Next.js — fora do build (aqui, sob Vitest) os exports vêm vazios. Mocka
// qualquer função de fonte pra devolver um objeto com `className`/`variable`
// utilizáveis, sem travar em fontes específicas (ex. `Rubik` do template
// Agency) conforme novos templates adicionem outras.
function mockFont(name: string) {
  return () => ({
    className: `mock-font-${name}`,
    style: { fontFamily: name },
    variable: `--font-${name.toLowerCase()}`,
  })
}

// `next/font/google` só resolve fontes de verdade via o transform SWC do
// Next.js — fora do build (aqui, sob Vitest) os exports vêm vazios. O Vitest
// exige que os named exports do mock existam estaticamente (Proxy sem
// `ownKeys` real não resolve `import { X }`), então cada fonte usada no
// projeto precisa entrar aqui explicitamente.
vi.mock('next/font/google', () => ({
  Rubik: mockFont('Rubik'),
}))
