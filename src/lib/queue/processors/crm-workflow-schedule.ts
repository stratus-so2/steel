import type { Job } from 'bullmq'
import { Cron } from 'croner'
import { logger } from '@/lib/axiom/logger'
import {
  parseCrmWorkflowDefinition,
  triggerTypeToPrisma,
} from '@/src/mappers/crm-workflow.mapper'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
} from '@/src/repositories/crm-workflow.repository'
import { runCrmWorkflow } from '@/src/services/crm-workflow-runner'
import { CrmWorkflowScheduleJob } from '../jobs'

type TickResult = {
  considered: number
  dispatched: number
  errors: number
}

/**
 * Tick do scheduler — 1x por minuto (ver `CrmWorkflowScheduleCron`). Itera
 * todos os workflows ACTIVE, filtra os que têm trigger `on-a-schedule`, e
 * dispara aqueles cuja "última hora prevista de execução" (`previousRun`) é
 * posterior ao `lastRunAt` registrado — idempotente mesmo se o tick rodar
 * duas vezes no mesmo minuto.
 *
 * Tolerância: ignora `previousRun` mais antigo que 5 minutos — caso o worker
 * fique parado, não disparamos um backlog acumulado.
 */
const TOLERANCE_MS = 5 * 60 * 1000

async function runTick(now = new Date()): Promise<TickResult> {
  let considered = 0
  let dispatched = 0
  let errors = 0

  const workflows = await CrmWorkflowRepository.findAllActive()
  if (!workflows.ok) return { considered: 0, dispatched: 0, errors: 1 }

  for (const wf of workflows.value) {
    if (!wf.activeVersion) continue
    const definition = parseCrmWorkflowDefinition(wf.activeVersion.definition)
    const trigger = definition.trigger.data
    if (!trigger || trigger.type !== 'on-a-schedule') continue
    considered++

    try {
      const cron = new Cron(trigger.cron, { timezone: trigger.timezone })
      const [prev] = cron.previousRuns(1, now)
      if (!prev) continue
      if (now.getTime() - prev.getTime() > TOLERANCE_MS) continue
      if (wf.lastRunAt && prev <= wf.lastRunAt) continue

      const payload = { scheduledFor: prev.toISOString() }
      const run = await CrmWorkflowRunRepository.create({
        workflowId: wf.id,
        versionId: wf.activeVersion.id,
        triggerType: triggerTypeToPrisma('on-a-schedule'),
        triggerPayload: payload,
        startedById: null,
      })
      if (!run.ok) {
        errors++
        continue
      }

      // Marca antes de rodar pra evitar disparo duplo se o tick concorrer.
      await CrmWorkflowRepository.update(wf.id, {
        updatedById: wf.createdById,
        lastRunAt: prev,
      })

      // Fire-and-forget — erros do runner ficam no próprio CrmWorkflowRun.
      void runCrmWorkflow({
        runId: run.value.id,
        workspaceId: wf.workspaceId,
        actingUserId: wf.createdById,
        definition,
        triggerType: 'on-a-schedule',
        triggerPayload: payload,
        testMode: false,
      }).catch(() => {
        /* persistido no run */
      })
      dispatched++
    } catch {
      errors++
    }
  }
  return { considered, dispatched, errors }
}

export async function processCrmWorkflowSchedule(
  job: Job,
): Promise<TickResult> {
  switch (job.name) {
    case CrmWorkflowScheduleJob.RunTick: {
      const result = await runTick()
      logger.info('queue.crm_workflow_schedule.tick_completed', {
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
        `Unknown crm-workflow-schedule job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
