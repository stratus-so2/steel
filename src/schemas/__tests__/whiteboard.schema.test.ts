import { describe, expect, it } from 'vitest'
import {
  ArchiveWhiteboardSchema,
  CreateWhiteboardSchema,
  CreateWhiteboardVersionSchema,
  ListWhiteboardsSchema,
  SaveWhiteboardSceneSchema,
  UpdateWhiteboardSchema,
  UpdateWhiteboardSettingsSchema,
  WHITEBOARD_MAX_ELEMENTS,
  WhiteboardFileIdSchema,
  WhiteboardSceneSchema,
} from '../whiteboard.schema'

const rect = { id: 'el-1', type: 'rectangle', x: 0, y: 0, version: 3 }

describe('CreateWhiteboardSchema', () => {
  it('defaults the title to an empty string and trims it', () => {
    expect(CreateWhiteboardSchema.parse({})).toEqual({ title: '' })
    expect(CreateWhiteboardSchema.parse({ title: '  Retro  ' })).toEqual({
      title: 'Retro',
    })
  })

  it('rejects a title over 120 characters', () => {
    expect(
      CreateWhiteboardSchema.safeParse({ title: 'x'.repeat(121) }).success,
    ).toBe(false)
  })
})

describe('UpdateWhiteboardSchema', () => {
  it('requires the title', () => {
    expect(UpdateWhiteboardSchema.safeParse({}).success).toBe(false)
    expect(UpdateWhiteboardSchema.parse({ title: 'Novo' })).toEqual({
      title: 'Novo',
    })
  })
})

describe('WhiteboardSceneSchema', () => {
  it('keeps unknown element fields and drops unknown appState keys', () => {
    const scene = WhiteboardSceneSchema.parse({
      elements: [rect],
      appState: {
        viewBackgroundColor: '#fff',
        zoom: { value: 1.5 },
        scrollX: 10,
        openDialog: 'help',
      },
    })

    expect(scene.elements[0]).toEqual(rect)
    expect(scene.appState).toEqual({
      viewBackgroundColor: '#fff',
      zoom: { value: 1.5 },
      scrollX: 10,
    })
    expect(scene.files).toEqual({})
  })

  it('accepts file refs and strips the data URL', () => {
    const scene = WhiteboardSceneSchema.parse({
      elements: [],
      files: {
        abc123: {
          id: 'abc123',
          mimeType: 'image/png',
          created: 1,
          dataURL: 'data:image/png;base64,AAAA',
        },
      },
    })

    expect(scene.files.abc123).toEqual({
      id: 'abc123',
      mimeType: 'image/png',
      created: 1,
    })
  })

  it('rejects a file that is not an image', () => {
    const result = WhiteboardSceneSchema.safeParse({
      elements: [],
      files: {
        f1: { id: 'f1', mimeType: 'application/pdf', created: 1 },
      },
    })
    expect(result.success).toBe(false)
  })

  it('rejects elements without id or type', () => {
    expect(
      WhiteboardSceneSchema.safeParse({ elements: [{ type: 'rectangle' }] })
        .success,
    ).toBe(false)
    expect(
      WhiteboardSceneSchema.safeParse({ elements: [{ id: 'a' }] }).success,
    ).toBe(false)
  })

  it('rejects more elements than the cap', () => {
    const elements = Array.from(
      { length: WHITEBOARD_MAX_ELEMENTS + 1 },
      (_, i) => ({ id: `e${i}`, type: 'line' }),
    )
    expect(WhiteboardSceneSchema.safeParse({ elements }).success).toBe(false)
  })

  it('rejects a scene over 5 MB', () => {
    const result = WhiteboardSceneSchema.safeParse({
      elements: [{ ...rect, text: 'x'.repeat(5 * 1024 * 1024) }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toContain('5 MB')
  })
})

describe('SaveWhiteboardSceneSchema', () => {
  it('requires a non-negative integer base revision', () => {
    const scene = { elements: [] }
    expect(
      SaveWhiteboardSceneSchema.safeParse({ scene, baseRevision: 2 }).success,
    ).toBe(true)
    expect(
      SaveWhiteboardSceneSchema.safeParse({ scene, baseRevision: -1 }).success,
    ).toBe(false)
    expect(SaveWhiteboardSceneSchema.safeParse({ scene }).success).toBe(false)
  })
})

describe('ListWhiteboardsSchema', () => {
  it('parses the archived flag from the query string', () => {
    expect(ListWhiteboardsSchema.parse({})).toEqual({
      q: '',
      archived: false,
    })
    expect(
      ListWhiteboardsSchema.parse({ q: ' plan ', archived: 'true' }),
    ).toEqual({ q: 'plan', archived: true })
    expect(ListWhiteboardsSchema.safeParse({ archived: 'yes' }).success).toBe(
      false,
    )
  })
})

describe('CreateWhiteboardVersionSchema', () => {
  it('accepts no name, a trimmed name, and rejects a blank one', () => {
    expect(CreateWhiteboardVersionSchema.parse({})).toEqual({})
    expect(CreateWhiteboardVersionSchema.parse({ name: ' v1 ' })).toEqual({
      name: 'v1',
    })
    expect(
      CreateWhiteboardVersionSchema.safeParse({ name: '  ' }).success,
    ).toBe(false)
    expect(
      CreateWhiteboardVersionSchema.safeParse({ name: 'x'.repeat(81) }).success,
    ).toBe(false)
  })
})

describe('small schemas', () => {
  it('validates archive, settings and file ids', () => {
    expect(ArchiveWhiteboardSchema.safeParse({ archived: true }).success).toBe(
      true,
    )
    expect(ArchiveWhiteboardSchema.safeParse({}).success).toBe(false)
    expect(
      UpdateWhiteboardSettingsSchema.safeParse({ enabled: false }).success,
    ).toBe(true)
    expect(WhiteboardFileIdSchema.safeParse('a1_B-2').success).toBe(true)
    expect(WhiteboardFileIdSchema.safeParse('../etc/passwd').success).toBe(
      false,
    )
  })
})
