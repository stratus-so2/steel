import type { WikiLabelColor } from '@/src/schemas/wiki-label.schema'

/** Swatch (dot) and chip classes per label color, light and dark. */
export const WIKI_LABEL_TONE: Record<
  WikiLabelColor,
  { label: string; dot: string; chip: string }
> = {
  gray: {
    label: 'Cinza',
    dot: 'bg-zinc-400',
    chip: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200',
  },
  red: {
    label: 'Vermelho',
    dot: 'bg-red-500',
    chip: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200',
  },
  orange: {
    label: 'Laranja',
    dot: 'bg-orange-500',
    chip: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200',
  },
  amber: {
    label: 'Âmbar',
    dot: 'bg-amber-500',
    chip: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  },
  green: {
    label: 'Verde',
    dot: 'bg-green-500',
    chip: 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-200',
  },
  teal: {
    label: 'Turquesa',
    dot: 'bg-teal-500',
    chip: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-200',
  },
  blue: {
    label: 'Azul',
    dot: 'bg-blue-500',
    chip: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200',
  },
  violet: {
    label: 'Violeta',
    dot: 'bg-violet-500',
    chip: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200',
  },
  pink: {
    label: 'Rosa',
    dot: 'bg-pink-500',
    chip: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-200',
  },
}
