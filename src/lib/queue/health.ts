import { Queue } from 'bullmq'
import type { QueueHealthDTO } from '@/types/admin-workspace'
import { scrubMessage } from '../analytics/scrub'
import { getQueueConnection } from './connection'
import { QueueName } from './jobs'

const CACHE_TTL_MS = 15_000
const TIMEOUT_MS = 2_500

const readers = new Map<string, Queue>()
let cached: { at: number; value: QueueHealthDTO[] } | null = null

function readerFor(name: string): Queue {
  let queue = readers.get(name)
  if (!queue) {
    // Só leitura de contadores: nunca adiciona jobs por aqui.
    queue = new Queue(name, { connection: getQueueConnection() })
    readers.set(name, queue)
  }
  return queue
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Redis das filas não respondeu em ${ms}ms`)),
      ms,
    )
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

/**
 * Contadores BullMQ de todas as filas (waiting/active/delayed/failed/
 * completed), para a visão geral do admin. Cache em memória de 15 s e
 * timeout: a conexão das filas não desiste sozinha (`maxRetriesPerRequest:
 * null`), então sem timeout um Redis fora travaria a página.
 */
export async function getQueueHealth(
  now: number = Date.now(),
): Promise<QueueHealthDTO[]> {
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.value

  const names = Object.values(QueueName)
  const value = await withTimeout(
    Promise.all(
      names.map(async (name) => {
        const counts = await readerFor(name).getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        )
        return {
          name,
          waiting: counts.waiting ?? 0,
          active: counts.active ?? 0,
          delayed: counts.delayed ?? 0,
          failed: counts.failed ?? 0,
          completed: counts.completed ?? 0,
        }
      }),
    ),
    TIMEOUT_MS,
  )

  cached = { at: now, value }
  return value
}

/** Testes: zera o cache. */
export function resetQueueHealthCache(): void {
  cached = null
}

export interface JobFailureInfo {
  queue: string
  jobId: string | null
  jobName: string
  /** Motivo limpo (sem e-mail/IP/documentos) e truncado. */
  reason: string | null
  attempts: number
  failedAt: string | null
}

/**
 * Falhas mais recentes de todas as filas (as `perQueue` últimas de cada
 * uma), da mais nova para a mais antiga — aba Jobs do painel Analytics. Só
 * leitura; mesmo timeout dos contadores.
 */
export async function getRecentJobFailures(
  perQueue = 5,
  limit = 30,
): Promise<JobFailureInfo[]> {
  const names = Object.values(QueueName)
  const perName = await withTimeout(
    Promise.all(
      names.map(async (name) => {
        const jobs = await readerFor(name).getFailed(0, perQueue - 1)
        return jobs.filter(Boolean).map(
          (job): JobFailureInfo => ({
            queue: name,
            jobId: job.id ?? null,
            jobName: job.name,
            reason: scrubMessage(job.failedReason),
            attempts: job.attemptsMade ?? 0,
            failedAt: job.finishedOn
              ? new Date(job.finishedOn).toISOString()
              : null,
          }),
        )
      }),
    ),
    TIMEOUT_MS,
  )
  return perName
    .flat()
    .sort((a, b) => (b.failedAt ?? '').localeCompare(a.failedAt ?? ''))
    .slice(0, limit)
}
