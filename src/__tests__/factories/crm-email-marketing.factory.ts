import { createId } from '@paralleldrive/cuid2'
import type {
  CrmEmailCampaign,
  CrmEmailCampaignRecipient,
  CrmEmailTemplate,
  CrmMailingList,
  CrmMailingListMember,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmEmailTemplate(
  overrides?: Partial<CrmEmailTemplate>,
): CrmEmailTemplate {
  const now = new Date()
  return {
    id: createId(),
    name: 'Boas-vindas',
    subject: 'Bem-vindo!',
    contentHtml: '<p>Oi</p>',
    contentJson: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmEmailTemplate(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Pick<CrmEmailTemplate, 'name' | 'subject' | 'deletedAt'>>,
) {
  return prisma.crmEmailTemplate.create({
    data: {
      name: 'Seed Template',
      subject: 'Assunto',
      contentHtml: '<p>Oi</p>',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmEmailCampaign(
  overrides?: Partial<CrmEmailCampaign>,
): CrmEmailCampaign {
  const now = new Date()
  return {
    id: createId(),
    subject: 'Promo',
    contentHtml: '<p>Oi</p>',
    contentJson: null,
    fromAddress: 'crm@stratustelecom.com.br',
    status: 'DRAFT',
    recipientScope: 'ALL',
    scheduledAt: null,
    sentAt: null,
    workspaceId: createId(),
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmEmailCampaign(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmEmailCampaign, 'subject' | 'status' | 'recipientScope'>
  >,
) {
  return prisma.crmEmailCampaign.create({
    data: {
      subject: 'Seed Campaign',
      contentHtml: '<p>Oi</p>',
      fromAddress: 'crm@stratustelecom.com.br',
      recipientScope: 'ALL',
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmEmailCampaignRecipient(
  overrides?: Partial<CrmEmailCampaignRecipient>,
): CrmEmailCampaignRecipient {
  const now = new Date()
  return {
    id: createId(),
    campaignId: createId(),
    personId: null,
    email: 'jane@acme.com',
    name: 'Jane',
    status: 'PENDING',
    providerMessageId: null,
    errorMessage: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmEmailCampaignRecipient(
  campaignId: string,
  overrides?: Partial<
    Pick<CrmEmailCampaignRecipient, 'email' | 'status' | 'personId'>
  >,
) {
  return prisma.crmEmailCampaignRecipient.create({
    data: { campaignId, email: 'seed@acme.com', ...overrides },
  })
}

export function createFakeCrmMailingList(
  overrides?: Partial<CrmMailingList>,
): CrmMailingList {
  const now = new Date()
  return {
    id: createId(),
    name: 'Newsletter',
    description: null,
    workspaceId: createId(),
    createdById: createId(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmMailingList(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Pick<CrmMailingList, 'name' | 'deletedAt'>>,
) {
  return prisma.crmMailingList.create({
    data: { name: 'Seed List', workspaceId, createdById, ...overrides },
  })
}

export function createFakeCrmMailingListMember(
  overrides?: Partial<CrmMailingListMember>,
): CrmMailingListMember {
  return {
    id: createId(),
    mailingListId: createId(),
    email: 'jane@acme.com',
    name: 'Jane',
    personId: null,
    createdAt: new Date(),
    ...overrides,
  }
}

export async function seedCrmMailingListMember(
  mailingListId: string,
  overrides?: Partial<Pick<CrmMailingListMember, 'email' | 'name'>>,
) {
  return prisma.crmMailingListMember.create({
    data: { mailingListId, email: 'seed@acme.com', ...overrides },
  })
}
