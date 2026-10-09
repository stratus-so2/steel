import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// The header's own job is the layout; its pieces have their own suites.
vi.mock('../../navigation/mobile-nav/mobile-nav-drawer', () => ({
  MobileNavDrawer: () => <button type='button'>menu</button>,
}))
vi.mock(
  '../../workspace/workspace-dropdown/workspace-dropdown-selector',
  () => ({
    WorkSpaceDropdown: () => <span>workspace</span>,
  }),
)
vi.mock('../../search/global-search', () => ({
  GlobalSearch: () => <button type='button'>buscar</button>,
}))
vi.mock('../header-inbox-button', () => ({
  HeaderInboxButton: () => <button type='button'>inbox</button>,
}))
vi.mock('../../user/user-dropdown-helper', () => ({
  UserDropdownHelper: () => <button type='button'>ajuda</button>,
}))
vi.mock('../../user/user-dropdown-profile', () => ({
  UserDropdownProfile: () => <button type='button'>perfil</button>,
}))

import { UserHeader } from '../header-layout-user'

function renderHeader() {
  const { container } = render(<UserHeader slug='agro' workspaceId='ws_1' />)
  return container.querySelector('[data-slot=user-header]') as HTMLElement
}

describe('<UserHeader /> layout', () => {
  it('centres the search in a three-column grid with equal side tracks from lg up', () => {
    const header = renderHeader()
    expect(header.className).toContain('lg:grid')
    expect(header.className).toContain(
      'lg:grid-cols-[minmax(0,1fr)_minmax(16rem,28rem)_minmax(0,1fr)]',
    )
    // Vertically centred in the bar.
    expect(header.className).toContain('items-center')

    const [left, middle, right] = Array.from(header.children) as HTMLElement[]
    expect(left.textContent).toBe('menuworkspace')
    expect(middle.getAttribute('data-slot')).toBe('user-header-search')
    expect(middle.textContent).toBe('buscar')
    expect(middle.className).toContain('lg:justify-center')
    expect(right.textContent).toBe('inboxajudaperfil')
    expect(right.className).toContain('lg:justify-self-end')
  })

  it('keeps the search icon with the actions on the right below lg', () => {
    const header = renderHeader()
    const [left, middle] = Array.from(header.children) as HTMLElement[]
    // The left group grows, pushing the search icon and the actions right.
    expect(left.className).toContain('flex-1')
    expect(middle.className).toContain('shrink-0')
    // 40px touch targets on phones, for the search icon too.
    expect(middle.className).toContain('max-md:[&_[data-slot=button]]:size-10')
    expect(screen.getByRole('button', { name: 'buscar' })).toBeTruthy()
  })
})
