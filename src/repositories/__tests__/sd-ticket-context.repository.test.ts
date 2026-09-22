import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedSdTicket } from '@/src/__tests__/factories/sd-ticket.factory'
import {
  seedSdCalendar,
  seedSdCategory,
  seedSdClassification,
  seedSdConfigItem,
  seedSdContact,
  seedSdCustomer,
  seedSdCustomField,
  seedSdDepartment,
  seedSdDepartmentMember,
  seedSdEscalationRule,
  seedSdImpact,
  seedSdMatrix,
  seedSdPhase,
  seedSdPhaseFlow,
  seedSdPriority,
  seedSdSeverity,
  seedSdSlaPolicy,
  seedSdTemplate,
  seedSdUrgency,
} from '@/src/__tests__/factories/sd-ticket-context.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { seedWorkspaceModuleAccess } from '@/src/__tests__/factories/workspace-module-access.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  SdTicketContextRepository as Repo,
  type SdTicketRefs,
} from '../sd-ticket-context.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, user }
}

describe('SdTicketContextRepository', () => {
  it('ensureSettings() creates the row with default prefixes once', async () => {
    const { workspace } = await setup()
    const first = expectOk(await Repo.ensureSettings(workspace.id))
    expect(first.ticketPrefixes).toEqual({
      INCIDENT: 'INC',
      SERVICE_REQUEST: 'REQ',
      CHANGE: 'CHG',
      PROBLEM: 'PRB',
    })
    await prisma.sdSettings.update({
      where: { id: first.id },
      data: { nextTicketNumber: 9 },
    })
    const second = expectOk(await Repo.ensureSettings(workspace.id))
    expect(second.id).toBe(first.id)
    expect(second.nextTicketNumber).toBe(9)
  })

  describe('phases', () => {
    it('lists active phases in order and finds by id/category/initial', async () => {
      const { workspace } = await setup()
      const other = await seedWorkspace()
      const flow = await seedSdPhaseFlow(workspace.id)
      await seedSdPhase(workspace.id, { name: 'Inativa', active: false })
      await seedSdPhaseFlow(workspace.id, 'CHANGE')

      const list = expectOk(await Repo.listPhases(workspace.id, 'INCIDENT'))
      expect(list.map((p) => p.id)).toEqual(flow.phases.map((p) => p.id))
      expect(
        expectOk(await Repo.findPhase(workspace.id, flow.resolved.id))?.id,
      ).toBe(flow.resolved.id)
      expect(
        expectOk(await Repo.findPhase(other.id, flow.resolved.id)),
      ).toBeNull()
      expect(
        expectOk(await Repo.findInitialPhase(workspace.id, 'INCIDENT'))?.id,
      ).toBe(flow.initial.id)
      expect(
        expectOk(
          await Repo.findFirstPhaseByCategory(
            workspace.id,
            'INCIDENT',
            'CLOSED',
          ),
        )?.id,
      ).toBe(flow.closed.id)
      expect(
        expectOk(
          await Repo.findFirstPhaseByCategory(workspace.id, 'PROBLEM', 'NEW'),
        ),
      ).toBeNull()
    })

    it('findInitialPhase() falls back to NEW, then to the first, then null', async () => {
      const { workspace } = await setup()
      expect(
        expectOk(await Repo.findInitialPhase(workspace.id, 'PROBLEM')),
      ).toBeNull()
      const first = await seedSdPhase(workspace.id, {
        ticketType: 'PROBLEM',
        category: 'IN_PROGRESS',
        position: 0,
      })
      expect(
        expectOk(await Repo.findInitialPhase(workspace.id, 'PROBLEM'))?.id,
      ).toBe(first.id)
      const fresh = await seedSdPhase(workspace.id, {
        ticketType: 'PROBLEM',
        category: 'NEW',
        position: 1,
      })
      expect(
        expectOk(await Repo.findInitialPhase(workspace.id, 'PROBLEM'))?.id,
      ).toBe(fresh.id)
    })

    it('lists transitions of the ticket type', async () => {
      const { workspace } = await setup()
      const flow = await seedSdPhaseFlow(workspace.id)
      const change = await seedSdPhaseFlow(workspace.id, 'CHANGE')
      const t = await prisma.sdPhaseTransition.create({
        data: {
          workspaceId: workspace.id,
          fromPhaseId: flow.initial.id,
          toPhaseId: flow.inProgress.id,
        },
      })
      await prisma.sdPhaseTransition.create({
        data: {
          workspaceId: workspace.id,
          fromPhaseId: change.initial.id,
          toPhaseId: change.inProgress.id,
        },
      })
      expect(
        expectOk(await Repo.listTransitions(workspace.id, 'INCIDENT')).map(
          (r) => r.id,
        ),
      ).toEqual([t.id])
    })
  })

  describe('priorities', () => {
    it('reads the matrix, levels, default and next priority', async () => {
      const { workspace } = await setup()
      const [impact, urgency] = await Promise.all([
        seedSdImpact(workspace.id, 3),
        seedSdUrgency(workspace.id, 3),
      ])
      expect(
        expectOk(await Repo.findDefaultPriorityId(workspace.id)),
      ).toBeNull()
      expect(
        expectOk(await Repo.findNextPriorityId(workspace.id, null)),
      ).toBeNull()
      const p1 = await seedSdPriority(workspace.id, {
        level: 1,
        isDefault: true,
      })
      const p2 = await seedSdPriority(workspace.id, { level: 2 })
      const p4 = await seedSdPriority(workspace.id, { level: 4 })
      await seedSdMatrix(workspace.id, impact.id, urgency.id, p4.id)

      expect(
        expectOk(
          await Repo.findMatrixPriorityId(workspace.id, impact.id, urgency.id),
        ),
      ).toBe(p4.id)
      expect(
        expectOk(await Repo.findMatrixPriorityId(workspace.id, impact.id, 'x')),
      ).toBeNull()
      expect(expectOk(await Repo.findPriorityLevel(workspace.id, p2.id))).toBe(
        2,
      )
      expect(
        expectOk(await Repo.findPriorityLevel(workspace.id, 'x')),
      ).toBeNull()
      expect(expectOk(await Repo.findDefaultPriorityId(workspace.id))).toBe(
        p1.id,
      )
      expect(expectOk(await Repo.findNextPriorityId(workspace.id, 1))).toBe(
        p2.id,
      )
      expect(
        expectOk(await Repo.findNextPriorityId(workspace.id, 4)),
      ).toBeNull()
      expect(expectOk(await Repo.findNextPriorityId(workspace.id, null))).toBe(
        p4.id,
      )
    })
  })

  describe('catalog, SLA, calendars, templates, custom fields', () => {
    it('reads each configuration table scoped by workspace', async () => {
      const { workspace } = await setup()
      const other = await seedWorkspace()
      const cat = await seedSdCategory(workspace.id)
      expect(
        expectOk(await Repo.findCategory(workspace.id, cat.id)),
      ).toMatchObject({
        id: cat.id,
        level: 'CATEGORY',
      })
      expect(expectOk(await Repo.findCategory(other.id, cat.id))).toBeNull()

      const calendar = await seedSdCalendar(workspace.id, { isDefault: true })
      await seedSdCalendar(workspace.id, { name: 'Outro' })
      expect(expectOk(await Repo.findDefaultCalendar(workspace.id))?.id).toBe(
        calendar.id,
      )
      expect(expectOk(await Repo.findDefaultCalendar(other.id))).toBeNull()

      const priority = await seedSdPriority(workspace.id)
      const second = await seedSdSlaPolicy(
        workspace.id,
        { position: 1, calendarId: calendar.id },
        [
          {
            priorityId: priority.id,
            firstResponseMinutes: 30,
            resolutionMinutes: 240,
          },
        ],
      )
      const first = await seedSdSlaPolicy(workspace.id, { position: 0 })
      await seedSdSlaPolicy(workspace.id, { active: false })
      const policies = expectOk(await Repo.listActiveSlaPolicies(workspace.id))
      expect(policies.map((p) => p.id)).toEqual([first.id, second.id])
      expect(policies[1].targets).toHaveLength(1)
      expect(policies[1].calendar?.id).toBe(calendar.id)
      expect(
        expectOk(await Repo.findSlaPolicy(workspace.id, second.id))?.id,
      ).toBe(second.id)
      expect(expectOk(await Repo.findSlaPolicy(other.id, second.id))).toBeNull()

      const tpl = await seedSdTemplate(workspace.id)
      expect(expectOk(await Repo.findTemplate(workspace.id, tpl.id))?.id).toBe(
        tpl.id,
      )
      expect(expectOk(await Repo.findTemplate(other.id, tpl.id))).toBeNull()

      const field = await seedSdCustomField(workspace.id)
      await seedSdCustomField(workspace.id, { key: 'off', active: false })
      await seedSdCustomField(workspace.id, { key: 'cli', entity: 'CUSTOMER' })
      expect(
        expectOk(await Repo.listTicketCustomFields(workspace.id)).map(
          (f) => f.id,
        ),
      ).toEqual([field.id])
    })

    it('counts solution classifications applicable to the type', async () => {
      const { workspace } = await setup()
      expect(
        expectOk(
          await Repo.countSolutionClassifications(workspace.id, 'INCIDENT'),
        ),
      ).toBe(0)
      await seedSdClassification(workspace.id, { kind: 'SOLUTION' })
      await seedSdClassification(workspace.id, {
        kind: 'SOLUTION',
        ticketTypes: ['INCIDENT'],
      })
      await seedSdClassification(workspace.id, {
        kind: 'SOLUTION',
        ticketTypes: ['CHANGE'],
      })
      await seedSdClassification(workspace.id, {
        kind: 'SOLUTION',
        active: false,
      })
      await seedSdClassification(workspace.id, { kind: 'TICKET' })
      expect(
        expectOk(
          await Repo.countSolutionClassifications(workspace.id, 'INCIDENT'),
        ),
      ).toBe(2)
    })
  })

  describe('departments', () => {
    it('finds active departments, leads, members and round-robins', async () => {
      const { workspace, user } = await setup()
      const [u2, u3] = await Promise.all([seedUser(), seedUser()])
      const parent = await seedSdDepartment(workspace.id, { name: 'TI' })
      const dept = await seedSdDepartment(workspace.id, { parentId: parent.id })
      const inactive = await seedSdDepartment(workspace.id, { active: false })
      expect(
        expectOk(await Repo.findDepartment(workspace.id, dept.id)),
      ).toEqual({
        id: dept.id,
        name: 'Suporte N1',
        parentId: parent.id,
      })
      expect(
        expectOk(await Repo.findDepartment(workspace.id, inactive.id)),
      ).toBeNull()

      expect(
        expectOk(await Repo.pickRoundRobinAssignee(dept.id, new Date())),
      ).toBeNull()
      await seedSdDepartmentMember(dept.id, user.id, {
        isLead: true,
        lastAssignedAt: new Date('2026-09-20T00:00:00Z'),
      })
      await seedSdDepartmentMember(dept.id, u2.id, {
        lastAssignedAt: new Date('2026-09-19T00:00:00Z'),
      })
      await seedSdDepartmentMember(dept.id, u3.id)

      expect(expectOk(await Repo.listDepartmentLeadIds(dept.id))).toEqual([
        user.id,
      ])
      expect(expectOk(await Repo.isDepartmentMember(dept.id, u2.id))).toBe(true)
      expect(expectOk(await Repo.isDepartmentMember(parent.id, u2.id))).toBe(
        false,
      )

      const t1 = new Date('2026-09-21T10:00:00Z')
      expect(expectOk(await Repo.pickRoundRobinAssignee(dept.id, t1))).toBe(
        u3.id,
      )
      expect(expectOk(await Repo.pickRoundRobinAssignee(dept.id, t1))).toBe(
        u2.id,
      )
      expect(expectOk(await Repo.pickRoundRobinAssignee(dept.id, t1))).toBe(
        user.id,
      )
      const stamped = await prisma.sdDepartmentMember.findFirstOrThrow({
        where: { departmentId: dept.id, userId: u3.id },
      })
      expect(stamped.lastAssignedAt).toEqual(t1)
    })
  })

  describe('approvals and signatures', () => {
    it('reads the latest non-canceled approval and counts signatures', async () => {
      const { workspace, user } = await setup()
      const phase = await seedSdPhase(workspace.id)
      const ticket = await seedSdTicket(workspace.id, phase.id)
      expect(
        expectOk(await Repo.findLatestApprovalStatus(ticket.id)),
      ).toBeNull()
      expect(expectOk(await Repo.countSignatures(ticket.id))).toBe(0)
      const base = {
        workspaceId: workspace.id,
        ticketId: ticket.id,
        approverEmail: 'a@example.com',
        requestedById: user.id,
        expiresAt: new Date('2026-12-01'),
      }
      await prisma.sdTicketApproval.create({
        data: {
          ...base,
          tokenHash: 'h1',
          status: 'APPROVED',
          createdAt: new Date('2026-09-01'),
        },
      })
      await prisma.sdTicketApproval.create({
        data: {
          ...base,
          tokenHash: 'h2',
          status: 'CANCELED',
          createdAt: new Date('2026-09-02'),
        },
      })
      expect(expectOk(await Repo.findLatestApprovalStatus(ticket.id))).toBe(
        'APPROVED',
      )
      await prisma.sdTicketSignature.create({
        data: {
          workspaceId: workspace.id,
          ticketId: ticket.id,
          signerName: 'X',
          storageKey: 'k',
          imageSha256: 'a',
          ticketSha256: 'b',
        },
      })
      expect(expectOk(await Repo.countSignatures(ticket.id))).toBe(1)
    })
  })

  describe('findMissingRefs()', () => {
    it('reports ids that do not belong to the workspace', async () => {
      const { workspace, user } = await setup()
      const other = await seedWorkspace()
      const phase = await seedSdPhase(workspace.id)
      const [impact, urgency, priority, severity] = await Promise.all([
        seedSdImpact(workspace.id),
        seedSdUrgency(workspace.id),
        seedSdPriority(workspace.id),
        seedSdSeverity(workspace.id),
      ])
      const classification = await seedSdClassification(workspace.id)
      const solution = await seedSdClassification(workspace.id, {
        kind: 'SOLUTION',
      })
      const customer = await seedSdCustomer(workspace.id, user.id)
      const company = await seedSdCustomer(workspace.id, user.id, {
        kind: 'COMPANY',
      })
      const contact = await seedSdContact(workspace.id, user.id)
      const ci = await seedSdConfigItem(workspace.id, user.id)
      const department = await seedSdDepartment(workspace.id)
      const parent = await seedSdTicket(workspace.id, phase.id)

      const valid: SdTicketRefs = {
        impactId: impact.id,
        urgencyId: urgency.id,
        priorityId: priority.id,
        severityId: severity.id,
        classificationId: classification.id,
        solutionClassificationId: solution.id,
        customerId: customer.id,
        companyId: company.id,
        contactId: contact.id,
        configItemId: ci.id,
        departmentId: department.id,
        parentId: parent.id,
      }
      expect(expectOk(await Repo.findMissingRefs(workspace.id, valid))).toEqual(
        [],
      )
      expect(
        expectOk(
          await Repo.findMissingRefs(workspace.id, {
            ...valid,
            // classificação de solução usada como classificação do chamado
            classificationId: solution.id,
            customerId: null,
            contactId: '',
          }),
        ),
      ).toEqual(['classificationId'])
      expect(
        expectOk(await Repo.findMissingRefs(other.id, valid)),
      ).toHaveLength(12)
      expect(
        expectOk(
          await Repo.findMissingRefs(workspace.id, {
            unknownId: 'x',
          } as unknown as SdTicketRefs),
        ),
      ).toEqual(['unknownId'])
    })
  })

  describe('users and workspaces', () => {
    it('finds non-members, user names, workspace and owner', async () => {
      const { workspace, user } = await setup()
      const [owner, outsider] = await Promise.all([seedUser(), seedUser()])
      await seedMembership({ userId: user.id, workspaceId: workspace.id })
      expect(expectOk(await Repo.findNonMembers(workspace.id, []))).toEqual([])
      expect(expectOk(await Repo.findWorkspaceOwnerId(workspace.id))).toBeNull()
      await seedMembership({
        userId: owner.id,
        workspaceId: workspace.id,
        role: 'OWNER',
      })
      expect(
        expectOk(
          await Repo.findNonMembers(workspace.id, [
            user.id,
            outsider.id,
            outsider.id,
          ]),
        ),
      ).toEqual([outsider.id])
      expect(expectOk(await Repo.findUserNames([])).size).toBe(0)
      const names = expectOk(await Repo.findUserNames([user.id, owner.id]))
      expect(names.get(user.id)).toEqual({ name: user.name, email: user.email })
      expect(expectOk(await Repo.findWorkspace(workspace.id))).toEqual({
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      })
      expect(expectOk(await Repo.findWorkspace('missing'))).toBeNull()
      expect(expectOk(await Repo.findWorkspaceOwnerId(workspace.id))).toBe(
        owner.id,
      )
    })

    it('lists active workspaces with the module enabled', async () => {
      const { workspace, user } = await setup()
      const [disabled, crmOnly, suspended] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedWorkspace({ status: 'SUSPENDED' }),
      ])
      await seedWorkspaceModuleAccess(workspace.id, user.id, {
        module: 'SERVICE_DESK',
      })
      await seedWorkspaceModuleAccess(disabled.id, user.id, {
        module: 'SERVICE_DESK',
        enabled: false,
      })
      await seedWorkspaceModuleAccess(crmOnly.id, user.id, { module: 'CRM' })
      await seedWorkspaceModuleAccess(suspended.id, user.id, {
        module: 'SERVICE_DESK',
      })
      expect(expectOk(await Repo.listEnabledWorkspaceIds())).toEqual([
        workspace.id,
      ])
    })

    it('lists active escalation rules in order', async () => {
      const { workspace } = await setup()
      const b = await seedSdEscalationRule(workspace.id, { position: 2 })
      const a = await seedSdEscalationRule(workspace.id, { position: 1 })
      await seedSdEscalationRule(workspace.id, { active: false })
      expect(
        expectOk(await Repo.listActiveEscalationRules(workspace.id)).map(
          (r) => r.id,
        ),
      ).toEqual([a.id, b.id])
    })
  })

  it('maps database failures to DATABASE_ERROR', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    const models = [
      'sdSettings',
      'sdPhase',
      'sdPhaseTransition',
      'sdPriorityMatrix',
      'sdPriority',
      'sdCategory',
      'sdSlaPolicy',
      'sdBusinessCalendar',
      'sdTicketTemplate',
      'sdCustomFieldDefinition',
      'sdDepartment',
      'sdDepartmentMember',
      'sdClassification',
      'sdTicketApproval',
      'sdTicketSignature',
      'sdImpact',
      'membership',
      'user',
      'workspace',
      'workspaceModuleAccess',
      'sdEscalationRule',
    ] as const
    const spies = models.flatMap((model) =>
      (['findMany', 'findFirst', 'findUnique', 'count', 'upsert'] as const)
        .filter((m) => m in prisma[model])
        .map((m) =>
          vi
            .spyOn(prisma[model] as unknown as Record<string, () => unknown>, m)
            .mockImplementation(boom),
        ),
    )
    const tx = vi
      .spyOn(prisma, '$transaction')
      .mockImplementation(boom as never)
    const results = await Promise.all([
      Repo.ensureSettings('w'),
      Repo.listPhases('w', 'INCIDENT'),
      Repo.findPhase('w', 'p'),
      Repo.findInitialPhase('w', 'INCIDENT'),
      Repo.findFirstPhaseByCategory('w', 'INCIDENT', 'NEW'),
      Repo.listTransitions('w', 'INCIDENT'),
      Repo.findMatrixPriorityId('w', 'i', 'u'),
      Repo.findPriorityLevel('w', 'p'),
      Repo.findDefaultPriorityId('w'),
      Repo.findNextPriorityId('w', 1),
      Repo.findCategory('w', 'c'),
      Repo.listActiveSlaPolicies('w'),
      Repo.findSlaPolicy('w', 's'),
      Repo.findDefaultCalendar('w'),
      Repo.findTemplate('w', 't'),
      Repo.listTicketCustomFields('w'),
      Repo.findDepartment('w', 'd'),
      Repo.listDepartmentLeadIds('d'),
      Repo.isDepartmentMember('d', 'u'),
      Repo.pickRoundRobinAssignee('d', new Date()),
      Repo.countSolutionClassifications('w', 'INCIDENT'),
      Repo.findLatestApprovalStatus('t'),
      Repo.countSignatures('t'),
      Repo.findMissingRefs('w', { impactId: 'i' }),
      Repo.findNonMembers('w', ['u']),
      Repo.findUserNames(['u']),
      Repo.findWorkspace('w'),
      Repo.findWorkspaceOwnerId('w'),
      Repo.listEnabledWorkspaceIds(),
      Repo.listActiveEscalationRules('w'),
    ])
    for (const result of results) expectErr(result, 'DATABASE_ERROR')
    for (const spy of spies) spy.mockRestore()
    tx.mockRestore()
  })
})
