'use client'

import { JitsiMeeting } from '@jitsi/react-sdk'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function WhatsappVideoCallDialog({
  open,
  onOpenChange,
  roomName,
  displayName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roomName: string
  displayName: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex h-[80vh] max-w-3xl flex-col p-0'>
        <DialogHeader className='sr-only'>
          <DialogTitle>Chamada de vídeo</DialogTitle>
        </DialogHeader>
        {open && (
          <JitsiMeeting
            domain='meet.jit.si'
            roomName={roomName}
            userInfo={{ displayName, email: '' }}
            configOverwrite={{
              startWithAudioMuted: false,
              disableModeratorIndicator: true,
              prejoinPageEnabled: false,
            }}
            interfaceConfigOverwrite={{
              DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            }}
            getIFrameRef={(parentNode) => {
              parentNode.style.height = '100%'
              parentNode.style.width = '100%'
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
