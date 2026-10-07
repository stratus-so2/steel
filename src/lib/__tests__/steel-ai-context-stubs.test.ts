import { describe, expect, it } from 'vitest'
import { memoryForPrompt } from '@/src/lib/ai/context/memory'
import {
  resolveSkillInvocation,
  skillsCatalogForPrompt,
} from '@/src/lib/ai/context/skills'

const ctx = { workspaceId: 'w1', actorId: 'u1', source: 'assistant' as const }

describe('steel ai context extension points', () => {
  it('pass the message through when no skill is resolved', async () => {
    await expect(resolveSkillInvocation(ctx, '/my-work')).resolves.toEqual({
      skill: null,
      content: '/my-work',
    })
  })

  it('add nothing to the prompt by default', async () => {
    await expect(skillsCatalogForPrompt(ctx)).resolves.toBe('')
    await expect(memoryForPrompt(ctx)).resolves.toBe('')
  })
})
