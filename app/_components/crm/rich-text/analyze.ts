import type { Editor } from '@tiptap/core'

/** Velocidade média de leitura adulta (palavras por minuto). */
const WORDS_PER_MINUTE = 200

const MEDIA_NODES = new Set(['image', 'video', 'audio'])

export type DocStats = {
  words: number
  /** Tempo estimado de leitura em minutos (0 quando o doc está vazio). */
  readingMinutes: number
  /** Nº de títulos/seções (nodes `heading`). */
  headings: number
  /** Nº de imagens/vídeos/áudios. */
  media: number
}

/** Métricas estáticas do documento, derivadas do estado do editor. */
export function analyzeDoc(editor: Editor): DocStats {
  const text = editor.getText().trim()
  const words = text ? text.split(/\s+/).length : 0

  let headings = 0
  let media = 0
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'heading') headings += 1
    else if (MEDIA_NODES.has(node.type.name)) media += 1
  })

  return {
    words,
    readingMinutes: words
      ? Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
      : 0,
    headings,
    media,
  }
}
