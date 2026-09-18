import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmCustomFieldDefinition,
  seedCrmCustomFieldValue,
} from '@/src/__tests__/factories/crm-custom-field.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmCustomFieldDefinitionRepository,
  CrmCustomFieldValueRepository,
} from '../crm-custom-field.repository'

describe('CrmCustomFieldDefinitionRepository', () => {
  describe('create()', () => {
    it('should assign the next position scoped to the entity', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        entity: 'COMPANY',
      })

      const result = await CrmCustomFieldDefinitionRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        entity: 'COMPANY',
        key: 'segment2',
        label: 'Segmento 2',
      })

      const definition = expectOk(result)
      expect(definition.position).toBe(1)
    })

    it('should return CRM_CUSTOM_FIELD_CONFLICT on duplicate key for the same entity', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'segment',
      })

      const result = await CrmCustomFieldDefinitionRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        entity: 'COMPANY',
        key: 'segment',
        label: 'Dup',
      })

      expectErr(result, 'CRM_CUSTOM_FIELD_CONFLICT')
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by entity', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const company = await seedCrmCustomFieldDefinition(
        workspace.id,
        user.id,
        { entity: 'COMPANY', key: 'a' },
      )
      await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        entity: 'PERSON',
        key: 'b',
      })

      const list = expectOk(
        await CrmCustomFieldDefinitionRepository.listByWorkspace(workspace.id, {
          entity: 'COMPANY',
        }),
      )
      expect(list.map((d) => d.id)).toEqual([company.id])
    })
  })
})

describe('CrmCustomFieldValueRepository', () => {
  describe('upsert()', () => {
    it('should create then update the value for the same record', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const definition = await seedCrmCustomFieldDefinition(
        workspace.id,
        user.id,
      )
      const recordId = 'record-1'

      const created = expectOk(
        await CrmCustomFieldValueRepository.upsert(
          definition.id,
          recordId,
          'Enterprise',
        ),
      )
      expect(created.value).toBe('Enterprise')

      const updated = expectOk(
        await CrmCustomFieldValueRepository.upsert(
          definition.id,
          recordId,
          'SMB',
        ),
      )
      expect(updated.id).toBe(created.id)
      expect(updated.value).toBe('SMB')
    })
  })

  describe('listByRecord()', () => {
    it('should list values for a record', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const definition = await seedCrmCustomFieldDefinition(
        workspace.id,
        user.id,
      )
      await seedCrmCustomFieldValue(definition.id, 'record-1', 'Enterprise')

      const list = expectOk(
        await CrmCustomFieldValueRepository.listByRecord('record-1'),
      )
      expect(list).toHaveLength(1)
      expect(list[0].value).toBe('Enterprise')
    })
  })

  describe('listByRecords()', () => {
    it('should list values across multiple records', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const definition = await seedCrmCustomFieldDefinition(
        workspace.id,
        user.id,
      )
      await seedCrmCustomFieldValue(definition.id, 'record-1', 'Enterprise')
      await seedCrmCustomFieldValue(definition.id, 'record-2', 'SMB')

      const list = expectOk(
        await CrmCustomFieldValueRepository.listByRecords([
          'record-1',
          'record-2',
        ]),
      )
      expect(list.map((v) => v.recordId).sort()).toEqual([
        'record-1',
        'record-2',
      ])
    })

    it('should return an empty list without querying for an empty input', async () => {
      const list = expectOk(
        await CrmCustomFieldValueRepository.listByRecords([]),
      )
      expect(list).toEqual([])
    })
  })

  describe('applyForRecord()', () => {
    it('should upsert multiple values in one transaction', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'a',
      })
      const b = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'b',
      })

      expectOk(
        await CrmCustomFieldValueRepository.applyForRecord([
          { definitionId: a.id, recordId: 'record-1', value: 'x' },
          { definitionId: b.id, recordId: 'record-1', value: 42 },
        ]),
      )

      const list = expectOk(
        await CrmCustomFieldValueRepository.listByRecord('record-1'),
      )
      expect(list).toHaveLength(2)
    })
  })
})

