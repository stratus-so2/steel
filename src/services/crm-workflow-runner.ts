import { sendEmail } from '@/src/lib/mail/send'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import type { CrmWorkflowNodeType } from '@/src/schemas/crm-workflow.schema'

export type CrmWorkflowNodeExecutionContext = {
  workspaceId: string
  createdById: string
  trigger: Record<string, unknown>
}

export type CrmWorkflowNodeExecutionResult = {
  ok: boolean
  output?: unknown
  error?: string
}

// Substitui `{{trigger.<campo>}}` no valor por trigger[campo], quando string.
function resolveValue(
  value: unknown,
  trigger: Record<string, unknown>,
): unknown {
  if (typeof value !== 'string') return value
  const match = value.match(/^\{\{trigger\.([\w.]+)\}\}$/)
  if (!match) return value
  return trigger[match[1]] ?? value
}

function resolveConfig(
  config: Record<string, unknown>,
  trigger: Record<string, unknown>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    resolved[key] = resolveValue(value, trigger)
  }
  return resolved
}

export async function executeCrmWorkflowNode(
  nodeType: CrmWorkflowNodeType,
  rawConfig: Record<string, unknown>,
  ctx: CrmWorkflowNodeExecutionContext,
): Promise<CrmWorkflowNodeExecutionResult> {
  const config = resolveConfig(rawConfig, ctx.trigger)

  switch (nodeType) {
    case 'CREATE_PERSON': {
      const name = typeof config.name === 'string' ? config.name : undefined
      if (!name) return { ok: false, error: 'name é obrigatório' }
      const result = await CrmPersonRepository.create({
        workspaceId: ctx.workspaceId,
        createdById: ctx.createdById,
        name,
        emails: typeof config.email === 'string' ? [config.email] : undefined,
      })
      if (!result.ok) return { ok: false, error: result.error.code }
      return { ok: true, output: { personId: result.value.id } }
    }

    case 'CREATE_TASK': {
      const title = typeof config.title === 'string' ? config.title : undefined
      if (!title) return { ok: false, error: 'title é obrigatório' }
      const result = await CrmTaskRepository.create({
        workspaceId: ctx.workspaceId,
        createdById: ctx.createdById,
        title,
        body: typeof config.body === 'string' ? config.body : undefined,
      })
      if (!result.ok) return { ok: false, error: result.error.code }
      return { ok: true, output: { taskId: result.value.id } }
    }

    case 'SEND_EMAIL': {
      const to = typeof config.to === 'string' ? config.to : undefined
      const subject =
        typeof config.subject === 'string' ? config.subject : undefined
      const contentHtml =
        typeof config.contentHtml === 'string' ? config.contentHtml : undefined
      if (!to || !subject || !contentHtml) {
        return {
          ok: false,
          error: 'to, subject e contentHtml são obrigatórios',
        }
      }
      try {
        const response = await sendEmail({ to, subject, html: contentHtml })
        return { ok: true, output: { messageId: response.id } }
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : 'Falha ao enviar',
        }
      }
    }

    default:
      return { ok: false, error: `Node type desconhecido: ${nodeType}` }
  }
}
