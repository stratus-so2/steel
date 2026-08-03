import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { sendChangelogEmail } from '@/src/lib/mail/admin/send-changelog'
import { ChangelogRepository } from '@/src/repositories/changelog.repository'
import { ChangelogJob, type ChangelogJobPayload } from '../jobs'

async function processSendChangelogEmail(
  job: Job<ChangelogJobPayload['send-changelog-email']>,
): Promise<void> {
  const { changelogId, recipientId } = job.data

  const recipientResult =
    await ChangelogRepository.findRecipientById(recipientId)
  if (!recipientResult.ok || !recipientResult.value) {
    logger.warn('queue.changelog.recipient_missing', {
      component: 'Changelog',
      jobId: job.id,
      recipientId,
    })
    return
  }
  const recipient = recipientResult.value

  if (recipient.status !== 'PENDING') return

  try {
    await sendChangelogEmail({
      email: recipient.email,
      subject: recipient.changelog.subject,
      items: recipient.changelog.items.map((item) => ({
        title: item.title,
        body: item.body,
        imageUrl: item.imageUrl,
      })),
    })

    await ChangelogRepository.updateRecipientStatus(recipientId, {
      status: 'SENT',
      sentAt: new Date(),
    })
  } catch (error) {
    await ChangelogRepository.updateRecipientStatus(recipientId, {
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : String(error),
    })
  }

  const pending = await ChangelogRepository.countPendingRecipients(changelogId)
  if (pending.ok && pending.value === 0) {
    await ChangelogRepository.updateStatus(changelogId, 'DONE')
  }

  logger.info('queue.changelog.processed', {
    component: 'Changelog',
    jobId: job.id,
    recipientId,
  })
}

export async function processChangelog(job: Job): Promise<void> {
  switch (job.name) {
    case ChangelogJob.SendChangelogEmail:
      return processSendChangelogEmail(
        job as Job<ChangelogJobPayload['send-changelog-email']>,
      )
    default:
      throw new Error(
        `Unknown changelog job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
