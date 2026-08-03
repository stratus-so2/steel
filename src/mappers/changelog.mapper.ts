import type { User } from '@prisma/client'
import type {
  ChangelogWithCounts,
  ChangelogWithDetails,
} from '@/src/repositories/changelog.repository'
import type {
  ChangelogDetailDTO,
  ChangelogItemDTO,
  ChangelogRecipientDTO,
  ChangelogSummaryDTO,
  ChangelogUserSearchResultDTO,
} from '@/types/changelog'

export function toChangelogSummaryDTO(
  changelog: ChangelogWithCounts,
): ChangelogSummaryDTO {
  return {
    id: changelog.id,
    subject: changelog.subject,
    status: changelog.status,
    createdById: changelog.createdById,
    recipientCount: changelog.recipients.length,
    sentCount: changelog.recipients.filter((r) => r.status === 'SENT').length,
    failedCount: changelog.recipients.filter((r) => r.status === 'FAILED')
      .length,
    createdAt: changelog.createdAt.toISOString(),
    updatedAt: changelog.updatedAt.toISOString(),
  }
}

export function toChangelogDetailDTO(
  changelog: ChangelogWithDetails,
): ChangelogDetailDTO {
  const items: ChangelogItemDTO[] = changelog.items.map((item) => ({
    id: item.id,
    title: item.title,
    body: item.body,
    imageUrl: item.imageUrl,
    position: item.position,
  }))

  const recipients: ChangelogRecipientDTO[] = changelog.recipients.map(
    (recipient) => ({
      id: recipient.id,
      email: recipient.email,
      userId: recipient.userId,
      status: recipient.status,
      errorMessage: recipient.errorMessage,
      sentAt: recipient.sentAt ? recipient.sentAt.toISOString() : null,
    }),
  )

  return {
    id: changelog.id,
    subject: changelog.subject,
    status: changelog.status,
    createdById: changelog.createdById,
    recipientCount: changelog.recipients.length,
    sentCount: changelog.recipients.filter((r) => r.status === 'SENT').length,
    failedCount: changelog.recipients.filter((r) => r.status === 'FAILED')
      .length,
    createdAt: changelog.createdAt.toISOString(),
    updatedAt: changelog.updatedAt.toISOString(),
    items,
    recipients,
  }
}

export function toChangelogUserSearchResultDTO(
  user: User,
): ChangelogUserSearchResultDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
  }
}
