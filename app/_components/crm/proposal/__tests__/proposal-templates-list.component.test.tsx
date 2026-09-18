import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import { ProposalTemplatesList } from '../proposal-templates-list'

const WS = 'ws_1'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const TEMPLATE = {
  id: 'tpl1',
  name: 'Consultoria padrão',
  description: 'Para projetos de consultoria',
  sections: [
    { type: 'COVER', enabled: true },
    { type: 'SCOPE', enabled: true },
    { type: 'SIGNATURE', enabled: false },
  ],
}

function setup(
  templates: unknown[] | null,
  del?: Parameters<typeof mockFetch>[0][number],
) {
  const spy = mockFetch([
    del ?? { method: 'DELETE', match: '/proposal-templates/tpl1', data: null },
    templates === null
      ? { match: '/crm/proposal-templates', status: 500, error: 'boom' }
      : { match: '/crm/proposal-templates', data: templates },
  ])
  render(<ProposalTemplatesList workspaceId={WS} slug='acme' />)
  return spy
}

describe('<ProposalTemplatesList />', () => {
  it('shows the empty state', async () => {
    setup([])
    expect(await screen.findByText(/Nenhum template ainda/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /novo template/i }).getAttribute('href'),
    ).toBe('/acme/crm/proposal-templates/new')
  })

  it('falls back to the empty state when loading fails', async () => {
    setup(null)
    expect(await screen.findByText(/Nenhum template ainda/)).toBeTruthy()
  })

  it('renders a card with description, link and enabled-section count', async () => {
    setup([TEMPLATE])
    const link = await screen.findByRole('link', { name: 'Consultoria padrão' })
    expect(link.getAttribute('href')).toBe('/acme/crm/proposal-templates/tpl1')
    expect(screen.getByText('Para projetos de consultoria')).toBeTruthy()
    expect(screen.getByText(/2 seções/)).toBeTruthy()
  })

  it('removes a template and refetches', async () => {
    const spy = setup([TEMPLATE])
    fireEvent.click(await screen.findByRole('button', { name: /remover/i }))
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Template removido.'),
    )
    const gets = spy.mock.calls.filter(
      ([, init]) => (init?.method ?? 'GET') === 'GET',
    )
    expect(gets.length).toBeGreaterThanOrEqual(2)
  })

  it('reports a delete failure', async () => {
    setup([TEMPLATE], {
      method: 'DELETE',
      match: '/proposal-templates/tpl1',
      status: 409,
      error: 'Template em uso',
    })
    fireEvent.click(await screen.findByRole('button', { name: /remover/i }))
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith('Template em uso'),
    )
  })
})
