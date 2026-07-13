import type { ModuleKind } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import {
  connectionForbidden,
  connectionNotFound,
  connectionTestFailed,
  forbidden,
} from '@/src/errors'
import { encryptConnectionSecret } from '@/src/lib/crypto'
import { buildModuleConnectionString } from '@/src/lib/module-db/connection-string'
import { evictModuleConnection } from '@/src/lib/module-db/resolver'
import { createPrismaClient } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { toWorkspaceConnectionDTO } from '@/src/mappers/workspace-connection.mapper'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceConnectionRepository } from '@/src/repositories/workspace-connection.repository'
import type {
  SaveWorkspaceConnectionDTO,
  TestWorkspaceConnectionDTO,
} from '@/src/schemas/workspace-connection.schema'
import type { WorkspaceConnectionDTO } from '@/types/workspace-connection'

const PRIVILEGED_ROLES = ['OWNER', 'ADMIN'] as const

async function requirePrivilegedMembership(
  actorId: string,
  workspaceId: string,
): Promise<Result<void>> {
  const membership = await MembershipRepository.findByUserAndWorkspace(
    actorId,
    workspaceId,
  )
  if (!membership.ok) return membership
  if (!membership.value) return err(forbidden())

  if (!PRIVILEGED_ROLES.includes(membership.value.role as never)) {
    return err(connectionForbidden())
  }

  return ok(undefined)
}

async function pingConnectionString(
  connectionString: string,
): Promise<Result<void>> {
  const client = createPrismaClient(connectionString, { max: 1 })
  try {
    await client.$queryRaw`SELECT 1`
    return ok(undefined)
  } catch (error) {
    return err(
      connectionTestFailed(
        error instanceof Error ? error.message : 'Falha ao conectar',
      ),
    )
  } finally {
    await client.$disconnect()
  }
}

export const WorkspaceConnectionService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<WorkspaceConnectionDTO[]>> {
    const access = await requirePrivilegedMembership(actorId, workspaceId)
    if (!access.ok) return access

    const result =
      await WorkspaceConnectionRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toWorkspaceConnectionDTO))
  },

  async save(
    actorId: string,
    workspaceId: string,
    module: ModuleKind,
    dto: SaveWorkspaceConnectionDTO,
  ): Promise<Result<WorkspaceConnectionDTO>> {
    const access = await requirePrivilegedMembership(actorId, workspaceId)
    if (!access.ok) {
      auditMutation({
        entity: 'workspace_module_connection',
        action: 'update',
        actorId,
        targetId: `${workspaceId}:${module}`,
        outcome: 'failure',
        reason: access.error.code,
      })
      return access
    }

    const existing =
      await WorkspaceConnectionRepository.findByWorkspaceAndModule(
        workspaceId,
        module,
      )
    if (!existing.ok) return existing

    const encryptedPassword = await encryptConnectionSecret(dto.password)

    const result = await WorkspaceConnectionRepository.upsert({
      workspaceId,
      module,
      host: dto.host,
      port: dto.port,
      username: dto.username,
      encryptedPassword,
      database: dto.database,
      sslEnabled: dto.sslEnabled ?? true,
      createdById: actorId,
    })

    const action = existing.value ? 'update' : 'create'

    if (!result.ok) {
      auditMutation({
        entity: 'workspace_module_connection',
        action,
        actorId,
        targetId: `${workspaceId}:${module}`,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    evictModuleConnection(workspaceId, module)

    auditMutation({
      entity: 'workspace_module_connection',
      action,
      actorId,
      targetId: result.value.id,
      meta: { module },
    })

    return ok(toWorkspaceConnectionDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    module: ModuleKind,
  ): Promise<Result<void>> {
    const access = await requirePrivilegedMembership(actorId, workspaceId)
    if (!access.ok) return access

    const existing =
      await WorkspaceConnectionRepository.findByWorkspaceAndModule(
        workspaceId,
        module,
      )
    if (!existing.ok) return existing
    if (!existing.value) return err(connectionNotFound())

    const result = await WorkspaceConnectionRepository.delete(existing.value.id)
    if (!result.ok) {
      auditMutation({
        entity: 'workspace_module_connection',
        action: 'delete',
        actorId,
        targetId: existing.value.id,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    evictModuleConnection(workspaceId, module)

    auditMutation({
      entity: 'workspace_module_connection',
      action: 'delete',
      actorId,
      targetId: existing.value.id,
      meta: { module },
    })

    return ok(undefined)
  },

  async testConnection(
    actorId: string,
    workspaceId: string,
    dto: TestWorkspaceConnectionDTO,
  ): Promise<Result<void>> {
    const access = await requirePrivilegedMembership(actorId, workspaceId)
    if (!access.ok) return access

    const connectionString = buildModuleConnectionString({
      host: dto.host,
      port: dto.port,
      username: dto.username,
      password: dto.password,
      database: dto.database,
      sslEnabled: dto.sslEnabled ?? true,
    })

    const result = await pingConnectionString(connectionString)

    auditMutation({
      entity: 'workspace_module_connection',
      action: 'test',
      actorId,
      targetId: `${workspaceId}:${dto.module}`,
      outcome: result.ok ? 'success' : 'failure',
      ...(result.ok ? {} : { reason: result.error.code }),
    })

    return result
  },
}
