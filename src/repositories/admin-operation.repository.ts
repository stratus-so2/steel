import type { AdminOperation, AdminOperationKind, Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export interface CreateAdminOperationInput {
  kind: AdminOperationKind
  workspaceId: string
  workspaceSlug: string
  workspaceName: string
  backupId?: string | null
  requestedById: string
  requestedByEmail: string
  reason: string
  meta?: Prisma.InputJsonValue
}

const ACTIVE = ['QUEUED', 'RUNNING'] as const

export const AdminOperationRepository = {
  async create(
    input: CreateAdminOperationInput,
  ): Promise<Result<AdminOperation>> {
    try {
      const operation = await prisma.adminOperation.create({ data: input })
      return ok(operation)
    } catch (error) {
      return err(dbError('Failed to create admin operation', error))
    }
  },

  async findById(id: string): Promise<Result<AdminOperation | null>> {
    try {
      const operation = await prisma.adminOperation.findUnique({
        where: { id },
      })
      return ok(operation)
    } catch (error) {
      return err(dbError('Failed to find admin operation', error))
    }
  },

  /** Exclusão/restauração ainda na fila ou rodando para o workspace. */
  async findActiveByWorkspace(
    workspaceId: string,
  ): Promise<Result<AdminOperation | null>> {
    try {
      const operation = await prisma.adminOperation.findFirst({
        where: { workspaceId, status: { in: [...ACTIVE] } },
        orderBy: { createdAt: 'desc' },
      })
      return ok(operation)
    } catch (error) {
      return err(dbError('Failed to find active admin operation', error))
    }
  },

  async listRecent(params: {
    workspaceId?: string
    limit: number
  }): Promise<Result<AdminOperation[]>> {
    try {
      const operations = await prisma.adminOperation.findMany({
        where: params.workspaceId
          ? { workspaceId: params.workspaceId }
          : undefined,
        orderBy: { createdAt: 'desc' },
        take: params.limit,
      })
      return ok(operations)
    } catch (error) {
      return err(dbError('Failed to list admin operations', error))
    }
  },

  async markFailed(id: string, error: string): Promise<Result<void>> {
    try {
      await prisma.adminOperation.update({
        where: { id },
        data: { status: 'FAILED', error, completedAt: new Date() },
      })
      return ok(undefined)
    } catch (cause) {
      return err(dbError('Failed to mark admin operation as failed', cause))
    }
  },
}
