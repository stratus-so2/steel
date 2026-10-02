import { describe, expect, it } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SD_SEED_PLAN, type SdSeedPlan } from '@/src/services/sd-seed-data'
import { SdSeedRepository } from '../sd-seed.repository'

const EMPTY_PLAN: SdSeedPlan = {
  phases: { INCIDENT: [], SERVICE_REQUEST: [], CHANGE: [], PROBLEM: [] },
  impacts: [],
  urgencies: [],
  priorities: [],
  matrix: [],
  severities: [],
  classifications: [],
  calendars: [],
  slaPolicies: [],
  configItemTypes: [],
  departments: [],
  catalog: [],
  templates: [],
  escalationRules: [],
  automationRules: [],
}

describe('SdSeedRepository.apply', () => {
  it('seeds the ITIL defaults and is idempotent', async () => {
    const [workspace, actor] = await Promise.all([seedWorkspace(), seedUser()])
    await seedMembership({
      userId: actor.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    })
    const ws = workspace.id

    const first = expectOk(
      await SdSeedRepository.apply(ws, actor.id, SD_SEED_PLAN),
    )
    expect(first).toEqual({
      calendars: 2,
      impacts: 3,
      urgencies: 3,
      priorities: 4,
      severities: 4,
      matrixCells: 9,
      classifications: 14,
      phases: 30,
      slaPolicies: 2,
      configItemTypes: 13,
      departments: 5,
      categories: 18,
      templates: 4,
      escalationRules: 1,
      automationRules: 1,
    })

    // Uma fase inicial por tipo.
    const initials = await prisma.sdPhase.groupBy({
      by: ['ticketType'],
      where: { workspaceId: ws, isInitial: true },
      _count: true,
    })
    expect(initials).toHaveLength(4)
    expect(initials.every((g) => g._count === 1)).toBe(true)

    // Matriz: impacto alto × urgência alta → P1.
    const p1 = await prisma.sdPriority.findFirstOrThrow({
      where: { workspaceId: ws, level: 4 },
    })
    const cell = await prisma.sdPriorityMatrix.findFirstOrThrow({
      where: {
        workspaceId: ws,
        impact: { level: 3 },
        urgency: { level: 3 },
      },
    })
    expect(cell.priorityId).toBe(p1.id)
    expect(
      (
        await prisma.sdPriority.findFirstOrThrow({
          where: { workspaceId: ws, isDefault: true },
        })
      ).level,
    ).toBe(2)

    // SLA padrão (8×5) com 4 metas; crítico 24×7 antes na ordem.
    const policies = await prisma.sdSlaPolicy.findMany({
      where: { workspaceId: ws },
      include: { targets: true, calendar: true },
      orderBy: { position: 'asc' },
    })
    expect(
      policies.map((p) => [p.name, p.isDefault, p.targets.length]),
    ).toEqual([
      ['Crítico 24×7', false, 1],
      ['Padrão', true, 4],
    ])
    expect(policies[1].calendar?.name).toBe('Comercial (8×5)')

    // Ator vira líder do Service Desk; configuração aponta para os padrões.
    const serviceDesk = await prisma.sdDepartment.findFirstOrThrow({
      where: { workspaceId: ws, name: 'Service Desk' },
      include: { members: true, children: true },
    })
    expect(serviceDesk.members).toMatchObject([
      { userId: actor.id, isLead: true },
    ])
    expect(serviceDesk.children).toHaveLength(2)
    const settings = await prisma.sdSettings.findUniqueOrThrow({
      where: { workspaceId: ws },
    })
    expect(settings.defaultDepartmentId).toBe(serviceDesk.id)
    expect(settings.defaultSlaPolicyId).toBe(policies[1].id)

    const calendar = await prisma.sdBusinessCalendar.findFirstOrThrow({
      where: { workspaceId: ws, isDefault: true },
    })
    expect(calendar.name).toBe('Comercial (8×5)')
    expect(calendar.holidays).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ date: '2026-02-16', name: 'Carnaval' }),
        expect.objectContaining({ date: '2027-05-27', name: 'Corpus Christi' }),
      ]),
    )

    // Segunda execução: nada novo.
    const second = expectOk(
      await SdSeedRepository.apply(ws, actor.id, SD_SEED_PLAN),
    )
    expect(Object.values(second).every((n) => n === 0)).toBe(true)
    expect(await prisma.sdDepartmentMember.count()).toBe(1)
  })

  it('respects existing customization and defaults', async () => {
    const [workspace, outsider] = await Promise.all([
      seedWorkspace(),
      seedUser(),
    ])
    const ws = workspace.id
    // Workspace já configurada em parte.
    const myCalendar = await prisma.sdBusinessCalendar.create({
      data: { workspaceId: ws, name: 'Meu', schedule: {}, isDefault: true },
    })
    await prisma.sdPriority.create({
      data: { workspaceId: ws, name: 'Urgente', level: 9, isDefault: true },
    })
    const myPolicy = await prisma.sdSlaPolicy.create({
      data: { workspaceId: ws, name: 'Meu SLA', isDefault: true },
    })
    await prisma.sdPhase.create({
      data: {
        workspaceId: ws,
        ticketType: 'INCIDENT',
        name: 'Aberto',
        category: 'NEW',
        isInitial: true,
      },
    })
    await prisma.sdCategory.create({
      data: { workspaceId: ws, name: 'Minha categoria', level: 'CATEGORY' },
    })
    const myDept = await prisma.sdDepartment.create({
      data: { workspaceId: ws, name: 'Suporte' },
    })
    await prisma.sdSettings.create({
      data: {
        workspaceId: ws,
        ticketPrefixes: {},
        defaultDepartmentId: myDept.id,
        defaultSlaPolicyId: myPolicy.id,
      },
    })

    const summary = expectOk(
      await SdSeedRepository.apply(ws, outsider.id, SD_SEED_PLAN),
    )
    expect(summary.phases).toBe(22) // INCIDENT já tinha fases
    expect(summary.categories).toBe(0)

    expect(
      await prisma.sdBusinessCalendar.count({
        where: { workspaceId: ws, isDefault: true },
      }),
    ).toBe(1)
    expect(
      (
        await prisma.sdBusinessCalendar.findUniqueOrThrow({
          where: { id: myCalendar.id },
        })
      ).isDefault,
    ).toBe(true)
    expect(
      await prisma.sdPriority.count({
        where: { workspaceId: ws, isDefault: true },
      }),
    ).toBe(1)
    expect(
      await prisma.sdSlaPolicy.count({
        where: { workspaceId: ws, isDefault: true },
      }),
    ).toBe(1)
    // Quem liberou não é membro: não vira líder.
    expect(await prisma.sdDepartmentMember.count()).toBe(0)

    const settings = await prisma.sdSettings.findUniqueOrThrow({
      where: { workspaceId: ws },
    })
    expect(settings.defaultDepartmentId).toBe(myDept.id)
    expect(settings.defaultSlaPolicyId).toBe(myPolicy.id)
  })

  it('skips matrix cells and SLA targets whose levels do not resolve', async () => {
    const workspace = await seedWorkspace()
    const summary = expectOk(
      await SdSeedRepository.apply(workspace.id, 'nobody', {
        ...EMPTY_PLAN,
        urgencies: [{ name: 'Alta', level: 3 }],
        severities: [{ name: 'Crítica', level: 4 }],
        priorities: [{ name: 'P1', level: 4, isDefault: true }],
        matrix: [{ impactLevel: 1, urgencyLevel: 1, priorityLevel: 4 }],
        slaPolicies: [
          {
            name: 'Sem calendário',
            description: 'x',
            calendarName: 'inexistente',
            isDefault: false,
            conditions: [],
            targets: [
              {
                priorityLevel: 7,
                firstResponseMinutes: 1,
                resolutionMinutes: 2,
              },
            ],
          },
        ],
        departments: [
          {
            name: 'Sem filhos',
            description: 'd',
            color: '#000000',
            children: [],
          },
        ],
        catalog: [
          {
            name: 'A',
            children: [
              {
                name: 'B',
                children: [{ name: 'C', children: [{ name: 'D' }] }],
              },
            ],
          },
        ],
      }),
    )
    expect(summary.matrixCells).toBe(0)
    expect(summary.slaPolicies).toBe(1)
    // D (4º nível) é ignorado.
    expect(summary.categories).toBe(3)
    const policy = await prisma.sdSlaPolicy.findFirstOrThrow({
      where: { workspaceId: workspace.id },
      include: { targets: true },
    })
    expect(policy.calendarId).toBeNull()
    expect(policy.targets).toEqual([])
    const settings = await prisma.sdSettings.findUniqueOrThrow({
      where: { workspaceId: workspace.id },
    })
    expect(settings.defaultDepartmentId).toBeNull()
    expect(settings.defaultSlaPolicyId).toBeNull()
  })

  it('returns DATABASE_ERROR when the workspace does not exist', async () => {
    const result = await SdSeedRepository.apply('missing', 'nobody', {
      ...EMPTY_PLAN,
      impacts: [{ name: 'Baixo', level: 1 }],
    })
    expect(result.ok).toBe(false)
  })
})

