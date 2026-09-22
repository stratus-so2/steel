import type {
  SdAutomationEvent,
  SdAutomationRule,
  SdMessageVisibility,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

/**
 * Acesso a dados do motor de automação do ServiceDesk: regras (tabela da
 * fatia de configuração, só leitura + contador de execuções) e as inserções
 * diretas que as ações fazem (mensagem de sistema, tarefa).
 */
export const SdAutomationRepository = {
  async listActiveRules(
    workspaceId: string,
    event: SdAutomationEvent,
  ): Promise<Result<SdAutomationRule[]>> {
    try {
      const rows = await prisma.sdAutomationRule.findMany({
        where: { workspaceId, event, active: true },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      })
      return ok(rows)
    } catch (error) {
      return err(dbError('Failed to list ServiceDesk automation rules', error))
    }
  },

  async markRun(ruleId: string, at: Date): Promise<Result<void>> {
    try {
      await prisma.sdAutomationRule.update({
        where: { id: ruleId },
        data: { runCount: { increment: 1 }, lastRunAt: at },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to mark ServiceDesk automation run', error))
    }
  },

  async insertSystemMessage(data: {
    workspaceId: string
    ticketId: string
    body: string
    visibility: SdMessageVisibility
  }): Promise<Result<{ id: string }>> {
    try {
      const row = await prisma.sdTicketMessage.create({
        data: { ...data, authorKind: 'SYSTEM', channel: 'PLATFORM' },
        select: { id: true },
      })
      return ok(row)
    } catch (error) {
      return err(dbError('Failed to post ServiceDesk system message', error))
    }
  },

  /** Insere tarefas no fim da lista do chamado. */
  async insertTasks(
    workspaceId: string,
    ticketId: string,
    createdById: string,
    tasks: {
      title: string
      description?: string | null
      assigneeId?: string | null
      dueDate?: Date | null
    }[],
  ): Promise<Result<number>> {
    if (tasks.length === 0) return ok(0)
    try {
      const start = await prisma.sdTicketTask.count({ where: { ticketId } })
      const result = await prisma.sdTicketTask.createMany({
        data: tasks.map((task, i) => ({
          workspaceId,
          ticketId,
          createdById,
          title: task.title,
          description: task.description ?? null,
          assigneeId: task.assigneeId ?? null,
          dueDate: task.dueDate ?? null,
          position: start + i,
        })),
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to create ServiceDesk tasks', error))
    }
  },
}
