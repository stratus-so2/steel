import type OpenAI from 'openai'
import { CreateCrmDashboardSchema } from '@/src/schemas/crm-dashboard.schema'
import { CreateCrmFormSchema } from '@/src/schemas/crm-form.schema'
import { CreateCrmLeadSchema } from '@/src/schemas/crm-lead.schema'
import { CreateCrmProposalTemplateSchema } from '@/src/schemas/crm-proposal-template.schema'
import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import { CrmDashboardService } from '@/src/services/crm-dashboard.service'
import { CrmFormService } from '@/src/services/crm-form.service'
import { CrmLeadService } from '@/src/services/crm-lead.service'
import { CrmOpportunityService } from '@/src/services/crm-opportunity.service'
import {
  CrmPipelineService,
  CrmPipelineStageService,
} from '@/src/services/crm-pipeline.service'
import { CrmProposalService } from '@/src/services/crm-proposal.service'
import { CrmProposalTemplateService } from '@/src/services/crm-proposal-template.service'
import { CrmSocialTrendingService } from '@/src/services/crm-social-trending.service'

export type AiToolContext = { actorId: string; workspaceId: string }

/**
 * Registro de tools do assistente de IA (Responses API): definição (schema
 * que o modelo vê) + executor (código real que roda no servidor). Tools de
 * escrita (`create_*`) exigem `userConfirmed: true` no schema — o modelo só
 * deve marcar isso depois que o usuário aprovar explicitamente a proposta
 * numa mensagem anterior; ver `CRM_AI_SYSTEM_PROMPT` em `crm-ai.service.ts`.
 * Não é uma garantia criptográfica (um modelo mal-instruído ainda poderia
 * mentir o campo), mas combinado com o prompt é o padrão leve usual pra
 * "confirmar antes de agir" em agentes de chat.
 */
type ToolDefinition = {
  spec: OpenAI.Responses.FunctionTool
  execute: (
    ctx: AiToolContext,
    args: Record<string, unknown>,
  ) => Promise<string>
}

function readTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  execute: ToolDefinition['execute'],
): ToolDefinition {
  return {
    spec: {
      type: 'function',
      name,
      description,
      strict: false,
      parameters: {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
      },
    },
    execute,
  }
}

/** Tool de escrita: sempre injeta `userConfirmed` obrigatório no schema. */
function writeTool(
  name: string,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  execute: ToolDefinition['execute'],
): ToolDefinition {
  return readTool(
    name,
    `${description} SÓ chame esta função depois que o usuário confirmar explicitamente a proposta numa mensagem anterior — antes disso, responda em texto descrevendo exatamente o que seria criado e pergunte se pode prosseguir.`,
    {
      ...properties,
      userConfirmed: {
        type: 'boolean',
        description:
          'true somente se a mensagem mais recente do usuário aprovou explicitamente esta ação específica. Nunca assuma confirmação implícita.',
      },
    },
    [...required, 'userConfirmed'],
    async (ctx, args) => {
      if (args.userConfirmed !== true) {
        return 'Ainda não confirmado. Descreva a proposta pro usuário em texto e peça uma confirmação explícita antes de chamar esta função de novo.'
      }
      return execute(ctx, args)
    },
  )
}

function jsonError(code: string): string {
  return JSON.stringify({ error: code })
}

