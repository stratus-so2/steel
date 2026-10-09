import { createId } from '@paralleldrive/cuid2'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { Whiteboard } from '@/src/repositories/whiteboard.repository'
import type { WhiteboardVersion } from '@/src/repositories/whiteboard-version.repository'
import type { WhiteboardScene } from '@/src/schemas/whiteboard.schema'
import type {
  WhiteboardDTO,
  WhiteboardSummaryDTO,
  WhiteboardVersionSummaryDTO,
} from '@/types/whiteboard'

export function fakeWhiteboardScene(
  overrides?: Partial<WhiteboardScene>,
): WhiteboardScene {
  return {
    elements: [
      { id: 'el-1', type: 'rectangle', x: 0, y: 0, width: 100, height: 50 },
      {
        id: 'el-2',
        type: 'text',
        x: 10,
        y: 10,
        text: 'Ideia',
        isDeleted: false,
      },
    ],
    appState: { viewBackgroundColor: '#ffffff' },
    files: {},
    ...overrides,
  }
}

export function createFakeWhiteboard(
  overrides?: Partial<Whiteboard>,
): Whiteboard {
  const now = new Date('2026-10-09T12:00:00.000Z')
  return {
    id: createId(),
    workspaceId: createId(),
    title: 'Quadro de teste',
    scene: fakeWhiteboardScene() as unknown as Prisma.JsonValue,
    revision: 0,
    versionedRevision: 0,
    lastVersionAt: null,
    thumbnailAt: null,
    lockedById: null,
    lockedUntil: null,
    createdById: 'user-1',
    updatedById: 'user-1',
    archivedAt: null,
    editedAt: now,
    createdAt: now,
    updatedAt: now,
    createdBy: { id: 'user-1', name: 'Ana' },
    updatedBy: { id: 'user-1', name: 'Ana' },
    lockedBy: null,
    ...overrides,
  }
}

export function createFakeWhiteboardVersion(
  overrides?: Partial<WhiteboardVersion>,
): WhiteboardVersion {
  return {
    id: createId(),
    whiteboardId: createId(),
    kind: 'AUTO',
    name: null,
    scene: fakeWhiteboardScene() as unknown as Prisma.JsonValue,
    revision: 1,
    elementCount: 2,
    restoredFromId: null,
    createdById: 'user-1',
    createdAt: new Date('2026-10-09T12:00:00.000Z'),
    createdBy: { id: 'user-1', name: 'Ana' },
    ...overrides,
  }
}

export function createFakeWhiteboardSummaryDTO(
  overrides?: Partial<WhiteboardSummaryDTO>,
): WhiteboardSummaryDTO {
  return {
    id: createId(),
    workspaceId: 'ws-1',
    title: 'Quadro de teste',
    revision: 0,
    thumbnailUrl: null,
    createdBy: { id: 'user-1', name: 'Ana' },
    updatedBy: { id: 'user-1', name: 'Ana' },
    archivedAt: null,
    editedAt: '2026-10-09T12:00:00.000Z',
    createdAt: '2026-10-09T12:00:00.000Z',
    ...overrides,
  }
}

export function createFakeWhiteboardDTO(
  overrides?: Partial<WhiteboardDTO>,
): WhiteboardDTO {
  return {
    ...createFakeWhiteboardSummaryDTO(),
    scene: { elements: [], appState: {}, files: {} },
    lock: null,
    ...overrides,
  }
}

export function createFakeWhiteboardVersionSummaryDTO(
  overrides?: Partial<WhiteboardVersionSummaryDTO>,
): WhiteboardVersionSummaryDTO {
  return {
    id: createId(),
    whiteboardId: 'board-1',
    kind: 'AUTO',
    name: null,
    revision: 1,
    elementCount: 2,
    restoredFromId: null,
    createdBy: { id: 'user-1', name: 'Ana' },
    createdAt: '2026-10-09T12:00:00.000Z',
    ...overrides,
  }
}

export async function seedWhiteboard(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Prisma.WhiteboardUncheckedCreateInput>,
) {
  return prisma.whiteboard.create({
    data: {
      workspaceId,
      createdById,
      updatedById: createdById,
      title: 'Quadro de teste',
      scene: fakeWhiteboardScene() as unknown as Prisma.InputJsonValue,
      ...overrides,
    },
  })
}

export async function seedWhiteboardVersion(
  whiteboardId: string,
  createdById: string,
  overrides?: Partial<Prisma.WhiteboardVersionUncheckedCreateInput>,
) {
  return prisma.whiteboardVersion.create({
    data: {
      whiteboardId,
      createdById,
      kind: 'AUTO',
      scene: fakeWhiteboardScene() as unknown as Prisma.InputJsonValue,
      revision: 1,
      elementCount: 2,
      ...overrides,
    },
  })
}

/** Turns the whiteboard off for the workspace of a fixture (it starts on). */
export async function withoutWhiteboard<
  T extends { workspace: { id: string } },
>(fixture: Promise<T>): Promise<T> {
  const value = await fixture
  await prisma.workspace.update({
    where: { id: value.workspace.id },
    data: { whiteboardEnabled: false },
  })
  return value
}
