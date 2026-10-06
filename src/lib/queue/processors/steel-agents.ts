import type { Job } from 'bullmq'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { runSteelAgentTick } from '@/src/services/steel-agent-dispatcher'
import { executeSteelAgentRun } from '@/src/services/steel-agent-runner'
import { SteelAgentsJob, type SteelAgentsJobPayload } from '../jobs'

/**
 * Queue `steel-agents`: `tick` (every minute — schedule dispatch + approval
 * expiry) and `run` (execute or resume one run).
 */
export async function processSteelAgents(job: Job): Promise<unknown> {
  switch (job.name) {
    case SteelAgentsJob.Tick: {
      const result = await runSteelAgentTick()
      logger.info(
        'queue.steel_agents.tick_completed',
        logFields({ component: 'Worker' }, { jobId: job.id, ...result }),
      )
      return result
    }
    case SteelAgentsJob.Run: {
      const { runId } = job.data as SteelAgentsJobPayload['run']
      const result = await executeSteelAgentRun(runId)
      if (!result.ok) {
        throw new Error(
          `steel-agents run ${runId} failed: ${result.error.code} ${result.error.message}`,
        )
      }
      logger.info(
        'queue.steel_agents.run_completed',
        logFields(
          { component: 'Worker' },
          { jobId: job.id, runId, outcome: result.value },
        ),
      )
      return result.value
    }
    default:
      throw new Error(
        `Unknown steel-agents job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
