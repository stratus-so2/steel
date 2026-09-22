import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdCannedResponseRepository } from '../sd-canned-response.repository'
import { SdCustomFieldRepository } from '../sd-custom-field.repository'
import { SdPartRepository } from '../sd-part.repository'
import { SdTicketTemplateRepository } from '../sd-ticket-template.repository'

describe('SdCustomFieldRepository', () => {
  it('CRUD with unique key per entity, filters and reorder', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const asset = expectOk(
      await SdCustomFieldRepository.create(workspace.id, {
        entity: 'TICKET',
        key: 'assetTag',
        label: 'Patrimônio',
        type: 'TEXT',
      }),
    )
    const sameKeyOtherEntity = expectOk(
      await SdCustomFieldRepository.create(workspace.id, {
        entity: 'CUSTOMER',
        key: 'assetTag',
        label: 'Patrimônio',
        type: 'TEXT',
        active: false,
      }),
    )
    const conflict = expectErr(
      await SdCustomFieldRepository.create(workspace.id, {
        entity: 'TICKET',
        key: 'assetTag',
        label: 'Outro',
        type: 'NUMBER',
      }),
      'SD_CONFIG_CONFLICT',
    )
    expect(conflict.message).toBe(
      'Já existe um campo com esta chave nesta entidade',
    )

    expect(
      expectOk(await SdCustomFieldRepository.list(workspace.id)).map(
        (f) => f.id,
      ),
    ).toEqual([asset.id])
    expect(
      expectOk(
        await SdCustomFieldRepository.list(workspace.id, {
          entity: 'CUSTOMER',
          includeInactive: true,
        }),
      ).map((f) => f.id),
    ).toEqual([sameKeyOtherEntity.id])
    expect(expectOk(await SdCustomFieldRepository.list(other.id))).toEqual([])
    expectErr(
      await SdCustomFieldRepository.findById(asset.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )

    const updated = expectOk(
      await SdCustomFieldRepository.update(asset.id, workspace.id, {
        required: true,
        defaultValue: 'PAT-000',
      }),
    )
    expect(updated.defaultValue).toBe('PAT-000')
    const cleared = expectOk(
      await SdCustomFieldRepository.update(asset.id, workspace.id, {
        defaultValue: Prisma.JsonNull,
      }),
    )
    expect(cleared.defaultValue).toBeNull()

    expectOk(await SdCustomFieldRepository.reorder(workspace.id, [asset.id]))
    expectOk(await SdCustomFieldRepository.delete(asset.id, workspace.id))
    expectErr(
      await SdCustomFieldRepository.delete(asset.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdTicketTemplateRepository', () => {
  it('CRUD + filters + reorder', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const reset = expectOk(
      await SdTicketTemplateRepository.create(workspace.id, {
        ticketType: 'SERVICE_REQUEST',
        name: 'Reset de senha',
        tasks: [{ title: 'Confirmar identidade' }],
      }),
    )
    const link = expectOk(
      await SdTicketTemplateRepository.create(workspace.id, {
        ticketType: 'INCIDENT',
        name: 'Queda de link',
        active: false,
      }),
    )
    expect(
      expectOk(await SdTicketTemplateRepository.list(workspace.id)).map(
        (t) => t.id,
      ),
    ).toEqual([reset.id])
    expect(
      expectOk(
        await SdTicketTemplateRepository.list(workspace.id, {
          ticketType: 'INCIDENT',
          includeInactive: true,
        }),
      ).map((t) => t.id),
    ).toEqual([link.id])
    expect(expectOk(await SdTicketTemplateRepository.list(other.id))).toEqual(
      [],
    )
    expectErr(
      await SdTicketTemplateRepository.findById(reset.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdTicketTemplateRepository.update(reset.id, workspace.id, {
          portalVisible: true,
        }),
      ).portalVisible,
    ).toBe(true)
    expectOk(
      await SdTicketTemplateRepository.reorder(workspace.id, [
        link.id,
        reset.id,
      ]),
    )
    expectOk(await SdTicketTemplateRepository.delete(link.id, workspace.id))
    expectErr(
      await SdTicketTemplateRepository.findById(link.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdCannedResponseRepository', () => {
  it('CRUD with author, department and text filters', async () => {
    const [workspace, other, author] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser({ name: 'Carla' }),
    ])
    const dept = await prisma.sdDepartment.create({
      data: { workspaceId: workspace.id, name: 'N1' },
    })
    const general = expectOk(
      await SdCannedResponseRepository.create(workspace.id, author.id, {
        title: 'Saudação',
        shortcut: 'oi',
        body: 'Olá! Como posso ajudar?',
      }),
    )
    const n1 = expectOk(
      await SdCannedResponseRepository.create(workspace.id, author.id, {
        title: 'Reinicie o roteador',
        body: 'Desligue e ligue o roteador.',
        departmentId: dept.id,
      }),
    )
    expect(general.createdBy?.name).toBe('Carla')

    expect(
      expectOk(await SdCannedResponseRepository.list(workspace.id)),
    ).toHaveLength(2)
    expect(
      expectOk(
        await SdCannedResponseRepository.list(workspace.id, {
          departmentId: 'outro',
        }),
      ).map((r) => r.id),
    ).toEqual([general.id])
    expect(
      expectOk(
        await SdCannedResponseRepository.list(workspace.id, {
          departmentId: dept.id,
          q: 'ROTEADOR',
        }),
      ).map((r) => r.id),
    ).toEqual([n1.id])
    expect(expectOk(await SdCannedResponseRepository.list(other.id))).toEqual(
      [],
    )

    expectErr(
      await SdCannedResponseRepository.findById(n1.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdCannedResponseRepository.update(n1.id, workspace.id, {
          shortcut: 'roteador',
        }),
      ).shortcut,
    ).toBe('roteador')
    expectOk(await SdCannedResponseRepository.delete(n1.id, workspace.id))
    expectErr(
      await SdCannedResponseRepository.delete(n1.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdPartRepository', () => {
  it('CRUD with decimal cost and search', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const mouse = expectOk(
      await SdPartRepository.create(workspace.id, {
        name: 'Mouse USB',
        sku: 'MS-01',
        unitCost: '49.90',
        stock: 10,
      }),
    )
    const old = expectOk(
      await SdPartRepository.create(workspace.id, {
        name: 'Teclado PS/2',
        active: false,
      }),
    )
    expect(mouse.unitCost.toFixed(2)).toBe('49.90')
    expect(old.unitCost.toFixed(2)).toBe('0.00')

    expect(
      expectOk(await SdPartRepository.list(workspace.id)).map((p) => p.id),
    ).toEqual([mouse.id])
    expect(
      expectOk(
        await SdPartRepository.list(workspace.id, {
          q: 'ms-',
          includeInactive: true,
        }),
      ).map((p) => p.id),
    ).toEqual([mouse.id])
    expect(
      expectOk(
        await SdPartRepository.list(workspace.id, { includeInactive: true }),
      ),
    ).toHaveLength(2)
    expect(expectOk(await SdPartRepository.list(other.id))).toEqual([])

    expectErr(
      await SdPartRepository.findById(mouse.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdPartRepository.update(mouse.id, workspace.id, {
          unitCost: '59.00',
          stock: null,
        }),
      ).stock,
    ).toBeNull()
    expectOk(await SdPartRepository.delete(mouse.id, workspace.id))
    expectErr(
      await SdPartRepository.delete(mouse.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
