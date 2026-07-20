import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'

export function quotedMessageLabel(message: WhatsAppMessageDTO): string {
  switch (message.type) {
    case 'IMAGE':
      return message.text || 'Imagem'
    case 'AUDIO':
      return 'Áudio'
    case 'VIDEO':
      return message.text || 'Vídeo'
    case 'DOCUMENT':
      return message.text || 'Documento'
    case 'STICKER':
      return 'Figurinha'
    default:
      return message.text ?? ''
  }
}

export function QuotedMessageThumbnail({
  message,
}: {
  message: WhatsAppMessageDTO
}) {
  if (!message.mediaUrl) return null

  if (message.type === 'IMAGE' || message.type === 'STICKER') {
    return (
      // biome-ignore lint/performance/noImgElement: small quoted-reply thumbnail, not a next/image candidate
      <img
        src={message.mediaUrl}
        alt=''
        className='h-9 w-9 shrink-0 rounded object-cover'
      />
    )
  }

  if (message.type === 'VIDEO') {
    return (
      // biome-ignore lint/a11y/useMediaCaption: thumbnail preview only, no controls
      <video
        src={message.mediaUrl}
        className='h-9 w-9 shrink-0 rounded object-cover'
      />
    )
  }

  return null
}
