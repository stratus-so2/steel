import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { mockFetch } from '@/src/__tests__/component-utils'
import type { CrmActivityDTO } from '@/types/crm-activity'
import { CrmRecordTimeline } from '../crm-record-timeline'

function activity(overrides: Partial<CrmActivityDTO>): CrmActivityDTO {
  return {
    id: 'a1',
    workspaceId: 'ws1',
    actorUserId: 'u1',
    action: 'CREATED',
    entity: 'person',
    entityId: 'p1',
    companyId: null,
    personId: 'p1',
    opportunityId: null,
    summary: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString()

describe('<CrmRecordTimeline />', () => {
  it('shows a loading state and then the empty state', async () => {
    mockFetch([{ match: '/crm/activities', data: [] }])
    render(<CrmRecordTimeline workspaceId='ws1' personId='p1' />)

    expect(screen.getByText('Carregando…')).toBeTruthy()
    expect(await screen.findByText('Sem atividade ainda.')).toBeTruthy()
  })

  it('filters the feed by the record it belongs to', async () => {
    const fetchSpy = mockFetch([{ match: '/crm/activities', data: [] }])
    render(<CrmRecordTimeline workspaceId='ws1' opportunityId='o9' />)

    await screen.findByText('Sem atividade ainda.')
    expect(String(fetchSpy.mock.calls[0][0])).toBe(
      '/api/workspaces/ws1/crm/activities?opportunityId=o9',
    )
  })

  it('resolves actors, falls back to summaries/verbs and relative times', async () => {
    mockFetch([
      {
        match: '/crm/activities',
        data: [
          activity({
            id: 'a1',
            actorUserId: 'u1',
            summary: 'criou a pessoa Ada',
            createdAt: minutesAgo(0),
          }),
          activity({
            id: 'a2',
            actorUserId: 'ghost',
            action: 'UPDATED',
            createdAt: minutesAgo(5),
          }),
          activity({
            id: 'a3',
            actorUserId: null,
            action: 'DELETED',
            createdAt: minutesAgo(60 * 3),
          }),
          activity({
            id: 'a4',
            action: 'UPDATED',
            summary: 'moveu de etapa',
            createdAt: minutesAgo(60 * 24 * 2),
          }),
        ],
      },
    ])
    render(
      <CrmRecordTimeline
        workspaceId='ws1'
        personId='p1'
        userMap={{ u1: 'Ana Souza' }}
      />,
    )

    expect(await screen.findByText('criou a pessoa Ada')).toBeTruthy()
    expect(screen.getAllByText('Ana Souza')).toHaveLength(2)
    expect(screen.getByText('Alguém')).toBeTruthy()
    expect(screen.getByText('Sistema')).toBeTruthy()
    expect(screen.getByText(/atualizou/)).toBeTruthy()
    expect(screen.getByText(/removeu/)).toBeTruthy()
    expect(screen.getByText('agora')).toBeTruthy()
    expect(screen.getByText('há 5min')).toBeTruthy()
    expect(screen.getByText('há 3h')).toBeTruthy()
    expect(screen.getByText('há 2d')).toBeTruthy()
  })

  it('degrades to the empty state when the request fails', async () => {
    mockFetch([{ match: '/crm/activities', status: 500, error: 'boom' }])
    render(<CrmRecordTimeline workspaceId='ws1' companyId='c1' />)
    expect(await screen.findByText('Sem atividade ainda.')).toBeTruthy()
  })
})
