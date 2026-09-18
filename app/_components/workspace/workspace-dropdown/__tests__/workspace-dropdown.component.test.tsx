import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { WorkSpaceDropdown } from '../workspace-dropdown-selector'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn() }),
}))

const userHook = vi.hoisted(() => ({ useUser: vi.fn() }))
vi.mock('@/src/hooks/use-user', () => userHook)

const MEMBERSHIPS = [
  { workspaceId: 'w1', slug: 'acme', name: 'acme corp', role: 'OWNER' },
  { workspaceId: 'w2', slug: 'beta', name: 'Beta Ltda', role: 'MEMBER' },
]

function renderDropdown(currentSlug: string, memberships = MEMBERSHIPS) {
  userHook.useUser.mockReturnValue({
    data: { email: 'ana@empresa.com', memberships },
  })
  return render(<WorkSpaceDropdown currentSlug={currentSlug} />)
}

function openMenu() {
  fireEvent.click(screen.getByRole('button'))
}

describe('<WorkSpaceDropdown />', () => {
  it('shows the current workspace name and initial on the trigger', () => {
    renderDropdown('acme')
    const trigger = screen.getByRole('button')
    expect(trigger.textContent).toContain('A')
    expect(trigger.textContent).toContain('acme corp')
  })

  it('falls back to a placeholder while the user is loading', () => {
    userHook.useUser.mockReturnValue({ data: undefined })
    render(<WorkSpaceDropdown currentSlug='acme' />)
    expect(screen.getByRole('button').textContent).toContain(
      'Selecionar workspace',
    )
  })

  it('lists every workspace with its role and quick links', async () => {
    renderDropdown('acme')
    openMenu()

    expect(await screen.findByText('ana@empresa.com')).toBeTruthy()
    expect(screen.getByText('Beta Ltda')).toBeTruthy()
    expect(screen.getByText('Owner')).toBeTruthy()
    expect(screen.getByText('Member')).toBeTruthy()

    const settingsLinks = screen
      .getAllByText('Configurações')
      .map((el) => el.closest('a')?.getAttribute('href'))
    expect(settingsLinks).toEqual(['/acme/settings', '/beta/settings'])
    expect(
      screen.getByText('Criar workspace').closest('a')?.getAttribute('href'),
    ).toBe('/create-workspace')
    expect(
      screen
        .getByText('Convidar para workspace')
        .closest('a')
        ?.getAttribute('href'),
    ).toBe('/acme/settings/members')
  })

  it('navigates when another workspace is picked', async () => {
    renderDropdown('acme')
    openMenu()

    const beta = (await screen.findByText('Beta Ltda')).closest(
      '[role=menuitemradio]',
    ) as HTMLElement
    fireEvent.click(beta)

    expect(push).toHaveBeenCalledWith('/beta')
  })

  it('does not navigate when re-selecting the current workspace', async () => {
    renderDropdown('acme')
    openMenu()

    const acme = (
      await screen.findByText('acme corp', {
        selector: 'p',
      })
    ).closest('[role=menuitemradio]') as HTMLElement
    fireEvent.click(acme)

    expect(push).not.toHaveBeenCalled()
  })
})
