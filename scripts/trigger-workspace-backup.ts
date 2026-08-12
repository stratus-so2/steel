import { prisma } from '@/src/lib/prisma'
import { triggerWorkspaceBackup } from '@/src/lib/queue/database-backup'
import { closeQueues } from '@/src/lib/queue/queues'

/**
 * Enfileira um backup sob demanda de um workspace (por id ou slug). O worker
 * processa o job de forma assíncrona — acompanhe pela tabela `backups`.
 *
 *   pnpm backup:workspace <workspaceIdOuSlug>
 */
async function main() {
  const identifier = process.argv[2]
  if (!identifier) {
    console.error('Uso: pnpm backup:workspace <workspaceIdOuSlug>')
    process.exitCode = 1
    return
  }

  const workspace = await prisma.workspace.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
    select: { id: true, name: true, slug: true },
  })

  if (!workspace) {
    console.error(`Workspace "${identifier}" não encontrado.`)
    process.exitCode = 1
    return
  }

  await triggerWorkspaceBackup(workspace.id)

  console.log(
    `Backup enfileirado para "${workspace.name}" (${workspace.slug}). ` +
      'Acompanhe o progresso na tabela `backups` ou nos logs do worker.',
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
    await closeQueues()
  })
