import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-activity.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { recordCrmActivity } from '../crm-activity-recorder'

const mockedActivityRepo = vi.mocked(CrmActivityRepository)

describe('recordCrmActivity()', () => {
  it('should do nothing when the record has no id', async () => {
    await recordCrmActivity({
      workspaceId: 'ws1',
      actorUserId: 'u1',
      entity: 'company',
      event: 'created',
      record: { name: 'Acme' },
    })

    expect(mockedActivityRepo.record).not.toHaveBeenCalled()
  })

  it('should use the record id as the link for its own entity', async () => {
    mockedActivityRepo.record.mockResolvedValue(ok({} as never))

    await recordCrmActivity({
      workspaceId: 'ws1',
      actorUserId: 'u1',
      entity: 'company',
      event: 'created',
      record: { id: 'c1', name: 'Acme' },
    })

    expect(mockedActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        actorUserId: 'u1',
        action: 'CREATED',
        entity: 'company',
        entityId: 'c1',
        companyId: 'c1',
        personId: undefined,
        opportunityId: undefined,
        summary: 'criou Empresa Acme',
      }),
    )
  })

  it('should resolve links from FKs for a child entity', async () => {
    mockedActivityRepo.record.mockResolvedValue(ok({} as never))

    await recordCrmActivity({
      workspaceId: 'ws1',
      actorUserId: 'u1',
      entity: 'task',
      event: 'updated',
      record: {
        id: 't1',
        title: 'Ligar pro cliente',
        companyId: 'c1',
        personId: 'p1',
        opportunityId: 'o1',
      },
    })

    expect(mockedActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'task',
        entityId: 't1',
        action: 'UPDATED',
        companyId: 'c1',
        personId: 'p1',
        opportunityId: 'o1',
        summary: 'atualizou Tarefa Ligar pro cliente',
      }),
    )
  })

  it('should fall back to pointOfContactId when personId is absent', async () => {
    mockedActivityRepo.record.mockResolvedValue(ok({} as never))

    await recordCrmActivity({
      workspaceId: 'ws1',
      actorUserId: 'u1',
      entity: 'opportunity',
      event: 'deleted',
      record: { id: 'o1', name: 'Negócio X', pointOfContactId: 'p2' },
    })

    expect(mockedActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'opportunity',
        entityId: 'o1',
        personId: 'p2',
        summary: 'removeu Oportunidade Negócio X',
      }),
    )
  })

  it('should omit the record name from the summary when absent', async () => {
    mockedActivityRepo.record.mockResolvedValue(ok({} as never))

    await recordCrmActivity({
      workspaceId: 'ws1',
      actorUserId: 'u1',
      entity: 'note',
      event: 'created',
      record: { id: 'n1' },
    })

    expect(mockedActivityRepo.record).toHaveBeenCalledWith(
      expect.objectContaining({ summary: 'criou Anotação' }),
    )
  })
})
