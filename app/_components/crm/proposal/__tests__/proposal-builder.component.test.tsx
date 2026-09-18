import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchBody, mockFetch } from '@/src/__tests__/component-utils'
import { ProposalBuilder } from '../proposal-builder'

const WS = 'ws_1'

// The builder mounts every section editor, the calendar and three selects;
// the first (cold) render alone can exceed the 5s default on a busy runner.
vi.setConfig({ testTimeout: 20_000 })

const replace = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace, refresh: vi.fn() }),
}))

const notify = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('@/lib/notify', () => ({ notify }))

vi.mock('@/src/hooks/use-crm-workspace-lookups', () => ({
  useCrmWorkspaceLookups: () => ({
    lookups: {
      maps: { users: { u1: 'Ana Gestora' }, companies: {} },
      options: { users: [], companies: [], people: [], opportunities: [] },
    },
  }),
}))

// Preview + metrics drawer are separate screens; stub them to expose only
// the props the builder feeds them.
vi.mock('../proposal-preview-panel', () => ({
  ProposalPreviewPanel: (p: {
    name: string
    sections: { type: string; enabled: boolean }[]
    canShare: boolean
  }) => (
    <div data-testid='preview'>
      <span>preview:{p.name}</span>
      <span>
        enabled:
        {p.sections
          .filter((s) => s.enabled)
          .map((s) => s.type)
          .join(',')}
      </span>
      <span>share:{String(p.canShare)}</span>
    </div>
  ),
}))
vi.mock('../proposal-metrics-drawer', () => ({
  ProposalMetricsDrawer: () => null,
}))

const EXISTING = {
  id: 'pr1',
  name: 'Implantação ERP',
  status: 'DRAFT',
  companyId: null,
  contactId: null,
  opportunityId: null,
  responsibleId: 'u1',
  validUntil: null,
  shareToken: 'tok',
  sections: [
    {
      id: 's1',
      type: 'COVER',
      order: 0,
      enabled: true,
      content: { type: 'COVER', title: 'Capa ERP' },
    },
  ],
}

function renderBuilder(
  props: Partial<Parameters<typeof ProposalBuilder>[0]> = {},
) {
  return render(
    <ProposalBuilder
      workspaceId={WS}
      slug='acme'
      proposalId='new'
      currentUserId='u1'
      {...props}
    />,
  )
}

function sectionLabels() {
  return Array.from(
    document.querySelectorAll('aside button:not([aria-label]) span'),
  ).map((s) => s.textContent)
}

