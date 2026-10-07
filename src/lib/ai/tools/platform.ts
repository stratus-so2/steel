import type { ModuleKind } from '@prisma/client'
import { z } from 'zod'
import { validationError } from '@/src/errors/app-error'
import { NOTIFICATION_MODULES } from '@/src/lib/notification-kind'
import { ok, type Result } from '@/src/lib/result'
import { SEARCH_ENTITY_TYPES } from '@/src/lib/search/search-entities'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { MembershipService } from '@/src/services/membership.service'
import { NotificationService } from '@/src/services/notification.service'
import { SearchService } from '@/src/services/search.service'
import { WorkspaceService } from '@/src/services/workspace.service'
import type { NotificationDTO } from '@/types/notification'
import type { AnySteelAiTool, SteelAiTool } from './types'

/**
 * Platform-level Steel AI tools (workspace, members, inbox, global
 * search). All READ.
 */

export const MODULE_LABELS: Record<ModuleKind, string> = {
  SERVICE_DESK: 'ServiceDesk',
  CRM: 'CRM',
  COMMUNICATION: 'Comunicação (WhatsApp)',
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

function zodParser<T>(schema: z.ZodType<T>) {
  return (args: Record<string, unknown>): Result<T> => {
    const parsed = schema.safeParse(args ?? {})
    if (parsed.success) return ok(parsed.data)
    return {
      ok: false,
      error: validationError(
        'Argumentos inválidos para a ferramenta',
        parsed.error.issues,
      ),
    }
  }
}

const limitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(MAX_LIMIT)
  .default(DEFAULT_LIMIT)

const limitParameter = {
  type: 'integer',
  minimum: 1,
  maximum: MAX_LIMIT,
  description: `Quantidade máxima de itens (padrão ${DEFAULT_LIMIT}, máximo ${MAX_LIMIT}).`,
}

/* -------------------------------- overview -------------------------------- */

const OverviewArgs = z.object({}).strict()

export const wsOverviewTool: SteelAiTool<z.infer<typeof OverviewArgs>> = {
  name: 'ws_overview',
  label: 'Consultando o workspace',
  module: null,
  kind: 'READ',
  description:
    'Visão geral do workspace atual: nome, plano, módulos habilitados (ServiceDesk, CRM, Comunicação) e quantidade de membros. Use para responder sobre o que o workspace tem disponível.',
  parameters: { type: 'object', properties: {}, additionalProperties: false },
  parse: zodParser(OverviewArgs),
  async execute(ctx) {
    const workspace = await WorkspaceService.getById(
      ctx.actorId,
      ctx.workspaceId,
    )
    if (!workspace.ok) return workspace

    const [modules, members] = await Promise.all([
      WorkspaceModuleAccessRepository.listByWorkspace(ctx.workspaceId),
      MembershipService.countByWorkspace(ctx.workspaceId),
    ])
    if (!modules.ok) return modules
    if (!members.ok) return members

    const enabled = modules.value
      .filter((m) => m.enabled)
      .map((m) => MODULE_LABELS[m.module])

    return ok({
      data: {
        name: workspace.value.name,
        slug: workspace.value.slug,
        plan: workspace.value.activePlan,
        trialEndsAt: workspace.value.trialEndsAt,
        enabledModules: enabled,
        memberCount: members.value,
      },
      summary: `${workspace.value.name}: ${members.value} membro(s), ${enabled.length} módulo(s) habilitado(s)`,
    })
  },
}

/* --------------------------------- members -------------------------------- */

const MembersArgs = z.object({
  query: z.string().trim().min(1).max(100).optional(),
  limit: limitSchema,
})

export const wsMembersTool: SteelAiTool<z.infer<typeof MembersArgs>> = {
  name: 'ws_members',
  label: 'Consultando membros',
  module: null,
  kind: 'READ',
  description:
    'Lista os membros do workspace (nome, e-mail e papel). `query` filtra por nome ou e-mail. Use para descobrir quem é responsável por algo ou o id de um usuário antes de atribuir.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Trecho do nome ou do e-mail (opcional).',
      },
      limit: limitParameter,
    },
    additionalProperties: false,
  },
  permission: { resource: 'members', action: 'VIEW' },
  parse: zodParser(MembersArgs),
  async execute(ctx, args) {
    const members = await MembershipService.listMembers(
      ctx.actorId,
      ctx.workspaceId,
    )
    if (!members.ok) return members

    const needle = args.query?.toLocaleLowerCase('pt-BR')
    const matching = needle
      ? members.value.filter(
          (m) =>
            m.name.toLocaleLowerCase('pt-BR').includes(needle) ||
            m.email.toLocaleLowerCase('pt-BR').includes(needle),
        )
      : members.value

    return ok({
      data: {
        total: matching.length,
        items: matching.slice(0, args.limit).map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
        })),
      },
      summary: `${matching.length} membro(s) encontrado(s)`,
    })
  },
}

