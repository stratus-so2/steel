import { describe, expect, it } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { SdConfigRepository } from '../sd-config.repository'

describe('SdConfigRepository.findExistingRefs', () => {
  it('returns only the ids that belong to the workspace, per kind', async () => {
    const [workspace, other, member, outsider] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    await seedMembership({ userId: member.id, workspaceId: workspace.id })
    await seedMembership({ userId: outsider.id, workspaceId: other.id })
    const ws = workspace.id

    const [dept, deletedDept, foreignDept] = await Promise.all([
      prisma.sdDepartment.create({ data: { workspaceId: ws, name: 'N1' } }),
      prisma.sdDepartment.create({
        data: { workspaceId: ws, name: 'Old', deletedAt: new Date() },
      }),
      prisma.sdDepartment.create({
        data: { workspaceId: other.id, name: 'X' },
      }),
    ])
    const template = await prisma.sdTicketTemplate.create({
      data: { workspaceId: ws, ticketType: 'INCIDENT', name: 'T' },
    })
    const category = await prisma.sdCategory.create({
      data: { workspaceId: ws, name: 'C', level: 'CATEGORY' },
    })
    const priority = await prisma.sdPriority.create({
      data: { workspaceId: ws, name: 'P1', level: 4 },
    })
    const calendar = await prisma.sdBusinessCalendar.create({
      data: { workspaceId: ws, name: '8x5', schedule: {} },
    })
    const policy = await prisma.sdSlaPolicy.create({
      data: { workspaceId: ws, name: 'Padrão' },
    })
    const classification = await prisma.sdClassification.create({
      data: { workspaceId: ws, kind: 'TICKET', name: 'Falha' },
    })
    const impact = await prisma.sdImpact.create({
      data: { workspaceId: ws, name: 'Alto', level: 3 },
    })
    const urgency = await prisma.sdUrgency.create({
      data: { workspaceId: ws, name: 'Alta', level: 3 },
    })
    const severity = await prisma.sdSeverity.create({
      data: { workspaceId: ws, name: 'Crítica', level: 4 },
    })
    const phase = await prisma.sdPhase.create({
      data: {
        workspaceId: ws,
        ticketType: 'INCIDENT',
        name: 'Novo',
        category: 'NEW',
      },
    })

    const found = expectOk(
      await SdConfigRepository.findExistingRefs(ws, {
        departmentIds: [dept.id, deletedDept.id, foreignDept.id],
        userIds: [member.id, outsider.id],
        templateIds: [template.id, 'nope'],
        categoryIds: [category.id],
        priorityIds: [priority.id],
        calendarIds: [calendar.id],
        slaPolicyIds: [policy.id],
        classificationIds: [classification.id],
        impactIds: [impact.id],
        urgencyIds: [urgency.id],
        severityIds: [severity.id],
        phaseIds: [phase.id],
      }),
    )
    expect(found).toEqual({
      departmentIds: [dept.id],
      userIds: [member.id],
      templateIds: [template.id],
      categoryIds: [category.id],
      priorityIds: [priority.id],
      calendarIds: [calendar.id],
      slaPolicyIds: [policy.id],
      classificationIds: [classification.id],
      impactIds: [impact.id],
      urgencyIds: [urgency.id],
      severityIds: [severity.id],
      phaseIds: [phase.id],
    })

    // Listas vazias não consultam.
    expect(
      expectOk(
        await SdConfigRepository.findExistingRefs(ws, {
          departmentIds: [],
          templateIds: undefined,
          userIds: [member.id],
        }),
      ),
    ).toEqual({ userIds: [member.id] })
  })
})

describe('SdConfigRepository.listWorkspaceMembers', () => {
  it('lists members with role, profile and active department links', async () => {
    const [workspace, other, ana, bruno] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser({ name: 'Ana' }),
      seedUser({ name: 'Bruno' }),
    ])
    await seedMembership({
      userId: ana.id,
      workspaceId: workspace.id,
      role: 'ADMIN',
    })
    await seedMembership({ userId: bruno.id, workspaceId: workspace.id })
    const [active, inactive, foreign] = await Promise.all([
      prisma.sdDepartment.create({
        data: { workspaceId: workspace.id, name: 'N1' },
      }),
      prisma.sdDepartment.create({
        data: { workspaceId: workspace.id, name: 'Off', active: false },
      }),
      prisma.sdDepartment.create({
        data: { workspaceId: other.id, name: 'X' },
      }),
    ])
    await prisma.sdDepartmentMember.createMany({
      data: [
        { departmentId: active.id, userId: bruno.id, isLead: true },
        { departmentId: inactive.id, userId: bruno.id },
        { departmentId: foreign.id, userId: bruno.id },
      ],
    })

    const rows = expectOk(
      await SdConfigRepository.listWorkspaceMembers(workspace.id),
    )
    expect(rows.map((r) => [r.user.name, r.role, r.departments])).toEqual([
      ['Ana', 'ADMIN', []],
      ['Bruno', 'MEMBER', [{ departmentId: active.id, isLead: true }]],
    ])
    expect(rows[0].profile).toBeNull()
    expect(rows[0].user).not.toHaveProperty('sdDepartmentMemberships')
  })
})
