import { z } from 'zod'
import {
  CreateAiMemorySchema,
  ListAiMemoriesQuerySchema,
  UpdateAiMemorySchema,
} from '@/src/schemas/ai-memory.schema'
import {
  CreateAiSkillSchema,
  UpdateAiSkillSchema,
} from '@/src/schemas/ai-skill.schema'
import { WORKSPACE_MEMBER_ERRORS } from '../common'
import type { ErrorEntry, OpenApiRegistry, RouteConfig } from '../registry'
import {
  AiMemoryDTO,
  AiMemoryListDTO,
  AiSkillDTO,
  AiSkillListDTO,
} from '../schemas/steel-ai-skills'

/** Steel AI — Skills e Memória (`/workspaces/{id}/ai/{skills,memories}/**`). */

const TAG = 'Steel AI' as const
const SKILL_PARAM = {
  description: 'ID da skill, ou `builtin:<comando>` para uma embutida.',
}
const MEMORY_PARAM = { description: 'ID do fato na memória.' }

const SKILL_ADMIN: ErrorEntry = {
  code: 'FORBIDDEN',
  when: 'Skill do workspace (ou embutida) sem ser OWNER/ADMIN; excluir uma embutida',
}
const SKILL_NOT_FOUND: ErrorEntry = {
  code: 'AI_SKILL_NOT_FOUND',
  when: 'Inexistente, de outro workspace ou pessoal de outro usuário',
}
const MEMORY_ADMIN: ErrorEntry = {
  code: 'FORBIDDEN',
  when: 'Memória do workspace sem ser OWNER/ADMIN',
}
const MEMORY_NOT_FOUND: ErrorEntry = {
  code: 'AI_MEMORY_NOT_FOUND',
  when: 'Inexistente, de outro workspace ou pessoal de outro usuário',
}
const GUARD: ErrorEntry = {
  code: 'VALIDATION_ERROR',
  when: 'Conteúdo com credencial (senha, token, chave), cartão/CPF ou dado pessoal sensível (LGPD art. 5º, II)',
}

const routes: RouteConfig[] = [
  {
    method: 'get',
    path: '/workspaces/{id}/ai/skills',
    tags: [TAG],
    summary: 'Listar skills',
    description:
      'Skills embutidas (com o estado ligado/desligado do workspace), as do workspace e as pessoais do usuário. No chat, `/<comando>` no início da mensagem aplica a skill; o modelo também pode escolher uma pelo catálogo.',
    responses: {
      200: { description: 'Skills.', schema: AiSkillListDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/skills',
    tags: [TAG],
    summary: 'Criar skill',
    description:
      'Pessoal (`PERSONAL`, padrão) para qualquer membro; do workspace (`WORKSPACE`) só para OWNER/ADMIN. O comando é único no escopo e não pode repetir o de uma embutida.',
    consent: true,
    body: {
      schema: CreateAiSkillSchema,
      example: {
        scope: 'PERSONAL',
        slug: 'resumo-cliente',
        name: 'Resumo do cliente',
        description: 'Resumo de um cliente com chamados e oportunidades.',
        instructions:
          'Busque o cliente citado e resuma os chamados abertos e as oportunidades em andamento.',
        toolNames: ['sd_search_customers', 'crm_list_opportunities'],
      },
    },
    responses: {
      201: { description: 'Skill criada.', schema: AiSkillDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      SKILL_ADMIN,
      'AI_SKILL_SLUG_TAKEN',
      {
        code: 'VALIDATION_ERROR',
        when: 'Comando inválido ou ferramenta desconhecida',
      },
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/ai/skills/{skillId}',
    tags: [TAG],
    summary: 'Editar skill',
    description:
      'Atualização parcial. Numa embutida (`builtin:<comando>`) só `enabled` é aceito, e só por OWNER/ADMIN.',
    params: { skillId: SKILL_PARAM },
    consent: true,
    body: { schema: UpdateAiSkillSchema, example: { enabled: false } },
    responses: { 200: { description: 'Skill.', schema: AiSkillDTO } },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      SKILL_ADMIN,
      SKILL_NOT_FOUND,
      'AI_SKILL_SLUG_TAKEN',
    ],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/ai/skills/{skillId}',
    tags: [TAG],
    summary: 'Excluir skill',
    description: 'Exclusão lógica. Embutidas não podem ser excluídas.',
    params: { skillId: SKILL_PARAM },
    consent: true,
    responses: {
      200: {
        description: 'Skill excluída.',
        schema: z.object({ id: z.string() }),
      },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, SKILL_ADMIN, SKILL_NOT_FOUND],
  },
  {
    method: 'get',
    path: '/workspaces/{id}/ai/memories',
    tags: [TAG],
    summary: 'Listar memória',
    description:
      'Fatos do workspace e os pessoais do usuário, mais recentes primeiro (`q` busca no texto). Responde mesmo com a memória desligada (`memoryEnabled: false`), para revisão.',
    query: ListAiMemoriesQuerySchema,
    responses: {
      200: { description: 'Memória.', schema: AiMemoryListDTO },
    },
    errors: WORKSPACE_MEMBER_ERRORS,
  },
  {
    method: 'post',
    path: '/workspaces/{id}/ai/memories',
    tags: [TAG],
    summary: 'Adicionar fato à memória',
    description:
      'Fato curto (até 500 caracteres), origem `MANUAL`. `WORKSPACE` só para OWNER/ADMIN. Recusa credenciais, documentos e dados pessoais sensíveis, e fatos quase idênticos a um já salvo.',
    consent: true,
    body: {
      schema: CreateAiMemorySchema,
      example: {
        scope: 'WORKSPACE',
        content: 'O time de suporte atende das 8h às 18h.',
      },
    },
    responses: {
      201: { description: 'Fato salvo.', schema: AiMemoryDTO },
    },
    errors: [
      ...WORKSPACE_MEMBER_ERRORS,
      MEMORY_ADMIN,
      'AI_MEMORY_DISABLED',
      GUARD,
      { code: 'CONFLICT', when: 'Já existe um fato quase idêntico' },
    ],
  },
  {
    method: 'patch',
    path: '/workspaces/{id}/ai/memories/{memoryId}',
    tags: [TAG],
    summary: 'Editar fato da memória',
    params: { memoryId: MEMORY_PARAM },
    consent: true,
    body: {
      schema: UpdateAiMemorySchema,
      example: { content: 'O time de suporte atende das 8h às 20h.' },
    },
    responses: { 200: { description: 'Fato.', schema: AiMemoryDTO } },
    errors: [...WORKSPACE_MEMBER_ERRORS, MEMORY_ADMIN, MEMORY_NOT_FOUND, GUARD],
  },
  {
    method: 'delete',
    path: '/workspaces/{id}/ai/memories/{memoryId}',
    tags: [TAG],
    summary: 'Apagar fato da memória',
    description:
      'Também é o "Desfazer" do chip "Memória salva" no chat. Funciona com a memória desligada.',
    params: { memoryId: MEMORY_PARAM },
    consent: true,
    responses: {
      200: {
        description: 'Fato apagado.',
        schema: z.object({ id: z.string() }),
      },
    },
    errors: [...WORKSPACE_MEMBER_ERRORS, MEMORY_ADMIN, MEMORY_NOT_FOUND],
  },
]

export function registerSteelAiSkillsPaths(registry: OpenApiRegistry): void {
  for (const route of routes) registry.registerRoute(route)
}
