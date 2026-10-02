import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/env/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/env/server')>()),
  SLACK_CLIENT_ID: undefined,
  SLACK_CLIENT_SECRET: undefined,
  SLACK_SIGNING_SECRET: undefined,
}))

import {
  getSlackAppConfig,
  isSlackConfigured,
} from '@/src/lib/servicedesk/slack-client'

/**
 * Servidor sem as credenciais do app do Slack: a integração precisa ficar
 * **inerte** (como a cópia offsite do backup), nunca derrubar nada.
 */
describe('Slack sem credenciais no servidor', () => {
  it('não monta configuração e se declara não configurado', () => {
    expect(getSlackAppConfig()).toBeNull()
    expect(isSlackConfigured()).toBe(false)
  })
})