const TOOLS: ToolDefinition[] = [
  readTool(
    'list_pipelines_and_stages',
    'Lista os pipelines de vendas do workspace com seus estágios (nome, posição, probabilidade). Use antes de list_opportunities para poder nomear os estágios.',
    {},
    [],
    async (ctx) => {
      const pipelines = await CrmPipelineService.list(
        ctx.actorId,
        ctx.workspaceId,
      )
      if (!pipelines.ok) return jsonError(pipelines.error.code)

      const withStages = await Promise.all(
        pipelines.value.map(async (p) => {
          const stages = await CrmPipelineStageService.list(
            ctx.actorId,
            ctx.workspaceId,
            p.id,
          )
          return {
            id: p.id,
            name: p.name,
            isDefault: p.isDefault,
            stages: stages.ok
              ? stages.value.map((s) => ({
                  id: s.id,
                  name: s.name,
                  category: s.category,
                  probability: s.probability,
                }))
              : [],
          }
        }),
      )
      return JSON.stringify(withStages)
    },
  ),

  readTool(
    'list_opportunities',
    'Lista as oportunidades (negócios) do funil de vendas do workspace — nome, valor, estágio, data de fechamento.',
    {},
    [],
    async (ctx) => {
      const result = await CrmOpportunityService.list(
        ctx.actorId,
        ctx.workspaceId,
        {},
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(
        result.value.map((o) => ({
          id: o.id,
          name: o.name,
          amount: o.amount,
          stageId: o.stageId,
          pipelineId: o.pipelineId,
          closeDate: o.closeDate,
        })),
      )
    },
  ),

  readTool(
    'list_leads',
    'Lista os leads do workspace — nome, empresa, origem, status, pontuação.',
    {},
    [],
    async (ctx) => {
      const result = await CrmLeadService.list(ctx.actorId, ctx.workspaceId, {})
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(
        result.value.map((l) => ({
          id: l.id,
          name: l.name,
          company: l.company,
          source: l.source,
          stage: l.stage,
          score: l.score,
        })),
      )
    },
  ),

  readTool(
    'list_proposals',
    'Lista as propostas comerciais do workspace — nome, status, quantidade de visualizações.',
    {},
    [],
    async (ctx) => {
      const result = await CrmProposalService.list(ctx.actorId, ctx.workspaceId)
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(
        result.value.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          viewsCount: p.viewsCount,
          validUntil: p.validUntil,
        })),
      )
    },
  ),

  readTool(
    'list_competitors',
    'Lista os concorrentes rastreados (Instagram/YouTube) — handle, seguidores, status de sincronização.',
    {},
    [],
    async (ctx) => {
      const result = await CrmCompetitorService.list(
        ctx.actorId,
        ctx.workspaceId,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(
        result.value.map((c) => ({
          id: c.id,
          platform: c.platform,
          handle: c.handle,
          followersCount: c.followersCount,
          syncStatus: c.syncStatus,
        })),
      )
    },
  ),

  readTool(
    'get_competitor_growth',
    'Série histórica de seguidores de um concorrente vs. a conta conectada do workspace, com variação no período. Use list_competitors primeiro para achar o competitorId.',
    {
      competitorId: {
        type: 'string',
        description: 'ID do concorrente (de list_competitors).',
      },
      range: {
        type: 'string',
        enum: ['7d', '30d', '90d'],
        description: 'Janela de tempo. Padrão: 30d.',
      },
    },
    ['competitorId'],
    async (ctx, args) => {
      const range = (args.range as '7d' | '30d' | '90d' | undefined) ?? '30d'
      const result = await CrmCompetitorService.getMetrics(
        ctx.actorId,
        ctx.workspaceId,
        args.competitorId as string,
        range,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(result.value)
    },
  ),

  readTool(
    'get_trending_posts',
    'Ranking dos posts publicados hoje na conta do Instagram conectada, por velocidade de engajamento (quanto mais views/interações em menos tempo, mais em alta).',
    {},
    [],
    async (ctx) => {
      const result = await CrmSocialTrendingService.getTodayRanking(
        ctx.actorId,
        ctx.workspaceId,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify(result.value)
    },
  ),

  writeTool(
    'create_lead',
    'Cria um novo lead no CRM. Requer nome, origem, e pelo menos um email ou telefone.',
    {
      name: { type: 'string', description: 'Nome do lead (obrigatório).' },
      emails: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ao menos um email ou telefone é obrigatório.',
      },
      phones: {
        type: 'array',
        items: { type: 'string' },
        description: 'Ao menos um email ou telefone é obrigatório.',
      },
      company: { type: 'string' },
      jobTitle: { type: 'string' },
      city: { type: 'string' },
      source: { type: 'string', description: 'Origem do lead (obrigatório).' },
    },
    ['name', 'source'],
    async (ctx, args) => {
      const parsed = CreateCrmLeadSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        })
      }
      const result = await CrmLeadService.create(
        ctx.actorId,
        ctx.workspaceId,
        parsed.data,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify({ created: true, id: result.value.id })
    },
  ),

  writeTool(
    'create_dashboard',
    'Cria um novo dashboard vazio (sem widgets) no CRM.',
    {
      title: {
        type: 'string',
        description: 'Título do dashboard (obrigatório).',
      },
    },
    ['title'],
    async (ctx, args) => {
      const parsed = CreateCrmDashboardSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        })
      }
      const result = await CrmDashboardService.create(
        ctx.actorId,
        ctx.workspaceId,
        parsed.data,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify({ created: true, id: result.value.id })
    },
  ),

  writeTool(
    'create_form',
    'Cria um formulário público completo no CRM, com campos. `action` define o que o formulário gera ao ser enviado (COMPANY/PERSON/LEAD); cada campo mapeia pra um atributo dessa entidade via `mapping`.',
    {
      name: { type: 'string' },
      description: { type: 'string' },
      action: { type: 'string', enum: ['COMPANY', 'PERSON', 'LEAD'] },
      fields: {
        type: 'array',
        description:
          'Campos do formulário, na ordem de exibição. `mapping.attribute` deve ser um atributo válido da entidade alvo (para LEAD: name, email, phone, company, jobTitle, source).',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            type: {
              type: 'string',
              enum: [
                'text',
                'email',
                'phone',
                'number',
                'textarea',
                'select',
                'checkbox',
                'url',
                'date',
              ],
            },
            required: { type: 'boolean' },
            options: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  label: { type: 'string' },
                  value: { type: 'string' },
                },
              },
            },
            mapping: {
              type: 'object',
              properties: {
                target: { type: 'string', enum: ['person', 'company', 'lead'] },
                attribute: { type: 'string' },
              },
            },
          },
        },
      },
    },
    ['name', 'action', 'fields'],
    async (ctx, args) => {
      const parsed = CreateCrmFormSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        })
      }
      const result = await CrmFormService.create(
        ctx.actorId,
        ctx.workspaceId,
        parsed.data,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify({ created: true, id: result.value.id })
    },
  ),

  writeTool(
    'create_proposal_template',
    'Cria um template de proposta comercial com o esqueleto de seções (sem conteúdo padrão, que fica pra edição manual depois).',
    {
      name: { type: 'string' },
      description: { type: 'string' },
      sections: {
        type: 'array',
        description: 'Seções do template, na ordem desejada.',
        items: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'COVER',
                'COMPANY_PRESENTATION',
                'CLIENT_NEEDS',
                'SOLUTION',
                'SCOPE',
                'PRODUCTS_PRICING',
                'COMMERCIAL_TERMS',
                'TERMS_CONDITIONS',
                'SIGNATURE',
              ],
            },
            order: { type: 'number' },
            enabled: { type: 'boolean' },
          },
          required: ['type', 'order'],
        },
      },
    },
    ['name', 'sections'],
    async (ctx, args) => {
      const parsed = CreateCrmProposalTemplateSchema.safeParse(args)
      if (!parsed.success) {
        return JSON.stringify({
          error: 'VALIDATION_ERROR',
          issues: parsed.error.issues,
        })
      }
      const result = await CrmProposalTemplateService.create(
        ctx.actorId,
        ctx.workspaceId,
        parsed.data,
      )
      if (!result.ok) return jsonError(result.error.code)
      return JSON.stringify({ created: true, id: result.value.id })
    },
  ),
]

export const CRM_AI_FUNCTION_TOOLS: OpenAI.Responses.FunctionTool[] = TOOLS.map(
  (t) => t.spec,
)

const TOOLS_BY_NAME = new Map(TOOLS.map((t) => [t.spec.name, t]))

/** Executa uma tool pelo nome — usada pelo loop de tool-calling em `crm-ai.service.ts`. */
export async function executeAiTool(
  name: string,
  args: Record<string, unknown>,
  ctx: AiToolContext,
): Promise<string> {
  const tool = TOOLS_BY_NAME.get(name)
  if (!tool) return jsonError('UNKNOWN_TOOL')
  try {
    return await tool.execute(ctx, args)
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : 'TOOL_EXECUTION_FAILED',
    )
  }
}
