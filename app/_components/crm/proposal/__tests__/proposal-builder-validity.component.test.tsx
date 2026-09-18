import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspacePermissionsProvider } from '@/app/_components/workspace/workspace-permissions'
import { mockFetch } from '@/src/__tests__/component-utils'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import { ProposalBuilder } from '../proposal-builder'

const WS = 'ws_1'

vi.setConfig({ testTimeout: 20_000 })

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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
vi.mock('../proposal-preview-panel', () => ({
  ProposalPreviewPanel: () => null,
}))
vi.mock('../proposal-metrics-drawer', () => ({
  ProposalMetricsDrawer: () => null,
}))

const EXPIRED = {
  id: 'pr1',
  name: 'Implantação ERP',
  status: 'EXPIRED',
  isExpired: true,
  companyId: null,
  contactId: null,
  opportunityId: null,
  responsibleId: 'u1',
  validUntil: '2026-01-10T15:00:00.000Z',
  shareToken: 'tok',
  sections: [],
}

describe('<ProposalBuilder /> validity', () => {
  it('keeps the default validity applied by the server on creation', async () => {
    const patches: unknown[] = []
    mockFetch([
      {
        method: 'POST',
        match: /crm\/proposals$/,
        data: {
          id: 'pr9',
          shareToken: 'tk9',
          status: 'DRAFT',
          validUntil: '2026-10-04T02:59:59.999Z',
        },
      },
      {
        method: 'PATCH',
        match: '/crm/proposals/pr9',
        handler: (_url, init) => {
          patches.push(JSON.parse(String(init?.body)))
          return { id: 'pr9', status: 'DRAFT' }
        },
      },
    ])
    render(
      <ProposalBuilder
        workspaceId={WS}
        slug='acme'
        proposalId='new'
        currentUserId='u1'
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nome da proposta'), {
      target: { value: 'Proposta Acme' },
    })

    await waitFor(() => expect(patches.length).toBeGreaterThan(0), {
      timeout: 4000,
    })
    expect(patches.at(-1)).toMatchObject({
      validUntil: '2026-10-04T02:59:59.999Z',
    })
  })

  it('tells a member to ask an admin to extend an expired proposal', async () => {
    mockFetch([{ match: '/crm/proposals/pr1', data: EXPIRED }])
    render(
      <WorkspacePermissionsProvider
        value={{
          isPrivileged: false,
          permissions: SYSTEM_PROFILE_PERMISSIONS.MEMBER,
        }}
      >
        <ProposalBuilder
          workspaceId={WS}
          slug='acme'
          proposalId='pr1'
          currentUserId='u1'
        />
      </WorkspacePermissionsProvider>,
    )

    expect(
      await screen.findByText(/peça a um administrador do crm/i),
    ).toBeTruthy()
  })

  it('tells an admin how to reactivate an expired proposal', async () => {
    mockFetch([{ match: '/crm/proposals/pr1', data: EXPIRED }])
    render(
      <WorkspacePermissionsProvider
        value={{ isPrivileged: true, permissions: null }}
      >
        <ProposalBuilder
          workspaceId={WS}
          slug='acme'
          proposalId='pr1'
          currentUserId='u1'
        />
      </WorkspacePermissionsProvider>,
    )

    expect(
      await screen.findByText(/nova data de validade \(futura\)/i),
    ).toBeTruthy()
  })
})
