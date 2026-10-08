import { z } from 'zod'

/** Palette keys — the UI maps each one to its own swatch classes. */
export const WIKI_LABEL_COLORS = [
  'gray',
  'red',
  'orange',
  'amber',
  'green',
  'teal',
  'blue',
  'violet',
  'pink',
] as const

export type WikiLabelColor = (typeof WIKI_LABEL_COLORS)[number]

const wikiLabelName = z
  .string()
  .trim()
  .min(1, 'Informe o nome da etiqueta')
  .max(40, 'Nome deve ter no máximo 40 caracteres')

export const CreateWikiLabelSchema = z.object({
  name: wikiLabelName,
  color: z.enum(WIKI_LABEL_COLORS).default('gray'),
})

export type CreateWikiLabelDTO = z.infer<typeof CreateWikiLabelSchema>

export const UpdateWikiLabelSchema = z
  .object({
    name: wikiLabelName.optional(),
    color: z.enum(WIKI_LABEL_COLORS).optional(),
  })
  .refine((value) => value.name !== undefined || value.color !== undefined, {
    message: 'Nada para atualizar',
  })

export type UpdateWikiLabelDTO = z.infer<typeof UpdateWikiLabelSchema>

export const SetWikiPageLabelsSchema = z.object({
  labelIds: z.array(z.cuid2()).max(20, 'No máximo 20 etiquetas por página'),
})

export type SetWikiPageLabelsDTO = z.infer<typeof SetWikiPageLabelsSchema>

export const UpdateWikiSettingsSchema = z.object({
  enabled: z.boolean(),
})

export type UpdateWikiSettingsDTO = z.infer<typeof UpdateWikiSettingsSchema>
