import type { WhatsAppMessageTypeDTO } from '@/types/whatsapp-message'

/**
 * Quick replies in the composer: typing `/` + a shortcut opens the picker and
 * an exact `/shortcut` expands to the reply. Shortcuts are compared in a
 * canonical form — no leading `/`, lower case, no accents — because agents
 * register them however they like (`/saudação`, `Saudacao`) and type them
 * however the keyboard lets them (`/saudacao`).
 */
export function normalizeQuickReplyShortcut(value: string): string {
  return value
    .trim()
    .replace(/^\/+/, '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

/** `/abc` typed as the whole message → the normalized query (`abc`). */
export function quickReplyQueryOf(text: string): string | null {
  const match = /^\/(\S*)$/.exec(text)
  return match ? normalizeQuickReplyShortcut(match[1]) : null
}

interface QuickReplyLike {
  shortcut: string
  title: string
}

/**
 * Picker entries for a query: the exact shortcut first, then shortcuts that
 * start with it, then titles that contain it — so `/saudacao` + Enter always
 * picks `saudacao` even when `saudacao-tarde` exists too.
 */
export function matchQuickReplies<T extends QuickReplyLike>(
  items: readonly T[],
  query: string,
  limit = 8,
): T[] {
  const ranked: Array<{ item: T; rank: number }> = []
  for (const item of items) {
    const shortcut = normalizeQuickReplyShortcut(item.shortcut)
    const title = normalizeQuickReplyShortcut(item.title)
    let rank = -1
    if (shortcut === query) rank = 0
    else if (shortcut.startsWith(query)) rank = 1
    else if (query && title.includes(query)) rank = 2
    if (rank >= 0) ranked.push({ item, rank })
  }
  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((entry) => entry.item)
}

/** The reply whose shortcut is exactly the typed `/text`, if any. */
export function findExactQuickReply<T extends QuickReplyLike>(
  items: readonly T[],
  text: string,
): T | null {
  const query = quickReplyQueryOf(text.trim())
  if (!query) return null
  return (
    items.find(
      (item) => normalizeQuickReplyShortcut(item.shortcut) === query,
    ) ?? null
  )
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp|heic)$/i
const VIDEO_EXT = /\.(mp4|mov|webm|3gp|mkv)$/i
const AUDIO_EXT = /\.(mp3|ogg|opus|m4a|aac|wav|amr)$/i

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url.split(/[?#]/)[0]
  }
}

/** The WhatsApp media type to send a quick reply's attachment as. */
export function mediaTypeFromUrl(url: string): WhatsAppMessageTypeDTO {
  const path = pathnameOf(url)
  if (IMAGE_EXT.test(path)) return 'IMAGE'
  if (VIDEO_EXT.test(path)) return 'VIDEO'
  if (AUDIO_EXT.test(path)) return 'AUDIO'
  return 'DOCUMENT'
}

/** A readable file name for a quick reply's attachment. */
export function fileNameFromUrl(url: string): string {
  const last = pathnameOf(url).split('/').filter(Boolean).pop()
  if (!last) return 'anexo'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}
