import { createId } from '@paralleldrive/cuid2'
import type {
  CrmLandingPage,
  CrmLandingPageSection,
  CrmLandingPageSectionType,
  CrmLandingPageView,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmLandingPageSectionContent } from '@/src/schemas/crm-landing-page-section.schema'

export function fakeHeroContent(
  overrides?: Partial<Extract<CrmLandingPageSectionContent, { type: 'HERO' }>>,
): CrmLandingPageSectionContent {
  return {
    type: 'HERO',
    title: 'Título de destaque',
    ...overrides,
  }
}

export function createFakeCrmLandingPage(
  overrides?: Partial<CrmLandingPage>,
): CrmLandingPage {
  const now = new Date()
  return {
    id: createId(),
    title: 'Home',
    templateKey: 'agency',
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

export function createFakeCrmLandingPageSection(
  overrides?: Partial<CrmLandingPageSection>,
): CrmLandingPageSection {
  const now = new Date()
  return {
    id: createId(),
    landingPageId: createId(),
    type: 'HERO' as CrmLandingPageSectionType,
    order: 0,
    enabled: true,
    content: fakeHeroContent() as unknown as Prisma.JsonValue,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmLandingPage(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<
      CrmLandingPage,
      | 'title'
      | 'templateKey'
      | 'status'
      | 'publishedAt'
      | 'position'
      | 'deletedAt'
    >
  >,
) {
  return prisma.crmLandingPage.create({
    data: {
      title: 'Seed Page',
      templateKey: 'agency',
      shareToken: createId(),
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export async function seedCrmLandingPageSection(
  landingPageId: string,
  overrides?: Partial<
    Pick<CrmLandingPageSection, 'type' | 'order' | 'enabled'> & {
      content: Prisma.InputJsonValue
    }
  >,
) {
  const { content, ...rest } = overrides ?? {}
  return prisma.crmLandingPageSection.create({
    data: {
      landingPageId,
      type: 'HERO',
      content: (content ?? fakeHeroContent()) as Prisma.InputJsonValue,
      ...rest,
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
