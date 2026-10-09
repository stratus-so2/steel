import { describe, expect, it } from 'vitest'
import {
  createFakeWhiteboard,
  createFakeWhiteboardVersion,
  fakeWhiteboardScene,
} from '@/src/__tests__/factories/whiteboard.factory'
import {
  countLiveElements,
  toWhiteboardDTO,
  toWhiteboardLockDTO,
  toWhiteboardScene,
  toWhiteboardSummaryDTO,
  toWhiteboardVersionDTO,
  toWhiteboardVersionSummaryDTO,
  whiteboardSceneText,
  whiteboardThumbnailUrl,
} from '../whiteboard.mapper'

const now = new Date('2026-10-09T12:00:00.000Z')

describe('whiteboard mapper', () => {
  it('maps a board summary with ISO dates and no thumbnail', () => {
    const board = createFakeWhiteboard({ id: 'b1', workspaceId: 'ws1' })

    const dto = toWhiteboardSummaryDTO(board)

    expect(dto).toEqual({
      id: 'b1',
      workspaceId: 'ws1',
      title: 'Quadro de teste',
      revision: 0,
      thumbnailUrl: null,
      createdBy: { id: 'user-1', name: 'Ana' },
      updatedBy: { id: 'user-1', name: 'Ana' },
      archivedAt: null,
      editedAt: now.toISOString(),
      createdAt: now.toISOString(),
    })
    expect(dto).not.toHaveProperty('scene')
  })

  it('builds a cache-busted same-origin thumbnail URL and archive date', () => {
    const board = createFakeWhiteboard({
      id: 'b1',
      workspaceId: 'ws1',
      thumbnailAt: now,
      archivedAt: now,
    })

    expect(whiteboardThumbnailUrl(board)).toBe(
      `/api/workspaces/ws1/whiteboards/b1/thumbnail?v=${now.getTime()}`,
    )
    expect(toWhiteboardSummaryDTO(board).archivedAt).toBe(now.toISOString())
  })

  it('maps the full board with scene and live lock', () => {
    const until = new Date(now.getTime() + 30_000)
    const board = createFakeWhiteboard({
      lockedBy: { id: 'u2', name: 'Bruno' },
      lockedById: 'u2',
      lockedUntil: until,
    })

    const dto = toWhiteboardDTO(board, now)

    expect(dto.scene).toEqual(fakeWhiteboardScene())
    expect(dto.lock).toEqual({
      holder: { id: 'u2', name: 'Bruno' },
      until: until.toISOString(),
    })
  })

  it('treats an expired or missing lease as no lock', () => {
    expect(
      toWhiteboardLockDTO(
        { lockedBy: { id: 'u', name: 'U' }, lockedUntil: now },
        now,
      ),
    ).toBeNull()
    expect(toWhiteboardLockDTO({ lockedBy: null, lockedUntil: now }, now)).toBe(
      null,
    )
    expect(
      toWhiteboardLockDTO(
        { lockedBy: { id: 'u', name: 'U' }, lockedUntil: null },
        now,
      ),
    ).toBeNull()
    expect(toWhiteboardDTO(createFakeWhiteboard()).lock).toBeNull()
  })

  it('normalizes partial or empty stored scenes', () => {
    expect(toWhiteboardScene(null)).toEqual({
      elements: [],
      appState: {},
      files: {},
    })
    expect(toWhiteboardScene({ elements: 'bad' })).toEqual({
      elements: [],
      appState: {},
      files: {},
    })
  })

  it('maps versions with and without the scene', () => {
    const version = createFakeWhiteboardVersion({
      id: 'v1',
      whiteboardId: 'b1',
      kind: 'RESTORE',
      name: 'Entrega',
      restoredFromId: 'v0',
    })

    const summary = toWhiteboardVersionSummaryDTO(version)
    expect(summary).toEqual({
      id: 'v1',
      whiteboardId: 'b1',
      kind: 'RESTORE',
      name: 'Entrega',
      revision: 1,
      elementCount: 2,
      restoredFromId: 'v0',
      createdBy: { id: 'user-1', name: 'Ana' },
      createdAt: now.toISOString(),
    })
    expect(toWhiteboardVersionDTO(version).scene).toEqual(fakeWhiteboardScene())
  })

  it('counts live elements and extracts live text', () => {
    const scene = fakeWhiteboardScene({
      elements: [
        { id: 'a', type: 'text', text: 'Olá' },
        { id: 'b', type: 'text', text: 'apagado', isDeleted: true },
        { id: 'c', type: 'rectangle' },
        { id: 'd', type: 'text', text: 'mundo' },
        { id: 'e', type: 'text' },
      ],
    })

    expect(countLiveElements(scene)).toBe(4)
    expect(whiteboardSceneText(scene)).toBe('Olá mundo')
  })
})
