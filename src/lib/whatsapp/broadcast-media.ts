/**
 * Regras de mídia das transmissões do WhatsApp — módulo puro (sem
 * `server-only`), usado na validação da API, no envio e na UI.
 *
 * Tipos e limites são a interseção do que a Meta Cloud API e a Z-API
 * aceitam; o teto geral é o do upload de mídia do Steel (16 MB).
 */

export type BroadcastMediaKind = 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT'

const MB = 1024 * 1024

export const BROADCAST_MEDIA_MAX_BYTES: Record<BroadcastMediaKind, number> = {
  IMAGE: 5 * MB,
  VIDEO: 16 * MB,
  AUDIO: 16 * MB,
  DOCUMENT: 16 * MB,
}

const MIME_KIND: Record<string, BroadcastMediaKind> = {
  'image/jpeg': 'IMAGE',
  'image/png': 'IMAGE',
  'video/mp4': 'VIDEO',
  'video/3gpp': 'VIDEO',
  'audio/aac': 'AUDIO',
  'audio/mp4': 'AUDIO',
  'audio/mpeg': 'AUDIO',
  'audio/amr': 'AUDIO',
  'audio/ogg': 'AUDIO',
  'application/pdf': 'DOCUMENT',
  'application/msword': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'DOCUMENT',
  'application/vnd.ms-excel': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
    'DOCUMENT',
  'application/vnd.ms-powerpoint': 'DOCUMENT',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'DOCUMENT',
  'text/plain': 'DOCUMENT',
}

const EXTENSION_KIND: Record<string, BroadcastMediaKind> = {
  jpg: 'IMAGE',
  jpeg: 'IMAGE',
  png: 'IMAGE',
  mp4: 'VIDEO',
  '3gp': 'VIDEO',
  aac: 'AUDIO',
  m4a: 'AUDIO',
  mp3: 'AUDIO',
  amr: 'AUDIO',
  ogg: 'AUDIO',
  pdf: 'DOCUMENT',
  doc: 'DOCUMENT',
  docx: 'DOCUMENT',
  xls: 'DOCUMENT',
  xlsx: 'DOCUMENT',
  ppt: 'DOCUMENT',
  pptx: 'DOCUMENT',
  txt: 'DOCUMENT',
}

/** Valor do `accept` do seletor de arquivo. */
export const BROADCAST_MEDIA_ACCEPT = Object.keys(MIME_KIND).join(',')

export const BROADCAST_MEDIA_KIND_LABEL: Record<BroadcastMediaKind, string> = {
  IMAGE: 'Imagem',
  VIDEO: 'Vídeo',
  AUDIO: 'Áudio',
  DOCUMENT: 'Documento',
}

function normalizeMime(mimeType: string): string {
  return mimeType.split(';')[0].trim().toLowerCase()
}

/** Extensão (sem ponto, minúscula) de um nome de arquivo ou URL. */
export function fileExtension(nameOrUrl: string): string | null {
  const path = nameOrUrl.split(/[?#]/)[0]
  const last = path.split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  if (dot <= 0 || dot === last.length - 1) return null
  return last.slice(dot + 1).toLowerCase()
}

export function mediaKindFromMime(mimeType: string): BroadcastMediaKind | null {
  return MIME_KIND[normalizeMime(mimeType)] ?? null
}

/**
 * Tipo de mídia de uma transmissão: pelo mime salvo e, na falta dele
 * (listas antigas), pela extensão do nome do arquivo ou da URL.
 */
export function resolveBroadcastMediaKind(input: {
  mimeType?: string | null
  fileName?: string | null
  url?: string | null
}): BroadcastMediaKind | null {
  if (input.mimeType) {
    const byMime = mediaKindFromMime(input.mimeType)
    if (byMime) return byMime
  }
  for (const source of [input.fileName, input.url]) {
    const ext = source ? fileExtension(source) : null
    if (ext && EXTENSION_KIND[ext]) return EXTENSION_KIND[ext]
  }
  return null
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`
}

/**
 * Valida tipo e tamanho da mídia de uma transmissão. Devolve a mensagem de
 * erro em pt-BR, ou null quando está tudo certo.
 */
export function validateBroadcastMedia(input: {
  mimeType: string
  sizeBytes?: number | null
}): string | null {
  const kind = mediaKindFromMime(input.mimeType)
  if (!kind) {
    return 'Tipo de arquivo não suportado em transmissões. Use imagem (JPG ou PNG), vídeo (MP4 ou 3GP), áudio (AAC, M4A, MP3, AMR ou OGG) ou documento (PDF, Word, Excel, PowerPoint ou TXT).'
  }
  const max = BROADCAST_MEDIA_MAX_BYTES[kind]
  if (input.sizeBytes != null && input.sizeBytes > max) {
    return `${BROADCAST_MEDIA_KIND_LABEL[kind]} muito grande para transmissão. Máximo de ${formatMb(max)}.`
  }
  if (input.sizeBytes != null && input.sizeBytes <= 0) {
    return 'Arquivo vazio'
  }
  return null
}
