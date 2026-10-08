import { act, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const push = vi.fn()

import { RouteShortcuts } from '../route-shortcuts'
import { ShortcutsProvider } from '../shortcuts-provider'

function press(key: string) {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
    )
  })
}

describe('RouteShortcuts', () => {
  it('maps the module G sequences to its pages', () => {
    render(
      <ShortcutsProvider navigate={push}>
        <RouteShortcuts
          routes={[
            { id: 'sd.go-tickets', href: '/agro/servicedesk/tickets' },
            { id: 'sd.go-incidents', href: '/agro/servicedesk/incidents' },
          ]}
        />
      </ShortcutsProvider>,
    )
    press('g')
    press('t')
    expect(push).toHaveBeenCalledWith('/agro/servicedesk/tickets')
    press('g')
    press('1')
    expect(push).toHaveBeenCalledWith('/agro/servicedesk/incidents')
  })
})
