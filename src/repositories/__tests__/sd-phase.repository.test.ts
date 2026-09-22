import { describe, expect, it } from 'vitest'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdPhaseRepository } from '../sd-phase.repository'

describe('SdPhaseRepository', () => {
  it('creates phases per type keeping a single initial phase', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const novo = expectOk(
      await SdPhaseRepository.create(workspace.id, {
        ticketType: 'INCIDENT',
        name: 'Novo',
        category: 'NEW',
        isInitial: true,
      }),
    )
    const triagem = expectOk(
      await SdPhaseRepository.create(workspace.id, {
        ticketType: 'INCIDENT',
        name: 'Triagem',
        category: 'IN_PROGRESS',
        completionPercent: 10,
      }),
    )
    const nova = expectOk(
      await SdPhaseRepository.create(workspace.id, {
        ticketType: 'SERVICE_REQUEST',
        name: 'Nova',
        category: 'NEW',
        isInitial: true,
      }),
    )
    expect([novo.position, triagem.position, nova.position]).toEqual([0, 1, 0])
    expect(
      expectOk(await SdPhaseRepository.countInitial(workspace.id, 'INCIDENT')),
    ).toBe(1)

    // Nova inicial no INCIDENT desmarca a anterior (mas não a da requisição).
    const aberto = expectOk(
      await SdPhaseRepository.create(workspace.id, {
        ticketType: 'INCIDENT',
        name: 'Aberto',
        category: 'NEW',
        isInitial: true,
      }),
    )
    expect(
      expectOk(await SdPhaseRepository.findById(novo.id, workspace.id))
        .isInitial,
    ).toBe(false)
    expect(
      expectOk(await SdPhaseRepository.findById(nova.id, workspace.id))
        .isInitial,
    ).toBe(true)

    // Update isInitial desmarca de novo.
    expectOk(
      await SdPhaseRepository.update(novo.id, workspace.id, {
        isInitial: true,
      }),
    )
    expect(
      expectOk(await SdPhaseRepository.findById(aberto.id, workspace.id))
        .isInitial,
    ).toBe(false)
    expectOk(
      await SdPhaseRepository.update(triagem.id, workspace.id, {
        active: false,
        requiredFields: ['solution'],
      }),
    )

    expect(
      expectOk(
        await SdPhaseRepository.list(workspace.id, { ticketType: 'INCIDENT' }),
      ).map((p) => p.name),
    ).toEqual(['Novo', 'Aberto'])
    expect(
      expectOk(
        await SdPhaseRepository.list(workspace.id, { includeInactive: true }),
      ),
    ).toHaveLength(4)
    expect(expectOk(await SdPhaseRepository.list(other.id))).toEqual([])
    expectErr(
      await SdPhaseRepository.findById(novo.id, other.id),
      'SD_PHASE_NOT_FOUND',
    )

    expectOk(
      await SdPhaseRepository.reorder(workspace.id, 'INCIDENT', [
        aberto.id,
        triagem.id,
        novo.id,
      ]),
    )
    expect(
      expectOk(await SdPhaseRepository.findById(novo.id, workspace.id))
        .position,
    ).toBe(2)
    // Reordenar com fase de outro tipo falha.
    expectErr(
      await SdPhaseRepository.reorder(workspace.id, 'INCIDENT', [nova.id]),
      'SD_CONFIG_NOT_FOUND',
    )

    expectOk(await SdPhaseRepository.delete(triagem.id, workspace.id))
    expectErr(
      await SdPhaseRepository.delete(triagem.id, workspace.id),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('counts tickets (including soft-deleted) in a phase', async () => {
    const workspace = await seedWorkspace()
    const phase = expectOk(
      await SdPhaseRepository.create(workspace.id, {
        ticketType: 'INCIDENT',
        name: 'Novo',
        category: 'NEW',
      }),
    )
    expect(expectOk(await SdPhaseRepository.countTickets(phase.id))).toBe(0)
    await prisma.sdTicket.create({
      data: {
        workspaceId: workspace.id,
        number: 1,
        type: 'INCIDENT',
        title: 'Sem internet',
        phaseId: phase.id,
        deletedAt: new Date(),
      },
    })
    expect(expectOk(await SdPhaseRepository.countTickets(phase.id))).toBe(1)
  })

  it('replaces the transitions of one type only', async () => {
    const workspace = await seedWorkspace()
    const mk = async (ticketType: 'INCIDENT' | 'PROBLEM', name: string) =>
      expectOk(
        await SdPhaseRepository.create(workspace.id, {
          ticketType,
          name,
          category: 'NEW',
        }),
      )
    const [a, b, c] = [
      await mk('INCIDENT', 'A'),
      await mk('INCIDENT', 'B'),
      await mk('INCIDENT', 'C'),
    ]
    const [p1, p2] = [await mk('PROBLEM', 'P1'), await mk('PROBLEM', 'P2')]

    expectOk(
      await SdPhaseRepository.saveTransitions(workspace.id, 'PROBLEM', [
        { fromPhaseId: p1.id, toPhaseId: p2.id, allowedDepartmentIds: [] },
      ]),
    )
    const saved = expectOk(
      await SdPhaseRepository.saveTransitions(workspace.id, 'INCIDENT', [
        { fromPhaseId: a.id, toPhaseId: b.id, allowedDepartmentIds: ['d1'] },
        { fromPhaseId: b.id, toPhaseId: c.id, allowedDepartmentIds: [] },
      ]),
    )
    expect(saved).toHaveLength(2)

    const replaced = expectOk(
      await SdPhaseRepository.saveTransitions(workspace.id, 'INCIDENT', [
        { fromPhaseId: a.id, toPhaseId: c.id, allowedDepartmentIds: [] },
      ]),
    )
    expect(replaced.map((t) => t.toPhaseId)).toEqual([c.id])

    expect(
      expectOk(await SdPhaseRepository.listTransitions(workspace.id)),
    ).toHaveLength(2)
    expect(
      expectOk(
        await SdPhaseRepository.listTransitions(workspace.id, 'PROBLEM'),
      ).map((t) => t.fromPhaseId),
    ).toEqual([p1.id])
  })
})
