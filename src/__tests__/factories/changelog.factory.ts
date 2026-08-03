import { createId } from '@paralleldrive/cuid2'
import type {
  Changelog,
  ChangelogItem,
  ChangelogRecipient,
} from '@prisma/client'
import type {
  ChangelogWithCounts,
  ChangelogWithDetails,
} from '@/src/repositories/changelog.repository'

export function createFakeChangelog(overrides?: Partial<Changelog>): Changelog {
  const now = new Date()
  return {
    id: createId(),
    subject: 'Novidades do Steel',
    status: 'DRAFT',
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeChangelogItem(
  overrides?: Partial<ChangelogItem>,
): ChangelogItem {
  return {
    id: createId(),
    changelogId: createId(),
    title: 'Painéis do WhatsApp',
    body: 'Agora você já cria dashboards padrão automaticamente.',
    imageUrl: null,
    position: 0,
    ...overrides,
  }
}

export function createFakeChangelogRecipient(
  overrides?: Partial<ChangelogRecipient>,
): ChangelogRecipient {
  return {
    id: createId(),
    changelogId: createId(),
    email: 'usuario@example.com',
    userId: null,
    status: 'PENDING',
    errorMessage: null,
    sentAt: null,
    createdAt: new Date(),
    ...overrides,
  }
}

export function createFakeChangelogWithCounts(
  overrides?: Partial<Changelog>,
  recipients: { status: ChangelogRecipient['status'] }[] = [],
): ChangelogWithCounts {
  return { ...createFakeChangelog(overrides), recipients }
}

export function createFakeChangelogWithDetails(
  overrides?: Partial<Changelog>,
  items: ChangelogItem[] = [],
  recipients: ChangelogRecipient[] = [],
): ChangelogWithDetails {
  return { ...createFakeChangelog(overrides), items, recipients }
}
