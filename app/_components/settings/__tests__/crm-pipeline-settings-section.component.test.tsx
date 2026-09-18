import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkspacePermissionsProvider } from '@/app/_components/workspace/workspace-permissions'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import { SYSTEM_PROFILE_PERMISSIONS } from '@/src/lib/permissions'
import { CrmPipelineSettingsSection } from '../crm-pipeline-settings-section'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'
const URL = `/api/workspaces/${WS}/crm/settings`

const DEFAULTS = {
  workspaceId: WS,
  leadReopenStage: 'RECEIVED',
  proposalValidityDays: 15,
  notifyProposalExpiry: true,
  isDefault: true,
  updatedById: null,
  updatedAt: null,
}

function setup(privileged: boolean) {
  const spy = mockFetch([
    { match: URL, data: DEFAULTS },
    {
      method: 'PATCH',
      match: URL,
      handler: (_url, init) => ({
        ...DEFAULTS,
        ...JSON.parse(String(init?.body)),
        isDefault: false,
      }),
    },
  ])
  renderWithQuery(
    <WorkspacePermissionsProvider
      value={{
        isPrivileged: privileged,
        permissions: privileged ? null : SYSTEM_PROFILE_PERMISSIONS.MEMBER,
      }}
    >
      <CrmPipelineSettingsSection workspaceId={WS} />
    </WorkspacePermissionsProvider>,
  )
  return spy
}

describe('<CrmPipelineSettingsSection />', () => {
  it('shows the default values', async () => {
    setup(true)
    const days = await screen.findByLabelText(/validade padrão/i)
    expect((days as HTMLInputElement).value).toBe('15')
    expect(screen.getByText('Lead recebido')).toBeTruthy()
  })

  it('lets an admin save a new validity', async () => {
    const spy = setup(true)
    const days = await screen.findByLabelText(/validade padrão/i)

    fireEvent.change(days, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Configurações salvas'),
    )
    expect(fetchBody(spy, URL, 'PATCH')).toEqual({
      leadReopenStage: 'RECEIVED',
      proposalValidityDays: 30,
      notifyProposalExpiry: true,
    })
  })

  it('refuses an out-of-range validity without calling the API', async () => {
    const spy = setup(true)
    const days = await screen.findByLabelText(/validade padrão/i)

    fireEvent.change(days, { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(notify.error).toHaveBeenCalled()
    expect(fetchBody(spy, URL, 'PATCH')).toBeUndefined()
  })

  it('is read-only for members', async () => {
    setup(false)
    const days = await screen.findByLabelText(/validade padrão/i)
    expect((days as HTMLInputElement).disabled).toBe(true)
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull()
    expect(
      screen.getByText(/somente proprietários e administradores/i),
    ).toBeTruthy()
  })
})
