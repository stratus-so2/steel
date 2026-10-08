import { fireEvent, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fetchBody,
  mockFetch,
  renderWithQuery,
} from '@/src/__tests__/component-utils'
import {
  DELETE_WORKSPACE_COPY,
  DeleteWorkspaceDialog,
  leaveWorkspace,
} from '../delete-workspace-dialog'

const notify = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}))
vi.mock('@/lib/notify', () => ({ notify }))

const WS = { id: 'ws_1', name: 'Acme', slug: 'acme' }
const API = `/api/workspaces/${WS.id}`

function renderDialog(onOpenChange = vi.fn(), onDeleted = vi.fn()) {
  renderWithQuery(
    <DeleteWorkspaceDialog
      open
      onOpenChange={onOpenChange}
      workspace={WS}
      onDeleted={onDeleted}
    />,
  )
  return { onOpenChange, onDeleted }
}

function confirmInput() {
  return screen.getByLabelText(/para confirmar/) as HTMLInputElement
}

function submit() {
  return screen.getByRole('button', {
    name: 'Excluir workspace',
  }) as HTMLButtonElement
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('<DeleteWorkspaceDialog />', () => {
  it('shows the exact product copy and the async note', () => {
    mockFetch([])
    renderDialog()
    expect(DELETE_WORKSPACE_COPY).toBe(
      'Excluir este workspace apaga permanentemente todos os projetos, páginas e dados de todos os membros. Nada pode ser recuperado — nem mesmo por nós. Continue somente se tiver certeza.',
    )
    expect(screen.getByText(DELETE_WORKSPACE_COPY)).toBeTruthy()
    expect(screen.getByText(/roda em segundo plano/)).toBeTruthy()
  })

  it('only enables the button when the slug is typed exactly', () => {
    mockFetch([])
    renderDialog()
    expect(submit().disabled).toBe(true)

    fireEvent.change(confirmInput(), { target: { value: 'Acme' } })
    expect(submit().disabled).toBe(true)

    fireEvent.change(confirmInput(), { target: { value: ' acme ' } })
    expect(submit().disabled).toBe(false)
  })

  it('does not submit without a match', () => {
    const spy = mockFetch([])
    renderDialog()
    fireEvent.submit(confirmInput().closest('form') as HTMLFormElement)
    expect(spy).not.toHaveBeenCalled()
  })

  it('queues the deletion and leaves the workspace', async () => {
    const spy = mockFetch([
      {
        method: 'DELETE',
        match: API,
        data: { operationId: 'op1', status: 'QUEUED', requestedAt: 'x' },
      },
    ])
    const { onDeleted } = renderDialog()

    fireEvent.change(confirmInput(), { target: { value: 'acme' } })
    fireEvent.click(submit())

    await waitFor(() => expect(onDeleted).toHaveBeenCalled())
    expect(fetchBody(spy, API, 'DELETE')).toEqual({ confirmation: 'acme' })
    expect(notify.success).toHaveBeenCalledWith(
      'Exclusão solicitada. O workspace será apagado em alguns minutos.',
    )
  })

  it('shows the API error and stays open', async () => {
    mockFetch([
      {
        method: 'DELETE',
        match: API,
        status: 409,
        error: 'Já existe uma operação em andamento para este workspace',
      },
    ])
    const { onDeleted } = renderDialog()

    fireEvent.change(confirmInput(), { target: { value: 'acme' } })
    fireEvent.click(submit())

    expect(
      await screen.findByText(
        'Já existe uma operação em andamento para este workspace',
      ),
    ).toBeTruthy()
    expect(onDeleted).not.toHaveBeenCalled()
  })

  it('falls back to a generic error message', async () => {
    mockFetch([{ method: 'DELETE', match: API, status: 500 }])
    renderDialog()
    fireEvent.change(confirmInput(), { target: { value: 'acme' } })
    fireEvent.click(submit())
    expect(await screen.findByText('Erro ao excluir workspace')).toBeTruthy()
  })

  it('cancel resets and closes', () => {
    mockFetch([])
    const { onOpenChange } = renderDialog()
    fireEvent.change(confirmInput(), { target: { value: 'acme' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(confirmInput().value).toBe('')
  })
})

describe('leaveWorkspace()', () => {
  it('reloads at the root', () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    leaveWorkspace()
    expect(assign).toHaveBeenCalledWith('/')
    vi.unstubAllGlobals()
  })
})
