import { createId } from '@paralleldrive/cuid2'
import type {
  CrmLandingPage,
  CrmLandingPageMessage,
  CrmLandingPageView,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmLandingPage(
  overrides?: Partial<CrmLandingPage>,
): CrmLandingPage {
  const now = new Date()
  return {
    id: createId(),
    title: 'Home',
    html: '',
    status: 'DRAFT',
    shareToken: createId(),
    publishedAt: null,
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    position: 0,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmLandingPage(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmLandingPage,
      'title' | 'html' | 'status' | 'publishedAt' | 'position' | 'deletedAt'
    >
  >,
) {
  return prisma.crmLandingPage.create({
    data: {
      title: 'Seed Page',
      shareToken: createId(),
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export async function seedCrmLandingPageView(
  landingPageId: string,
  overrides?: Partial<
    Pick<CrmLandingPageView, 'viewId' | 'durationMs' | 'ctaClicks'>
  >,
) {
  return prisma.crmLandingPageView.create({
    data: {
      landingPageId,
      viewId: createId(),
      ipHash: 'hash',
      ...overrides,
    },
  })
}

export function createFakeCrmLandingPageMessage(
  overrides?: Partial<CrmLandingPageMessage>,
): CrmLandingPageMessage {
  return {
    id: createId(),
    landingPageId: createId(),
    role: 'USER',
    content: 'Crie uma landing page para o meu SaaS',
    createdAt: new Date(),
    ...overrides,
  }
}

export async function seedCrmLandingPageMessage(
  landingPageId: string,
  overrides?: Partial<Pick<CrmLandingPageMessage, 'role' | 'content'>>,
) {
  return prisma.crmLandingPageMessage.create({
    data: {
      landingPageId,
      role: 'USER',
      content: 'Crie uma landing page para o meu SaaS',
      ...overrides,
    },
  })
}
