import { prisma } from '@/src/lib/prisma'
import { CrmPipelineSeedService } from '@/src/services/crm-pipeline-seed.service'

/**
 * Cria o pipeline padrão ("Vendas" + 6 etapas) pros workspaces que já tinham
 * o módulo CRM habilitado antes do seed automático existir. Idempotente —
 * seguro rodar mais de uma vez.
 *
 *   pnpm seed:crm-pipeline
 */
async function main() {
  const grants = await prisma.workspaceModuleAccess.findMany({
    where: { module: 'CRM', enabled: true },
    select: { workspaceId: true, grantedById: true },
  })

  console.log(`${grants.length} workspace(s) com o CRM habilitado.`)

  let ok = 0
  let failed = 0

  for (const grant of grants) {
    const result = await CrmPipelineSeedService.seedDefaultPipeline(
      grant.workspaceId,
      grant.grantedById,
    )
    if (!result.ok) {
      failed += 1
      console.error(`✗ ${grant.workspaceId}: ${result.error.code}`)
      continue
    }
    ok += 1
    console.log(`✓ ${grant.workspaceId}`)
  }

  console.log(`Concluído: ${ok} ok, ${failed} falha(s).`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
