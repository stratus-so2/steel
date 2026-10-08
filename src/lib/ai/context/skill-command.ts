/**
 * Slash commands of Steel AI skills ("/my-work"). Pure helpers shared by the
 * schema, the chat runtime and the composer's picker.
 */

/** 1–40 chars: lowercase letters, digits and inner hyphens. */
export const AI_SKILL_SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/

export const AI_SKILL_SLUG_MAX = 40

/** Name of the platform tool that returns a skill's instructions. */
export const GET_SKILL_TOOL_NAME = 'steel_get_skill'

/** "/My-Work " → "my-work" (what the user typed into the command field). */
export function normalizeSkillSlug(value: string): string {
  return value.trim().replace(/^\/+/, '').toLowerCase()
}

export interface SkillCommand {
  slug: string
  /** Text after the command (trimmed); empty when only the command was sent. */
  rest: string
}

const COMMAND = /^\s*\/([a-z0-9][a-z0-9-]{0,39})(?=\s|$)([\s\S]*)$/i

/** Leading "/<slug>" of a message, or null when the message has none. */
export function parseSkillCommand(content: string): SkillCommand | null {
  const match = COMMAND.exec(content)
  if (!match) return null
  return { slug: match[1].toLowerCase(), rest: match[2].trim() }
}
