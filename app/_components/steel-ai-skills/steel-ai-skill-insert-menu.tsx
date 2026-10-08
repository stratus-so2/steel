'use client'

import { MagicWand01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useEnabledAiSkills } from '@/src/hooks/use-ai-skills'
import type { AiSkillDTO } from '@/types/ai-skill'

/** Appends a skill's instructions to an agent prompt (or another text). */
export function appendSkillInstructions(
  text: string,
  skill: Pick<AiSkillDTO, 'slug' | 'name' | 'instructions'>,
): string {
  const block = `## Skill /${skill.slug} — ${skill.name}\n${skill.instructions}`
  const base = text.trimEnd()
  return base ? `${base}\n\n${block}` : block
}

/**
 * "Inserir skill" for the Steel Agent editor: copies an enabled skill's
 * instructions into the agent's own (agents run alone, so the text is
 * inlined instead of depending on a "/" at run time).
 */
export function SteelAiSkillInsertMenu({
  workspaceId,
  disabled = false,
  onInsert,
}: {
  workspaceId: string
  disabled?: boolean
  onInsert: (skill: AiSkillDTO) => void
}) {
  const skills = useEnabledAiSkills(workspaceId)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            disabled={disabled || skills.length === 0}
          />
        }
      >
        <SteelIcon icon={MagicWand01Icon} strokeWidth={2} />
        Inserir skill
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end' className='max-h-72 w-72'>
        <DropdownMenuLabel>Copiar instruções de uma skill</DropdownMenuLabel>
        {skills.map((skill) => (
          <DropdownMenuItem key={skill.id} onClick={() => onInsert(skill)}>
            <span className='min-w-0'>
              <span className='block font-medium font-mono text-xs'>
                /{skill.slug}
              </span>
              <span className='block truncate text-muted-foreground text-xs'>
                {skill.name}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
