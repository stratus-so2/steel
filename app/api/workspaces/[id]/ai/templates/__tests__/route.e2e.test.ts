import { describe, expect, it } from 'vitest'
import {
  addMember,
  authenticatedOwner,
  getJson,
  postJson,
} from '@/src/__tests__/helpers/e2e'
import { prisma } from '@/src/lib/prisma'
import type { AiTemplatesDTO } from '@/types/ai-template'

const url = (workspaceId: string) =>
  `/api/workspaces/${workspaceId}/ai/templates`

// Test workspaces start with every module enabled.
async function disableServiceDesk(workspaceId: string) {
  await prisma.workspaceModuleAccess.updateMany({
    where: { workspaceId, module: 'SERVICE_DESK' },
    data: { enabled: false },
  })
}

describe('Steel AI templates route', () => {
  it('lists the gallery to the owner, with module availability', async () => {
    const { user, workspace } = await authenticatedOwner()
    await disableServiceDesk(workspace.id)

    const res = await getJson(url(workspace.id), user.cookie)
    expect(res.status).toBe(200)
    const data: AiTemplatesDTO = (await res.json()).data
    expect(data.canUse).toBe(true)
    expect(data.agents.length).toBeGreaterThanOrEqual(8)
    expect(data.skills.length).toBeGreaterThanOrEqual(6)

    const crm = data.agents.find((t) => t.id === 'crm-funil-parado')
    expect(crm?.available).toBe(true)
    const sd = data.agents.find((t) => t.id === 'sd-sla-em-risco')
    expect(sd).toMatchObject({
      available: false,
      unavailableReason: 'Requer o módulo ServiceDesk habilitado.',
    })
  })

  it('returns an empty gallery to a member and refuses a non-member', async () => {
    const { workspace } = await authenticatedOwner()
    const member = await addMember(workspace.id, 'MEMBER')
    const res = await getJson(url(workspace.id), member.cookie)
    expect(res.status).toBe(200)
    const data: AiTemplatesDTO = (await res.json()).data
    expect(data).toMatchObject({ canUse: false, agents: [], skills: [] })

    const { user: stranger } = await authenticatedOwner()
    const forbidden = await getJson(url(workspace.id), stranger.cookie)
    expect(forbidden.status).toBe(403)
  })

  it('creates an agent and a skill from templates through the normal endpoints', async () => {
    const { user, workspace } = await authenticatedOwner()
    await disableServiceDesk(workspace.id)
    const data: AiTemplatesDTO = (
      await (await getJson(url(workspace.id), user.cookie)).json()
    ).data

    const template = data.agents.find((t) => t.id === 'crm-funil-parado')
    if (!template) throw new Error('template missing')
    const created = await postJson(
      `/api/workspaces/${workspace.id}/agents`,
      {
        name: template.name,
        description: template.description,
        instructions: template.instructions,
        triggerType: template.triggerType,
        cron: template.cron,
        timezone: template.timezone,
        enabled: false,
        ownerId: user.id,
        maxToolRounds: template.maxToolRounds,
        tools: template.tools.map(({ toolName, mode }) => ({ toolName, mode })),
      },
      user.cookie,
    )
    expect(created.status).toBe(201)
    const agent = (await created.json()).data
    expect(agent).toMatchObject({ enabled: false, cron: template.cron })
    expect(agent.tools).toContainEqual({
      toolName: 'crm_create_task',
      mode: 'APPROVAL',
    })

    // A disabled module's template is still refused by the create endpoint.
    const sd = data.agents.find((t) => t.id === 'sd-sla-em-risco')
    if (!sd) throw new Error('template missing')
    const refused = await postJson(
      `/api/workspaces/${workspace.id}/agents`,
      {
        name: sd.name,
        instructions: sd.instructions,
        triggerType: sd.triggerType,
        cron: sd.cron,
        ownerId: user.id,
        tools: sd.tools.map(({ toolName, mode }) => ({ toolName, mode })),
      },
      user.cookie,
    )
    expect(refused.status).toBe(422)

    const skill = data.skills.find((t) => t.id === 'consumo-ia')
    if (!skill) throw new Error('template missing')
    const createdSkill = await postJson(
      `/api/workspaces/${workspace.id}/ai/skills`,
      {
        scope: 'WORKSPACE',
        slug: skill.slug,
        name: skill.name,
        description: skill.description,
        instructions: skill.instructions,
        mode: skill.mode,
        toolNames: skill.tools.map((t) => t.toolName),
      },
      user.cookie,
    )
    expect(createdSkill.status).toBe(201)
    expect((await createdSkill.json()).data).toMatchObject({
      kind: 'WORKSPACE',
      slug: 'consumo-ia',
      canEdit: true,
    })
  })
})
