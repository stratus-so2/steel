import { mergeAttributes, Node } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    columns: {
      insertColumns: (cols: number) => ReturnType
    }
  }
}

/** Nó de vídeo embutido por URL (`<video controls src>`). */
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'video[src]' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        class: 'rt-media',
      }),
    ]
  },
})

/** Coluna individual dentro de um layout de colunas. */
export const Column = Node.create({
  name: 'column',
  content: 'block+',
  isolating: true,
  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'column' }),
      0,
    ]
  },
})

/** Container de layout em colunas (2, 3 ou 4). */
export const Columns = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column+',
  isolating: true,
  addAttributes() {
    return {
      cols: {
        default: 2,
        parseHTML: (el: HTMLElement) =>
          Number.parseInt(el.getAttribute('data-cols') ?? '2', 10),
        renderHTML: (attrs: Record<string, unknown>) => ({
          'data-cols': attrs.cols,
        }),
      },
    }
  },
  parseHTML() {
    return [{ tag: 'div[data-type="columns"]' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-type': 'columns' }),
      0,
    ]
  },
  addCommands() {
    return {
      insertColumns:
        (cols: number) =>
        ({ commands }: { commands: any }) => {
          return commands.insertContent({
            type: 'columns',
            attrs: { cols },
            content: Array.from({ length: cols }, () => ({
              type: 'column',
              content: [{ type: 'paragraph' }],
            })),
          })
        },
    }
  },
})

/** Nó de áudio embutido por URL (`<audio controls src>`). */
export const Audio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null } }
  },
  parseHTML() {
    return [{ tag: 'audio[src]' }]
  },
  renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
    return [
      'audio',
      mergeAttributes(HTMLAttributes, {
        controls: 'true',
        class: 'rt-media',
      }),
    ]
  },
})
