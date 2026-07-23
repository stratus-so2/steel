import { describe, expect, it } from 'vitest'
import {
  seedCrmCustomFieldDefinition,
  seedCrmCustomFieldValue,
} from '@/src/__tests__/factories/crm-custom-field.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
