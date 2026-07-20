import {
  Robot01Icon,
  Tick01Icon,
  Tick02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'
import type { WhatsAppMessageDTO } from '@/types/whatsapp-message'

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function MessageStatusTicks({
  status,
}: {
  status: WhatsAppMessageDTO['status']
}) {
  if (status === 'FAILED') {
    return <span className='text-[10px] text-destructive'>Falhou</span>
  }
  if (status === 'READ') {
    return <SteelIcon icon={Tick02Icon} size={14} className='text-primary' />
  }
  if (status === 'DELIVERED') {
    return (
      <SteelIcon
        icon={Tick02Icon}
        size={14}
        className='text-muted-foreground'
      />
    )
  }
  return (
    <SteelIcon icon={Tick01Icon} size={14} className='text-muted-foreground' />
  )
}

function MessageBubbleMedia({ message }: { message: WhatsAppMessageDTO }) {
  if (!message.mediaUrl) return null

  switch (message.type) {
    case 'IMAGE':
    case 'STICKER':
      return (
        // biome-ignore lint/performance/noImgElement: media served from workspace's own MinIO bucket, not a next/image remote pattern
        <img
          src={message.mediaUrl}
          alt={message.text ?? 'Imagem'}
          className='mb-1 max-w-64 rounded-md'
        />
      )
    case 'VIDEO':
      return (
        // biome-ignore lint/a11y/useMediaCaption: WhatsApp media has no caption tracks
        <video
          src={message.mediaUrl}
          controls
          className='mb-1 max-w-64 rounded-md'
        />
      )
    case 'AUDIO':
      return (
        // biome-ignore lint/a11y/useMediaCaption: WhatsApp media has no caption tracks
        <audio src={message.mediaUrl} controls className='mb-1 max-w-64' />
      )
    case 'DOCUMENT':
      return (
        <a
          href={message.mediaUrl}
          target='_blank'
          rel='noreferrer'
          className='mb-1 block text-sm underline'
        >
          {message.text ?? 'Documento'}
        </a>
      )
    default:
      return null
  }
}

export function MessageBubble({ message }: { message: WhatsAppMessageDTO }) {
  const isOutbound = message.direction === 'OUT'
  const showTextBelowMedia = message.text && message.type !== 'DOCUMENT'

  return (
    <div
      className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[70%] rounded-2xl px-3 py-2 text-sm',
          isOutbound
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm bg-muted text-foreground',
        )}
      >
        {message.sentByAi && (
          <div className='mb-1 flex items-center gap-1 text-[10px] opacity-70'>
            <SteelIcon icon={Robot01Icon} size={12} />
            <span>IA</span>
          </div>
        )}
        <MessageBubbleMedia message={message} />
        {showTextBelowMedia && (
          <p className='whitespace-pre-wrap break-words'>{message.text}</p>
        )}
        <div
          className={cn(
            'mt-1 flex items-center gap-1 text-[10px]',
            isOutbound ? 'justify-end opacity-80' : 'opacity-60',
          )}
        >
          <span>{formatTime(message.createdAt)}</span>
          {isOutbound && <MessageStatusTicks status={message.status} />}
        </div>
      </div>
    </div>
  )
}