/* ---------------------------------- inbox ---------------------------------- */

const InboxArgs = z.object({
  onlyUnread: z.boolean().default(false),
  module: z.enum(NOTIFICATION_MODULES).optional(),
  search: z.string().trim().min(1).max(200).optional(),
  limit: limitSchema,
})

function compactNotification(n: NotificationDTO) {
  return {
    id: n.id,
    title: n.title,
    body: n.body.length > 300 ? `${n.body.slice(0, 300)}…` : n.body,
    href: n.href,
    read: n.read,
    module: n.moduleLabel,
    kind: n.kindLabel,
    createdAt: n.createdAt,
  }
}

export const wsNotificationsTool: SteelAiTool<z.infer<typeof InboxArgs>> = {
  name: 'ws_notifications',
  label: 'Consultando sua caixa de entrada',
  module: null,
  kind: 'READ',
  description:
    'Notificações da caixa de entrada do próprio usuário neste workspace, não lidas primeiro (depois as mais recentes). Filtros: `onlyUnread`, `module` (SERVICE_DESK, COMMUNICATION, CRM, OTHER) e `search` (título/corpo).',
  parameters: {
    type: 'object',
    properties: {
      onlyUnread: {
        type: 'boolean',
        description: 'Só as não lidas (padrão false).',
      },
      module: { type: 'string', enum: [...NOTIFICATION_MODULES] },
      search: { type: 'string', description: 'Busca em título e corpo.' },
      limit: limitParameter,
    },
    additionalProperties: false,
  },
  parse: zodParser(InboxArgs),
  async execute(ctx, args) {
    const filters = { module: args.module, search: args.search }
    const unread = await NotificationService.listInbox(
      ctx.actorId,
      ctx.workspaceId,
      { folder: 'unread', limit: args.limit, ...filters },
    )
    if (!unread.ok) return unread

    const items = [...unread.value.items]
    if (!args.onlyUnread && items.length < args.limit) {
      const all = await NotificationService.listInbox(
        ctx.actorId,
        ctx.workspaceId,
        { folder: 'all', limit: args.limit, ...filters },
      )
      if (!all.ok) return all
      const seen = new Set(items.map((n) => n.id))
      for (const n of all.value.items) {
        if (items.length >= args.limit) break
        if (!seen.has(n.id)) items.push(n)
      }
    }

    return ok({
      data: {
        unreadCount: unread.value.unreadCount,
        items: items.map(compactNotification),
      },
      summary: `${unread.value.unreadCount} não lida(s), ${items.length} listada(s)`,
    })
  },
}

/* ---------------------------------- search --------------------------------- */

const SearchArgs = z.object({
  query: z.string().trim().min(1).max(120),
  types: z.array(z.enum(SEARCH_ENTITY_TYPES)).min(1).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(10),
})

export const wsSearchTool: SteelAiTool<z.infer<typeof SearchArgs>> = {
  name: 'ws_search',
  label: 'Buscando no workspace',
  module: null,
  kind: 'READ',
  description:
    'Busca global no workspace (a mesma do Ctrl+K): chamados (por código como INC-000123 ou número), artigos da base de conhecimento, clientes/contatos/itens de configuração do ServiceDesk, leads, oportunidades, pessoas, empresas, tarefas e propostas do CRM, conversas e contatos do WhatsApp e membros. Ordena por relevância (código exato, prefixo, texto, tolerância a erros de digitação) e só retorna o que o usuário pode abrir. Use para localizar um registro por nome, código, telefone ou e-mail antes de consultá-lo com a ferramenta do módulo.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Texto, código, telefone ou e-mail a buscar.',
      },
      types: {
        type: 'array',
        items: { type: 'string', enum: [...SEARCH_ENTITY_TYPES] },
        description: 'Restringe os tipos (opcional).',
      },
      limit: {
        type: 'integer',
        minimum: 1,
        maximum: MAX_LIMIT,
        description: 'Quantidade máxima de resultados (padrão 10).',
      },
    },
    required: ['query'],
    additionalProperties: false,
  },
  parse: zodParser(SearchArgs),
  async execute(ctx, args) {
    const result = await SearchService.search(ctx.actorId, ctx.workspaceId, {
      q: args.query,
      types: args.types,
      limit: args.limit,
    })
    if (!result.ok) return result
    return ok({
      data: {
        items: result.value.results.map((r) => ({
          type: r.type,
          id: r.id,
          title: r.title,
          subtitle: r.subtitle,
          snippet: r.snippet,
          href: r.href,
        })),
      },
      summary: `${result.value.results.length} resultado(s) para "${args.query}"`,
    })
  },
}

/** Steel AI tools for platform-level (workspace, members, inbox, search). */
export const PLATFORM_AI_TOOLS: AnySteelAiTool[] = [
  wsOverviewTool,
  wsMembersTool,
  wsNotificationsTool,
  wsSearchTool,
]
