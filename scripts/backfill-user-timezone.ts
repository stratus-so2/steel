import { UserPreferenceCache } from '@/src/cache/user-preference.cache'
import { prisma } from '@/src/lib/prisma'

/**
 * Atualiza o fuso horário dos usuários que nunca mudaram a preferência
 * (ainda no default antigo "UTC") para "America/Sao_Paulo". Usuários que
 * escolheram explicitamente um fuso diferente de "UTC" não são tocados.
 * Idempotente — seguro rodar mais de uma vez.
 *
 *   pnpm seed:user-timezone
 */
const NEW_DEFAULT_TIMEZONE = 'America/Sao_Paulo'

async function main() {
  const affected = await prisma.userPreference.findMany({
    where: { timezone: 'UTC' },
    select: { userId: true },
  })

  console.log(`${affected.length} usuário(s) ainda em "UTC".`)

  if (affected.length === 0) {
    return
  }

  const { count } = await prisma.userPreference.updateMany({
    where: { timezone: 'UTC' },
    data: { timezone: NEW_DEFAULT_TIMEZONE },
  })

  for (const { userId } of affected) {
    await UserPreferenceCache.invalidate(userId)
  }

  console.log(`Atualizados: ${count}. Cache invalidado para cada usuário.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
