import { z } from 'zod'
import { dto } from '../common'

/** DTOs das skills e da memória do Steel AI (`types/ai-skill.d.ts`, `types/ai-memory.d.ts`). */

const dateTime = () => z.iso.datetime()
const Scope = z.enum(['WORKSPACE', 'PERSONAL'])

export const AiSkillDTO = dto(
  'AiSkill',
  z.object({
    id: z.string().meta({
      description: 'ID da skill, ou `builtin:<comando>` numa skill embutida.',
      example: 'builtin:my-work',
    }),
    kind: z.enum(['BUILT_IN', 'WORKSPACE', 'PERSONAL']),
    slug: z
      .string()
      .meta({ description: 'Comando sem a barra.', example: 'my-work' }),
    name: z.string().meta({ example: 'Meu trabalho' }),
    description: z.string(),
    instructions: z.string(),
    mode: z
      .enum(['EXPLORE', 'AGENT', 'AUTOPILOT'])
      .nullable()
      .meta({ description: 'Modo sugerido ao usar (null = o da conversa).' }),
    toolNames: z.array(z.string()).meta({
      description: 'Ferramentas sugeridas ao modelo (vazio = qualquer uma).',
    }),
    enabled: z.boolean(),
    canEdit: z.boolean(),
    canToggle: z.boolean(),
    canDelete: z.boolean(),
    updatedAt: dateTime()
      .nullable()
      .meta({ description: 'Null numa embutida nunca alterada.' }),
  }),
)

export const AiSkillListDTO = dto(
  'AiSkillList',
  z.object({
    skills: z.array(AiSkillDTO),
    canManageWorkspace: z.boolean().meta({
      description:
        'OWNER/ADMIN: cria skills do workspace e liga/desliga as embutidas.',
    }),
  }),
)

export const AiMemoryDTO = dto(
  'AiMemory',
  z.object({
    id: z.string(),
    scope: Scope,
    content: z
      .string()
      .meta({ example: 'O time de suporte atende das 8h às 18h.' }),
    source: z.enum(['AUTO', 'MANUAL']),
    sourceConversationId: z.string().nullable().meta({
      description:
        'Conversa de origem — só para quem salvou (conversas são privadas).',
    }),
    lastUsedAt: dateTime().nullable(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
    canEdit: z.boolean(),
  }),
)

export const AiMemoryListDTO = dto(
  'AiMemoryList',
  z.object({
    memoryEnabled: z.boolean().meta({
      description:
        'Interruptor do workspace: desligado, nada é salvo nem usado (a lista continua visível para revisão).',
    }),
    canManageWorkspace: z.boolean(),
    workspace: z.array(AiMemoryDTO),
    personal: z.array(AiMemoryDTO),
  }),
)
