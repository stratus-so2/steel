import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockFetch, renderWithQuery } from '@/src/__tests__/component-utils'
import { CrmEmailTemplatesTable } from '../crm-email-templates-table'

const WS = 'ws_1'

const push = vi.hoisted(() => vi.fn())
const opened = vi.hoisted(() => ({ results: [] as unknown[] }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))
vi.mock('@/src/hooks/use-crm-workspace-lookups', () => ({
  useCrmWorkspaceLookups: () => ({ lookups: undefined }),
}))
vi.mock('@/app/_components/crm/table/data-table', () => ({
  DataTable: (props: {
    data: { id: string; name: string; kind: string }[]
    onOpenRecord?: (record: unknown) => unknown
  }) => (
    <ul>
      {props.data.map((r) => (
        <li key={r.id}>
          <button
            type='button'
            onClick={() => opened.results.push(props.onOpenRecord?.(r))}
          >
            {r.name}
          </button>
        </li>
      ))}
    </ul>
  ),
}))

function setup() {
  mockFetch([
    {
      match: '/crm/email-templates',
      data: [
        { id: 't1', name: 'Newsletter visual', kind: 'BUILDER' },
        { id: 't2', name: 'HTML antigo', kind: 'LEGACY' },
      ],
    },
  ])
  renderWithQuery(<CrmEmailTemplatesTable workspaceId={WS} slug='acme' />)
}

describe('<CrmEmailTemplatesTable />', () => {
  it('links to the template gallery', async () => {
    setup()
    await screen.findByText('Newsletter visual')
    expect(
      screen
        .getByText(/galeria de modelos/i)
        .closest('a')
        ?.getAttribute('href'),
    ).toBe('/acme/crm/email-templates/new')
  })

  it('opens builder templates in the visual editor', async () => {
    setup()
    fireEvent.click(await screen.findByText('Newsletter visual'))
    expect(push).toHaveBeenCalledWith('/acme/crm/email-templates/t1')
  })

  it('keeps the default record panel for free-HTML templates', async () => {
    setup()
    push.mockClear()
    opened.results = []
    fireEvent.click(await screen.findByText('HTML antigo'))
    expect(push).not.toHaveBeenCalled()
    expect(opened.results).toEqual([false])
  })
})
