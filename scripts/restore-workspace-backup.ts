import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { fetchAndDecryptBackup } from '@/src/lib/queue/database-restore'

type CreateManyDelegate = {
  createMany: (args: { data: unknown[] }) => Promise<unknown>
}

/**
 * Restaura um backup WORKSPACE: apaga o estado atual do workspace (cascata)
 * e recria a partir do snapshot, numa única transação.
 *
 *   pnpm restore:workspace <backupId>
 */
async function main() {
  const backupId = process.argv[2]
  if (!backupId) {
    console.error('Uso: pnpm restore:workspace <backupId>')
    process.exitCode = 1
    return
  }

  const startedAt = Date.now()
  const { buffer, backup } = await fetchAndDecryptBackup(backupId)
  if (backup.scope !== 'WORKSPACE' || !backup.workspaceId) {
    throw new Error(
      `Backup "${backupId}" não é WORKSPACE (scope: ${backup.scope}).`,
    )
  }

  const payload = JSON.parse(buffer.toString('utf-8')) as {
    workspaceId: string
    data: { workspace: Prisma.WorkspaceCreateInput; [key: string]: unknown }
  }

  const { workspace, ...tables } = payload.data

  await prisma.$transaction(
    async (tx) => {
      await tx.workspace.deleteMany({ where: { id: payload.workspaceId } })
      await tx.workspace.create({ data: workspace })

      const remaining = new Map(
        Object.entries(tables).filter(
          ([, rows]) => Array.isArray(rows) && rows.length > 0,
        ),
      )

      let madeProgress = true
      while (remaining.size > 0 && madeProgress) {
        madeProgress = false
        for (const [delegateName, rows] of [...remaining]) {
          const delegate = (
            tx as unknown as Record<string, CreateManyDelegate>
          )[delegateName]
          if (!delegate?.createMany) {
            remaining.delete(delegateName)
            continue
          }
          // Um createMany fora de ordem (FK ainda não existente) aborta a
          // transação inteira no Postgres até um rollback — savepoint por
          // tentativa isola a falha pra não derrubar as tabelas seguintes.
          await tx.$executeRawUnsafe('SAVEPOINT restore_step')
          try {
            await delegate.createMany({ data: rows as unknown[] })
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT restore_step')
            remaining.delete(delegateName)
            madeProgress = true
          } catch {
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT restore_step')
          }
        }
      }

      if (remaining.size > 0) {
        throw new Error(
          `Não foi possível restaurar: ${[...remaining.keys()].join(', ')}`,
        )
      }
    },
    { timeout: 60_000 },
  )

  const elapsedMs = Date.now() - startedAt
  console.log(
    `Workspace "${payload.workspaceId}" restaurado em ${elapsedMs}ms.`,
  )
}

function redact(message: string): string {
  return message.replace(/:\/\/([^:/@\s]+):([^@/\s]+)@/g, '://$1:****@')
}

main()
  .catch((error) => {
    const message =
      error instanceof Error ? (error.stack ?? error.message) : String(error)
    console.error(redact(message))
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
