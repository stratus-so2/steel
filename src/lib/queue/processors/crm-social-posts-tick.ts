import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { CrmScheduledPostRepository } from '@/src/repositories/crm-social.repository'
import { publishScheduledPost } from '@/src/services/crm-social-scheduler'
import { CrmSocialPostsTickJob } from '../jobs'

type TickResult = {
  considered: number
  dispatched: number
  errors: number
}

/**
 * Tick do agendador de posts sociais — busca posts SCHEDULED já vencidos,
 * "reivindica" cada um de forma atômica (SCHEDULED→PUBLISHING) e publica. O
 * claim garante idempotência: se dois ticks rodarem juntos, só um publica
 * cada post. Não lança — cada falha de post fica registrada no próprio
 * post/alvo.
 */
async function runTick(): Promise<TickResult> {
  let considered = 0
  let dispatched = 0
  let errors = 0

  const due = await CrmScheduledPostRepository.findDue(new Date())
  if (!due.ok) {
    throw new Error(`Failed to list due CRM scheduled posts: ${due.error.code}`)
  }

  for (const post of due.value) {
    considered++

    const claimed = await CrmScheduledPostRepository.claim(post.id)
    if (!claimed.ok) {
      errors++
      continue
    }
    if (!claimed.value) continue

    try {
      await publishScheduledPost({ ...post, status: 'PUBLISHING' })
      dispatched++
    } catch (error) {
      errors++
      logger.error('queue.crm_social_posts_tick.publish_failed', {
        component: 'Worker',
        postId: post.id,
        message: error instanceof Error ? error.message : String(error),
      })
      await CrmScheduledPostRepository.setStatus(post.id, 'FAILED', {
        lastError: 'Erro inesperado ao publicar',
      })
    }
  }

  return { considered, dispatched, errors }
}

export async function processCrmSocialPostsTick(job: Job): Promise<TickResult> {
  switch (job.name) {
    case CrmSocialPostsTickJob.RunTick: {
      const result = await runTick()
      logger.info('queue.crm_social_posts_tick.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        considered: result.considered,
        dispatched: result.dispatched,
        errors: result.errors,
      })
      return result
    }
    default:
      throw new Error(
        `Unknown crm-social-posts-tick job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
