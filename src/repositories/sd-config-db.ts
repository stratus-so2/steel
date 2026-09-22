import { sdConfigConflict, sdConfigNotFound } from '@/src/errors'
import type { AppError } from '@/src/errors/app-error'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

function prismaCode(error: unknown): unknown {
  return error instanceof Error && 'code' in error ? error.code : undefined
}

/**
 * Executa uma operação Prisma da configuração do ServiceDesk sem lançar:
 * violação de unicidade (P2002) vira `SD_CONFIG_CONFLICT`, registro ausente
 * num update/delete (P2025) vira `SD_CONFIG_NOT_FOUND` e o resto
 * `DATABASE_ERROR` (logado por `dbError`).
 */
export async function sdDb<T>(
  message: string,
  run: () => Promise<T>,
  conflictMessage = 'Já existe um registro com esses dados',
): Promise<Result<T>> {
  try {
    return ok(await run())
  } catch (error) {
    const code = prismaCode(error)
    if (code === 'P2002') return err(sdConfigConflict(conflictMessage))
    if (code === 'P2025') return err(sdConfigNotFound())
    return err(dbError(message, error))
  }
}

/** Como `sdDb`, mas `null` vira `SD_CONFIG_NOT_FOUND` (ou o erro dado). */
export async function sdDbFind<T>(
  message: string,
  run: () => Promise<T | null>,
  notFoundError: AppError = sdConfigNotFound(),
): Promise<Result<T>> {
  const result = await sdDb(message, run)
  if (!result.ok) return result
  if (result.value === null) return err(notFoundError)
  return ok(result.value)
}