describe('SdSeedRepository.applyPhases', () => {
  const INCIDENT = SD_SEED_PLAN.phases.INCIDENT

  it('seeds every default phase of an empty type, one initial, in order', async () => {
    const workspace = await seedWorkspace()

    const summary = expectOk(
      await SdSeedRepository.applyPhases(workspace.id, 'INCIDENT', INCIDENT),
    )
    expect(summary).toEqual({ created: INCIDENT.length, kept: 0 })

    const phases = await prisma.sdPhase.findMany({
      where: { workspaceId: workspace.id, ticketType: 'INCIDENT' },
      orderBy: { position: 'asc' },
    })
    expect(phases.map((p) => p.name)).toEqual(INCIDENT.map((p) => p.name))
    expect(phases.map((p) => p.position)).toEqual(
      INCIDENT.map((_, index) => index),
    )
    expect(phases.filter((p) => p.isInitial)).toHaveLength(1)
    // The other types are left alone.
    expect(
      await prisma.sdPhase.count({
        where: { workspaceId: workspace.id, ticketType: 'CHANGE' },
      }),
    ).toBe(0)
  })

  it('creates only what is missing, keeps the admin phases and their initial', async () => {
    const workspace = await seedWorkspace()
    await prisma.sdPhase.create({
      data: {
        workspaceId: workspace.id,
        ticketType: 'INCIDENT',
        name: 'Aberto',
        category: 'NEW',
        position: 5,
        isInitial: true,
      },
    })
    // A phase sharing a default's name: it must not be duplicated.
    await prisma.sdPhase.create({
      data: {
        workspaceId: workspace.id,
        ticketType: 'INCIDENT',
        name: INCIDENT[0].name,
        category: 'NEW',
        position: 6,
      },
    })

    const summary = expectOk(
      await SdSeedRepository.applyPhases(workspace.id, 'INCIDENT', INCIDENT),
    )
    expect(summary).toEqual({ created: INCIDENT.length - 1, kept: 2 })

    const phases = await prisma.sdPhase.findMany({
      where: { workspaceId: workspace.id, ticketType: 'INCIDENT' },
      orderBy: { position: 'asc' },
    })
    expect(phases).toHaveLength(INCIDENT.length + 1)
    expect(phases.filter((p) => p.name === INCIDENT[0].name)).toHaveLength(1)
    // The initial phase stays the admin's, and positions follow after it.
    expect(phases.filter((p) => p.isInitial).map((p) => p.name)).toEqual([
      'Aberto',
    ])
    expect(phases.slice(0, 2).map((p) => p.name)).toEqual([
      'Aberto',
      INCIDENT[0].name,
    ])
    expect(phases[2].position).toBe(7)
  })

  it('is idempotent: a second run creates nothing', async () => {
    const workspace = await seedWorkspace()
    const PROBLEM = SD_SEED_PLAN.phases.PROBLEM
    expectOk(
      await SdSeedRepository.applyPhases(workspace.id, 'PROBLEM', PROBLEM),
    )

    const second = expectOk(
      await SdSeedRepository.applyPhases(workspace.id, 'PROBLEM', PROBLEM),
    )
    expect(second).toEqual({ created: 0, kept: PROBLEM.length })
    expect(
      await prisma.sdPhase.count({
        where: { workspaceId: workspace.id, ticketType: 'PROBLEM' },
      }),
    ).toBe(PROBLEM.length)
  })

  it('returns DATABASE_ERROR when the workspace does not exist', async () => {
    const result = await SdSeedRepository.applyPhases(
      'missing',
      'INCIDENT',
      INCIDENT,
    )
    expect(result.ok).toBe(false)
  })
})
