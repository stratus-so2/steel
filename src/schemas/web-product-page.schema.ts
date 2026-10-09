import type { IconSvgElement } from '@hugeicons/react'
import z from 'zod'

/**
 * Content contract of the public product (`/product/*`) and capability
 * (`/features/*`) pages. Every page is plain data validated by this schema and
 * rendered by the same section components, so the eleven pages stay
 * consistent and a page can't ship with an empty block.
 *
 * Two templates, both modeled on the structure of a classic SaaS feature page:
 * - `object`: the page orbits one record (a ticket, a lead, an article…) —
 *   hero, "inside the record" trio, AI bento, details grid, connected modules.
 * - `rhythm`: the page tells a flow over time (SLA clock, a workflow run, a
 *   conversation…) — the same blocks plus two alternating split rows.
 */

const text = z.string().trim().min(1)

export const PRODUCT_TONES = [
  'neutral',
  'brand',
  'success',
  'warning',
  'danger',
  'info',
] as const
export type ProductTone = (typeof PRODUCT_TONES)[number]
const tone = z.enum(PRODUCT_TONES)

const iconSchema = z.custom<IconSvgElement>(
  (value) => Array.isArray(value) && value.length > 0,
  { message: 'Ícone inválido' },
)

const internalHref = z
  .string()
  .regex(/^\/[a-z0-9\-/]*$/, 'Use um caminho interno, como /product/crm')

const chip = z.object({ label: text, tone })

// ---- Visuals: abstract UI compositions drawn with Steel's own tokens ----

const fieldsVisual = z.object({
  kind: z.literal('fields'),
  code: text.optional(),
  title: text,
  chips: z.array(chip).optional(),
  rows: z
    .array(z.object({ label: text, value: text, tone: tone.optional() }))
    .min(2),
})

const timelineVisual = z.object({
  kind: z.literal('timeline'),
  items: z.array(z.object({ actor: text, action: text, time: text })).min(2),
})

const chartVisual = z.object({
  kind: z.literal('chart'),
  title: text,
  variant: z.enum(['area', 'bars']),
  points: z.array(z.number().min(0).max(100)).min(4),
  caption: text.optional(),
})

const listVisual = z.object({
  kind: z.literal('list'),
  title: text,
  items: z.array(z.object({ label: text, meta: text.optional(), tone })).min(2),
})

const kanbanVisual = z.object({
  kind: z.literal('kanban'),
  columns: z
    .array(
      z.object({
        title: text,
        tone,
        cards: z.array(z.object({ title: text, meta: text.optional() })).min(1),
      }),
    )
    .min(2),
})

const chatVisual = z.object({
  kind: z.literal('chat'),
  messages: z
    .array(
      z.object({
        from: z.enum(['user', 'contact', 'agent', 'ai']),
        text,
      }),
    )
    .min(1),
  action: z.object({ title: text, preview: text, confirm: text }).optional(),
})

const metersVisual = z.object({
  kind: z.literal('meters'),
  title: text,
  items: z
    .array(
      z.object({
        label: text,
        value: z.number().min(0).max(100),
        tone,
        meta: text.optional(),
      }),
    )
    .min(1),
})

const togglesVisual = z.object({
  kind: z.literal('toggles'),
  title: text,
  items: z.array(z.object({ label: text, on: z.boolean() })).min(2),
})

const flowVisual = z.object({
  kind: z.literal('flow'),
  steps: z
    .array(z.object({ label: text, detail: text.optional(), tone }))
    .min(2),
})

const tableVisual = z
  .object({
    kind: z.literal('table'),
    columns: z.array(text).min(2),
    rows: z.array(z.array(text)).min(2),
  })
  .refine((t) => t.rows.every((row) => row.length === t.columns.length), {
    message: 'Cada linha precisa ter uma célula por coluna',
    path: ['rows'],
  })

const statsVisual = z.object({
  kind: z.literal('stats'),
  items: z
    .array(z.object({ label: text, value: text, delta: text.optional(), tone }))
    .min(2),
})

const articleVisual = z.object({
  kind: z.literal('article'),
  title: text,
  tag: text.optional(),
  lines: z.array(text).min(1),
  checklist: z.array(z.object({ label: text, done: z.boolean() })).optional(),
})

const formVisual = z.object({
  kind: z.literal('form'),
  title: text,
  fields: z.array(z.object({ label: text, value: text })).min(1),
  button: text,
})

/** A visual that fits in a card. */
export const ProductVisualSchema = z.discriminatedUnion('kind', [
  fieldsVisual,
  timelineVisual,
  chartVisual,
  listVisual,
  kanbanVisual,
  chatVisual,
  metersVisual,
  togglesVisual,
  flowVisual,
  tableVisual,
  statsVisual,
  articleVisual,
  formVisual,
])
export type ProductVisual = z.infer<typeof ProductVisualSchema>
export type ProductVisualKind = ProductVisual['kind']

/** The hero's app window: a sidebar of real Steel screens around a visual. */
export const ProductWindowSchema = z.object({
  title: text,
  nav: z.array(text).min(3),
  active: z.number().int().min(0),
  body: ProductVisualSchema,
  aside: ProductVisualSchema.optional(),
})
export type ProductWindow = z.infer<typeof ProductWindowSchema>

// ---- Sections ----

const card = z.object({
  title: text,
  description: text,
  visual: ProductVisualSchema,
})

const heading = {
  eyebrow: text,
  title: text,
}

export const ProductPageSchema = z
  .object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    kind: z.enum(['product', 'feature']),
    template: z.enum(['object', 'rhythm']),
    /** Name in the header menu, the breadcrumb and the JSON-LD. */
    label: text,
    meta: z.object({
      title: text.max(70),
      description: text.min(50).max(170),
    }),
    hero: z.object({
      ...heading,
      subtitle: text,
      window: ProductWindowSchema,
    }),
    highlights: z.object({
      ...heading,
      subtitle: text,
      items: z.array(card).length(3),
    }),
    rows: z
      .array(
        z.object({
          ...heading,
          description: text,
          bullets: z.array(z.object({ icon: iconSchema, text })).length(3),
          visual: ProductVisualSchema,
        }),
      )
      .length(2)
      .optional(),
    ai: z.object({
      ...heading,
      items: z.array(card).length(5),
    }),
    details: z.object({
      ...heading,
      subtitle: text,
      items: z
        .array(z.object({ title: text, description: text, icon: iconSchema }))
        .length(6),
    }),
    connected: z.object({
      ...heading,
      subtitle: text,
      items: z
        .array(
          z.object({
            title: text,
            description: text,
            href: internalHref,
            visual: ProductVisualSchema,
          }),
        )
        .min(3)
        .max(4),
    }),
    cta: z.object({ title: text, subtitle: text }),
  })
  .superRefine((page, ctx) => {
    if (page.template === 'rhythm' && !page.rows) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'O modelo "rhythm" exige as duas linhas alternadas',
      })
    }
    if (page.template === 'object' && page.rows) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'O modelo "object" não usa linhas alternadas',
      })
    }
    if (page.hero.window.active >= page.hero.window.nav.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['hero', 'window', 'active'],
        message: 'Item ativo fora do menu',
      })
    }
  })

export type ProductPage = z.infer<typeof ProductPageSchema>
export type ProductPageInput = z.input<typeof ProductPageSchema>

/** Canonical path of a page: `/product/<slug>` or `/features/<slug>`. */
export function productPagePath(page: Pick<ProductPage, 'kind' | 'slug'>) {
  return page.kind === 'product'
    ? `/product/${page.slug}`
    : `/features/${page.slug}`
}