describe('CrmCustomFieldDefinitionRepository (lifecycle)', () => {
  describe('listByWorkspace()', () => {
    it('should order by position, hide deleted and other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const second = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'second',
        position: 1,
      })
      const first = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'first',
        entity: 'PERSON',
        position: 0,
      })
      await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'gone',
        deletedAt: new Date(),
      })
      await seedCrmCustomFieldDefinition(other.id, user.id)

      const list = expectOk(
        await CrmCustomFieldDefinitionRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((d) => d.id)).toEqual([first.id, second.id])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(
        prisma.crmCustomFieldDefinition,
        'findMany',
      ).mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await CrmCustomFieldDefinitionRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find within the workspace and not across workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const def = await seedCrmCustomFieldDefinition(workspace.id, user.id)

      expect(
        expectOk(
          await CrmCustomFieldDefinitionRepository.findById(
            def.id,
            workspace.id,
          ),
        ).id,
      ).toBe(def.id)
      expectErr(
        await CrmCustomFieldDefinitionRepository.findById(def.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(
        prisma.crmCustomFieldDefinition,
        'findFirst',
      ).mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await CrmCustomFieldDefinitionRepository.findById('d', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create() failures', () => {
    it('should return DATABASE_ERROR on non-unique failures (missing workspace)', async () => {
      const user = await seedUser()
      expectErr(
        await CrmCustomFieldDefinitionRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          entity: 'COMPANY',
          key: 'k',
          label: 'K',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update() / softDelete()', () => {
    it('should update the definition and then soft delete it', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const def = await seedCrmCustomFieldDefinition(workspace.id, user.id)

      const updated = expectOk(
        await CrmCustomFieldDefinitionRepository.update(def.id, {
          label: 'Setor',
          type: 'SELECT',
          options: ['A', 'B'],
          required: true,
          updatedById: user.id,
        }),
      )
      expect(updated).toMatchObject({
        label: 'Setor',
        type: 'SELECT',
        options: ['A', 'B'],
        required: true,
      })

      expectOk(await CrmCustomFieldDefinitionRepository.softDelete(def.id))
      expectErr(
        await CrmCustomFieldDefinitionRepository.findById(def.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR for a missing definition', async () => {
      expectErr(
        await CrmCustomFieldDefinitionRepository.update('missing', {
          label: 'x',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmCustomFieldDefinitionRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('should rewrite positions in the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'a',
        position: 0,
      })
      const b = await seedCrmCustomFieldDefinition(workspace.id, user.id, {
        key: 'b',
        position: 1,
      })

      expectOk(
        await CrmCustomFieldDefinitionRepository.reorder(workspace.id, [
          b.id,
          a.id,
        ]),
      )
      const list = expectOk(
        await CrmCustomFieldDefinitionRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((d) => d.id)).toEqual([b.id, a.id])
    })

    it('should refuse to reorder a definition from another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmCustomFieldDefinition(other.id, user.id)
      expectErr(
        await CrmCustomFieldDefinitionRepository.reorder(workspace.id, [
          foreign.id,
        ]),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmCustomFieldValueRepository (edge cases)', () => {
  it('should store null values as JSON null', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const def = await seedCrmCustomFieldDefinition(workspace.id, user.id)

    const stored = expectOk(
      await CrmCustomFieldValueRepository.upsert(def.id, 'record-1', null),
    )
    expect(stored.value).toBeNull()

    expectOk(
      await CrmCustomFieldValueRepository.applyForRecord([
        { definitionId: def.id, recordId: 'record-2', value: null },
      ]),
    )
    const [value] = expectOk(
      await CrmCustomFieldValueRepository.listByRecord('record-2'),
    )
    expect(value.value).toBeNull()
  })

  it('should be a no-op for an empty batch', async () => {
    const spy = vi.spyOn(prisma, '$transaction')
    expectOk(await CrmCustomFieldValueRepository.applyForRecord([]))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('should return DATABASE_ERROR when writes reference a missing definition', async () => {
    expectErr(
      await CrmCustomFieldValueRepository.upsert('missing', 'r', 'x'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmCustomFieldValueRepository.applyForRecord([
        { definitionId: 'missing', recordId: 'r', value: 'x' },
      ]),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when reads throw', async () => {
    vi.spyOn(prisma.crmCustomFieldValue, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await CrmCustomFieldValueRepository.listByRecord('r'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmCustomFieldValueRepository.listByRecords(['r']),
      'DATABASE_ERROR',
    )
  })
})
