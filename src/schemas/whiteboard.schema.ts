import { z } from 'zod'

/**
 * Quadro-branco (Excalidraw). Contract:
 * - every member of the workspace sees every board (like the Wiki); VIEWER is
 *   read-only; a MEMBER archives the boards it created, OWNER/ADMIN any;
 * - the scene carries elements, an appState subset (background, grid and the
 *   viewport, so switching boards returns to the same spot) and file refs —
 *   image bytes go to the `whiteboards` bucket, never base64 into the row;
 * - saves are optimistic (`baseRevision`) and gated by an edit lease: one
 *   editor at a time, the others open read-only.
 */

/** Hard cap on the serialized scene (elements + appState + file refs). */
export const WHITEBOARD_SCENE_MAX_BYTES = 5 * 1024 * 1024
export const WHITEBOARD_MAX_ELEMENTS = 20_000
export const WHITEBOARD_TITLE_MAX = 120

/** Image types the canvas accepts for paste/upload. */
export const WHITEBOARD_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const
export const WHITEBOARD_IMAGE_MAX_BYTES = 10 * 1024 * 1024
export const WHITEBOARD_THUMBNAIL_MAX_BYTES = 512 * 1024

/** Excalidraw file ids are content hashes; keep them key-safe. */
export const WhiteboardFileIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,128}$/, 'Identificador de arquivo inválido')

const whiteboardTitle = z
  .string()
  .trim()
  .max(
    WHITEBOARD_TITLE_MAX,
    `Título deve ter no máximo ${WHITEBOARD_TITLE_MAX} caracteres`,
  )

const WhiteboardElementSchema = z.looseObject({
  id: z.string().min(1).max(128),
  type: z.string().min(1).max(40),
})

/** The appState keys worth keeping per board; everything else is dropped. */
export const WhiteboardAppStateSchema = z.object({
  viewBackgroundColor: z.string().max(64).optional(),
  gridSize: z.number().int().min(1).max(200).nullable().optional(),
  gridModeEnabled: z.boolean().optional(),
  scrollX: z.number().finite().optional(),
  scrollY: z.number().finite().optional(),
  zoom: z.object({ value: z.number().positive().max(100) }).optional(),
})

export const WhiteboardFileRefSchema = z.object({
  id: WhiteboardFileIdSchema,
  mimeType: z.enum(WHITEBOARD_IMAGE_TYPES),
  created: z.number().int().nonnegative(),
})

export const WhiteboardSceneSchema = z
  .object({
    elements: z
      .array(WhiteboardElementSchema)
      .max(
        WHITEBOARD_MAX_ELEMENTS,
        `O quadro passa de ${WHITEBOARD_MAX_ELEMENTS} elementos`,
      ),
    appState: WhiteboardAppStateSchema.default({}),
    files: z
      .record(WhiteboardFileIdSchema, WhiteboardFileRefSchema)
      .default({}),
  })
  .refine(
    (scene) => JSON.stringify(scene).length <= WHITEBOARD_SCENE_MAX_BYTES,
    'O quadro excede o tamanho permitido (5 MB)',
  )

export type WhiteboardScene = z.infer<typeof WhiteboardSceneSchema>

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = {
  elements: [],
  appState: {},
  files: {},
}

export const CreateWhiteboardSchema = z.object({
  title: whiteboardTitle.default(''),
})

export type CreateWhiteboardDTO = z.infer<typeof CreateWhiteboardSchema>

export const UpdateWhiteboardSchema = z.object({
  title: whiteboardTitle,
})

export type UpdateWhiteboardDTO = z.infer<typeof UpdateWhiteboardSchema>

export const SaveWhiteboardSceneSchema = z.object({
  scene: WhiteboardSceneSchema,
  /** Revision the client loaded; a stale one answers 409. */
  baseRevision: z.number().int().nonnegative(),
})

export type SaveWhiteboardSceneDTO = z.infer<typeof SaveWhiteboardSceneSchema>

export const ListWhiteboardsSchema = z.object({
  q: z.string().trim().max(100).optional().default(''),
  archived: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
})

export type ListWhiteboardsDTO = z.infer<typeof ListWhiteboardsSchema>

export const ArchiveWhiteboardSchema = z.object({
  archived: z.boolean(),
})

export type ArchiveWhiteboardDTO = z.infer<typeof ArchiveWhiteboardSchema>

export const CreateWhiteboardVersionSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Dê um nome à versão')
    .max(80, 'Nome deve ter no máximo 80 caracteres')
    .optional(),
})

export type CreateWhiteboardVersionDTO = z.infer<
  typeof CreateWhiteboardVersionSchema
>

export const UpdateWhiteboardSettingsSchema = z.object({
  enabled: z.boolean(),
})

export type UpdateWhiteboardSettingsDTO = z.infer<
  typeof UpdateWhiteboardSettingsSchema
>
