import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { SdAutomationRuleRepository } from '../sd-automation-rule.repository'
import { SdEscalationRuleRepository } from '../sd-escalation-rule.repository'

describe('SdEscalationRuleRepository', () => {
  it('CRUD + reorder scoped to the workspace', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const a = expectOk(
      await SdEscalationRuleRepository.create(workspace.id, {
        name: 'Risco',
        trigger: 'RESOLUTION_AT_RISK',
        actions: { kind: 'HIERARCHICAL' },
      }),
    )
    const b = expectOk(
      await SdEscalationRuleRepository.create(workspace.id, {
        name: 'Parado',
        trigger: 'NO_UPDATE',
        thresholdMinutes: 120,
        actions: {},
        conditions: [{ field: 'type', operator: 'equals', value: 'INCIDENT' }],
      }),
    )
    expect([a.position, b.position]).toEqual([0, 1])
    expect(
      expectOk(await SdEscalationRuleRepository.list(workspace.id)).map(
        (r) => r.id,
      ),
    ).toEqual([a.id, b.id])
    expect(expectOk(await SdEscalationRuleRepository.list(other.id))).toEqual(
      [],
    )
    expectErr(
      await SdEscalationRuleRepository.findById(a.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdEscalationRuleRepository.update(a.id, workspace.id, {
          active: false,
        }),
      ).active,
    ).toBe(false)
    expectOk(
      await SdEscalationRuleRepository.reorder(workspace.id, [b.id, a.id]),
    )
    expect(
      expectOk(await SdEscalationRuleRepository.findById(b.id, workspace.id))
        .position,
    ).toBe(0)
    expectOk(await SdEscalationRuleRepository.delete(a.id, workspace.id))
    expectErr(
      await SdEscalationRuleRepository.delete(a.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})

describe('SdAutomationRuleRepository', () => {
  it('CRUD + event filter + reorder scoped to the workspace', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const created = expectOk(
      await SdAutomationRuleRepository.create(workspace.id, {
        name: 'Na abertura',
        event: 'TICKET_CREATED',
        actions: [{ type: 'add_tag', params: { tag: 'novo' } }],
      }),
    )
    const phase = expectOk(
      await SdAutomationRuleRepository.create(workspace.id, {
        name: 'Na fase',
        event: 'PHASE_CHANGED',
        actions: [],
        stopProcessing: true,
      }),
    )
    expect(phase.position).toBe(1)
    expect(
      expectOk(
        await SdAutomationRuleRepository.list(workspace.id, {
          event: 'PHASE_CHANGED',
        }),
      ).map((r) => r.id),
    ).toEqual([phase.id])
    expect(
      expectOk(await SdAutomationRuleRepository.list(workspace.id)),
    ).toHaveLength(2)
    expect(expectOk(await SdAutomationRuleRepository.list(other.id))).toEqual(
      [],
    )
    expectErr(
      await SdAutomationRuleRepository.findById(created.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expect(
      expectOk(
        await SdAutomationRuleRepository.update(created.id, workspace.id, {
          description: 'Marca como novo',
        }),
      ).description,
    ).toBe('Marca como novo')
    expectOk(
      await SdAutomationRuleRepository.reorder(workspace.id, [
        phase.id,
        created.id,
      ]),
    )
    expectOk(await SdAutomationRuleRepository.delete(created.id, workspace.id))
    expectErr(
      await SdAutomationRuleRepository.findById(created.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })
})
