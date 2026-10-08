import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import {
  importSummary,
  WorkspaceSettingsMemberImportDialog,
} from '../dialog/workspace-settings-member-import-dialog'
import { WorkspaceSettingsMemberInviteDialog } from '../dialog/workspace-settings-member-invite-dialog'
import { memberRoleLabel } from '../member-roles'
import { isSeatLimitReached } from '../workspace-settings-member-header'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = 'ws_1'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<WorkspaceSettingsMemberInviteDialog />', () => {
  it('sends the invitation with the chosen role and closes', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/invitations`,
        status: 201,
        data: { id: 'inv_1' },
      },
    ])
    renderWithQuery(<WorkspaceSettingsMemberInviteDialog workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar membro' }))
    expect(await screen.findByText('Convidar membro')).toBeTruthy()

    const submit = screen.getByRole('button', { name: 'Convidar' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)
    // The role select shows the pt-BR label, not the enum.
    expect(screen.getByLabelText('Cargo').textContent).toContain('Membro')

    fireEvent.change(screen.getByLabelText('E-mail do convidado'), {
      target: { value: 'nova@empresa.com' },
    })
    fireEvent.click(screen.getByLabelText('Cargo'))
    const option = await screen.findByRole('option', { name: 'Administrador' })
    fireEvent.pointerDown(option, { pointerType: 'mouse' })
    fireEvent.click(option)
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith('Convite enviado'),
    )
    expect(fetchBody(spy, `/api/workspaces/${WS}/invitations`)).toEqual({
      email: 'nova@empresa.com',
      role: 'ADMIN',
    })
    await waitFor(() =>
      expect(screen.queryByText('Convidar membro')).toBeNull(),
    )
  })

  it('surfaces the server error (e.g. seat limit) and stays open', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/invitations`,
        status: 403,
        error: 'Limite de assentos do plano atingido',
      },
    ])
    renderWithQuery(<WorkspaceSettingsMemberInviteDialog workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Adicionar membro' }))
    fireEvent.change(await screen.findByLabelText('E-mail do convidado'), {
      target: { value: 'nova@empresa.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Convidar' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error.mock.calls[0][1]).toBe(
      'Não foi possível enviar o convite',
    )
    expect(screen.getByText('Convidar membro')).toBeTruthy()
  })
})

describe('<WorkspaceSettingsMemberImportDialog />', () => {
  function pickFile(content = 'email,role\na@b.com,ADMIN\n') {
    const file = new File([content], 'membros.csv', { type: 'text/csv' })
    fireEvent.change(screen.getByLabelText('Arquivo CSV'), {
      target: { files: [file] },
    })
    return file
  }

  it('uploads the CSV and reports the summary', async () => {
    const spy = mockFetch([
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/members/import`,
        status: 201,
        data: { invited: 2, skipped: 1, errors: 0, rows: [] },
      },
    ])
    renderWithQuery(<WorkspaceSettingsMemberImportDialog workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }))
    expect(await screen.findByText('Importar membros via CSV')).toBeTruthy()
    expect(
      (screen.getByRole('button', { name: 'Importar' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true)

    pickFile()
    expect(screen.getByText('membros.csv')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }))

    await waitFor(() =>
      expect(notify.success).toHaveBeenCalledWith(
        '2 convites enviados, 1 ignorado',
      ),
    )
    const call = spy.mock.calls.find(([input]) =>
      String(input).includes('/members/import'),
    )
    expect(call?.[1]?.body).toBeInstanceOf(FormData)
  })

  it('warns when some rows failed', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/members/import`,
        status: 201,
        data: { invited: 1, skipped: 0, errors: 2, rows: [] },
      },
    ])
    renderWithQuery(<WorkspaceSettingsMemberImportDialog workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }))
    await screen.findByText('Importar membros via CSV')
    pickFile()
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }))

    await waitFor(() =>
      expect(notify.warning).toHaveBeenCalledWith(
        '1 convite enviado, 2 com erro',
      ),
    )
  })

  it('reports an invalid spreadsheet', async () => {
    mockFetch([
      {
        method: 'POST',
        match: `/api/workspaces/${WS}/members/import`,
        status: 422,
        error: 'A planilha precisa de uma coluna "email"',
      },
    ])
    renderWithQuery(<WorkspaceSettingsMemberImportDialog workspaceId={WS} />)

    fireEvent.click(screen.getByRole('button', { name: 'Importar CSV' }))
    await screen.findByText('Importar membros via CSV')
    pickFile('nome\nAna\n')
    fireEvent.click(screen.getByRole('button', { name: 'Importar' }))

    await waitFor(() => expect(notify.error).toHaveBeenCalled())
    expect(notify.error.mock.calls[0][1]).toBe(
      'Não foi possível importar o CSV',
    )
  })
})

describe('member helpers', () => {
  it('summarizes an import in pt-BR', () => {
    expect(importSummary({ invited: 0, skipped: 0, errors: 0, rows: [] })).toBe(
      '0 convites enviados',
    )
    expect(importSummary({ invited: 1, skipped: 2, errors: 1, rows: [] })).toBe(
      '1 convite enviado, 2 ignorados, 1 com erro',
    )
  })

  it('labels roles and falls back to the raw value', () => {
    expect(memberRoleLabel('OWNER')).toBe('Dono')
    expect(memberRoleLabel('GUEST')).toBe('GUEST')
  })

  it('detects a full plan, never an unlimited one', () => {
    expect(isSeatLimitReached(undefined)).toBe(false)
    expect(isSeatLimitReached({ used: 99, limit: null })).toBe(false)
    expect(isSeatLimitReached({ used: 11, limit: 12 })).toBe(false)
    expect(isSeatLimitReached({ used: 12, limit: 12 })).toBe(true)
  })
})
