import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CookieConsentProvider } from '@/app/_components/user/cookie-consent/provider'
import type { CookieConsent } from '@/lib/cookie-consent/types'
import { mockFetch } from '@/src/__tests__/component-utils'
import { CrmAuditLogSection } from '../crm-audit-log-section'
import { CrmPrivacySection } from '../crm-privacy-section'

const WS = 'ws_1'
const ACTIVITIES = `/api/workspaces/${WS}/crm/activities`

function activity(id: string, createdAt: string, extra = {}) {
  return {
    id,
    entity: 'lead',
    action: 'CREATED',
    summary: `Resumo ${id}`,
    createdAt,
    ...extra,
  }
}

describe('<CrmAuditLogSection />', () => {
  it('shows loading and then the empty state', async () => {
    mockFetch([{ match: ACTIVITIES, data: [] }])
    render(<CrmAuditLogSection workspaceId={WS} />)

    expect(screen.getByText('Carregando...')).toBeTruthy()
    expect(
      await screen.findByText('Nenhuma atividade registrada ainda.'),
    ).toBeTruthy()
  })

  it('lists activities newest first with pt-BR action labels', async () => {
    mockFetch([
      {
        match: ACTIVITIES,
        data: [
          activity('a1', '2026-09-01T10:00:00.000Z'),
          activity('a2', '2026-09-03T10:00:00.000Z', {
            action: 'DELETED',
            summary: null,
          }),
          activity('a3', '2026-09-02T10:00:00.000Z', { action: 'UPDATED' }),
        ],
      },
    ])
    render(<CrmAuditLogSection workspaceId={WS} />)
    await screen.findByText('Resumo a1')

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows.map((r) => r.textContent)).toEqual([
      expect.stringContaining('Excluído'),
      expect.stringContaining('Atualizado'),
      expect.stringContaining('Criado'),
    ])
    // Missing summaries render a dash placeholder.
    expect(rows[0].textContent).toContain('—')
  })

  it('caps the log at the 100 most recent entries', async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      activity(`a${i}`, new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()),
    )
    mockFetch([{ match: ACTIVITIES, data: many }])
    render(<CrmAuditLogSection workspaceId={WS} />)
    await screen.findByText('Resumo a119')

    expect(screen.getAllByRole('row')).toHaveLength(101)
    expect(screen.queryByText('Resumo a0')).toBeNull()
  })
})

function renderPrivacy(initial: CookieConsent) {
  return render(
    <CookieConsentProvider initial={initial} isAuthenticated={false}>
      <CrmPrivacySection />
    </CookieConsentProvider>,
  )
}

describe('<CrmPrivacySection />', () => {
  it('explains the pending decision', () => {
    renderPrivacy(null)
    expect(
      screen.getByText(
        'Você ainda não decidiu sobre o uso de cookies de análise.',
      ),
    ).toBeTruthy()
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe(
      'false',
    )
  })

  it('revokes accepted analytics cookies', async () => {
    renderPrivacy('accepted')
    expect(
      screen.getByText('Aceitos. Você pode revogar a qualquer momento.'),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('switch'))

    expect(
      await screen.findByText(
        'Recusados. Nenhum tracker de análise é carregado.',
      ),
    ).toBeTruthy()
    expect(document.cookie).toContain('=rejected')
  })
})
