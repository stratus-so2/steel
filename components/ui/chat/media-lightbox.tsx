'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function MediaLightbox({
  media,
  onOpenChange,
}: {
  media: { url: string; type: 'IMAGE' | 'VIDEO'; alt?: string } | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={media !== null} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[90vh] max-w-4xl items-center justify-center border-none bg-transparent p-0 shadow-none'>
        <DialogHeader className='sr-only'>
          <DialogTitle>{media?.alt ?? 'Mídia'}</DialogTitle>
        </DialogHeader>
        {media?.type === 'IMAGE' && (
          // biome-ignore lint/performance/noImgElement: media served from workspace's own MinIO bucket, not a next/image remote pattern
          <img
            src={media.url}
            alt={media.alt ?? 'Imagem'}
            className='max-h-[90vh] max-w-full rounded-md object-contain'
          />
        )}
        {media?.type === 'VIDEO' && (
          // biome-ignore lint/a11y/useMediaCaption: WhatsApp media has no caption tracks
          <video
            src={media.url}
            controls
            autoPlay
            className='max-h-[90vh] max-w-full rounded-md'
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