describe('<ProposalBuilder /> new proposal', () => {
  it('starts as a disabled-send draft with all sections off', () => {
    mockFetch([])
    renderBuilder()
    expect(screen.getByText('Rascunho')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: /^enviar$/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)
    expect(screen.queryByRole('button', { name: /métricas/i })).toBeNull()
    expect(screen.getByText('enabled:')).toBeTruthy()
    expect(sectionLabels()[0]).toBe('Capa')
  })

  it('refuses to save as template before the proposal exists', () => {
    mockFetch([])
    renderBuilder()
    fireEvent.click(
      screen.getByRole('button', { name: /salvar como template/i }),
    )
    expect(notify.error).toHaveBeenCalledWith(
      'Salve a proposta antes de gerar um template.',
    )
  })

  it('creates the proposal after the debounce and redirects to it', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: /crm\/proposals$/,
        data: { id: 'pr9', shareToken: 'tk9' },
      },
      { method: 'PATCH', match: '/crm/proposals/pr9', data: {} },
    ])
    renderBuilder()
    fireEvent.change(screen.getByPlaceholderText('Nome da proposta'), {
      target: { value: 'Proposta Acme' },
    })

    await waitFor(
      () => expect(replace).toHaveBeenCalledWith('/acme/crm/proposals/pr9'),
      { timeout: 3000 },
    )
    const body = fetchBody(spy, /crm\/proposals$/)
    expect(body).toMatchObject({ name: 'Proposta Acme', responsibleId: 'u1' })
    expect(body.sections).toHaveLength(9)
    expect(body.companyId).toBeUndefined()
  })

  it('reports a creation failure', async () => {
    mockFetch([
      {
        method: 'POST',
        match: /crm\/proposals$/,
        status: 403,
        error: 'Limite de propostas atingido',
      },
    ])
    renderBuilder()
    fireEvent.change(screen.getByPlaceholderText('Nome da proposta'), {
      target: { value: 'X' },
    })
    await waitFor(
      () =>
        expect(notify.error).toHaveBeenCalledWith(
          'Limite de propostas atingido',
        ),
      { timeout: 3000 },
    )
    expect(replace).not.toHaveBeenCalled()
  })

  it('selects a section, toggles it on and reorders it', () => {
    mockFetch([])
    renderBuilder()

    fireEvent.click(
      screen.getByRole('button', { name: /condições comerciais/i }),
    )
    expect(
      screen.getByText('(seção desabilitada — não aparece na proposta)'),
    ).toBeTruthy()
    expect(screen.getByLabelText('Condições de pagamento')).toBeTruthy()

    const checkboxes = screen.getAllByRole('checkbox')
    // COMMERCIAL_TERMS is the 7th section.
    fireEvent.click(checkboxes[6])
    expect(
      screen.queryByText('(seção desabilitada — não aparece na proposta)'),
    ).toBeNull()
    expect(screen.getByText('enabled:COMMERCIAL_TERMS')).toBeTruthy()

    const up = screen.getAllByRole('button', { name: 'Mover para cima' })
    const down = screen.getAllByRole('button', { name: 'Mover para baixo' })
    expect((up[0] as HTMLButtonElement).disabled).toBe(true)
    expect((down.at(-1) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(down[0])
    expect(sectionLabels().slice(0, 2)).toEqual([
      'Apresentação da empresa',
      'Capa',
    ])
  })

  it('prefills name and sections from a template', async () => {
    mockFetch([
      {
        match: '/proposal-templates/tpl1',
        data: {
          id: 'tpl1',
          name: 'Consultoria padrão',
          sections: [
            {
              id: 't1',
              type: 'SCOPE',
              order: 0,
              enabled: true,
              defaultContent: null,
            },
          ],
        },
      },
      { method: 'POST', match: /crm\/proposals$/, data: { id: 'p1' } },
    ])
    renderBuilder({ initialTemplateId: 'tpl1' })
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText('Nome da proposta') as HTMLInputElement)
          .value,
      ).toBe('Consultoria padrão'),
    )
    expect(screen.getByText('enabled:SCOPE')).toBeTruthy()
  })

  it('notifies when the template cannot be loaded', async () => {
    mockFetch([{ match: '/proposal-templates/x', status: 404, error: 'nf' }])
    renderBuilder({ initialTemplateId: 'x' })
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        'Não foi possível carregar o template.',
      ),
    )
  })
})

describe('<ProposalBuilder /> existing proposal', () => {
  it('hydrates the saved proposal', async () => {
    mockFetch([
      { method: 'PATCH', match: '/crm/proposals/pr1', data: {} },
      { match: '/crm/proposals/pr1', data: EXISTING },
    ])
    renderBuilder({ proposalId: 'pr1' })
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText('Nome da proposta') as HTMLInputElement)
          .value,
      ).toBe('Implantação ERP'),
    )
    expect(screen.getByRole('button', { name: /métricas/i })).toBeTruthy()
    expect(screen.getByText('enabled:COVER')).toBeTruthy()
    expect(screen.getByDisplayValue('Capa ERP')).toBeTruthy()
    expect(screen.getByText('share:false')).toBeTruthy()
  })

  it('sends the proposal and hides the send button afterwards', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/crm/proposals/pr1/send',
        data: { ...EXISTING, status: 'SENT' },
      },
      { method: 'PATCH', match: '/crm/proposals/pr1', data: {} },
      { match: '/crm/proposals/pr1', data: EXISTING },
    ])
    renderBuilder({ proposalId: 'pr1' })
    const send = await screen.findByRole('button', { name: /^enviar$/i })
    await waitFor(() =>
      expect((send as HTMLButtonElement).disabled).toBe(false),
    )

    fireEvent.click(send)
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Proposta enviada. O link público já está ativo.',
      ),
    )
    expect(screen.getByText('Enviada')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /^enviar$/i })).toBeNull()
    expect(screen.getByText('share:true')).toBeTruthy()
  })

  it('saves as template once the proposal exists', async () => {
    mockFetch([
      {
        method: 'POST',
        match: '/crm/proposals/pr1/save-as-template',
        data: { id: 'tpl2' },
      },
      { method: 'PATCH', match: '/crm/proposals/pr1', data: {} },
      { match: '/crm/proposals/pr1', data: EXISTING },
    ])
    renderBuilder({ proposalId: 'pr1' })
    await screen.findByDisplayValue('Implantação ERP')
    fireEvent.click(
      screen.getByRole('button', { name: /salvar como template/i }),
    )
    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        'Template salvo. Disponível ao criar novas propostas.',
      ),
    )
  })
})
