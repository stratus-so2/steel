import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_CHILD_MODELS,
  workspaceScopedDelegates,
} from '@/src/lib/queue/workspace-snapshot'

interface ParsedField {
  type: string
  hasFk: boolean
}

/** Parser mínimo do schema: modelo → campos de relação com `fields: [...]`. */
function parseSchema(): Map<string, { fields: string[]; rels: ParsedField[] }> {
  const src = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8')
  const models = new Map<string, { fields: string[]; rels: ParsedField[] }>()
  for (const match of src.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    const fields: string[] = []
    const rels: ParsedField[] = []
    for (const line of match[2].split('\n')) {
      const [name, rawType] = line.trim().split(/\s+/)
      if (!name || name.startsWith('//') || name.startsWith('@@')) continue
      fields.push(name)
      if (/@relation\([^)]*fields:/.test(line)) {
        rels.push({ type: (rawType ?? '').replace(/[?[\]]/g, ''), hasFk: true })
      }
    }
    models.set(match[1], { fields, rels })
  }
  return models
}

const toDelegate = (model: string) =>
  model.charAt(0).toLowerCase() + model.slice(1)

describe('workspace snapshot coverage', () => {
  const models = parseSchema()
  const scoped = new Set(
    [...models]
      .filter(([, m]) => m.fields.includes('workspaceId'))
      .map(([name]) => name),
  )

  /** Modelos sem `workspaceId` que pendem (transitivamente) de um escopado. */
  function childModels(): Set<string> {
    const reach = new Set([...scoped, 'Workspace'])
    const children = new Set<string>()
    let grew = true
    while (grew) {
      grew = false
      for (const [name, model] of models) {
        if (reach.has(name)) continue
        if (model.rels.some((rel) => reach.has(rel.type))) {
          reach.add(name)
          children.add(name)
          grew = true
        }
      }
    }
    return children
  }

  it('lists every child model (no workspaceId) that cascades from a workspace', () => {
    const expected = [...childModels()].map(toDelegate).sort()
    expect(Object.keys(WORKSPACE_CHILD_MODELS).sort()).toEqual(expected)
  })

  it('includes every model with workspaceId except platform records', () => {
    const delegates = workspaceScopedDelegates()
    expect(delegates).toContain('membership')
    expect(delegates).toContain('crmOpportunity')
    expect(delegates).not.toContain('backup')
    expect(delegates).not.toContain('adminOperation')
    expect(delegates).toHaveLength(scoped.size - 2)
  })
})
