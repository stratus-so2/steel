'use client'

import {
  Attachment01Icon,
  Camera01Icon,
  File02Icon,
  FlashIcon,
  Folder01Icon,
  Mic01Icon,
  SentIcon,
  SmileIcon,
  Video01Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { type ChangeEvent, useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  EmojiPicker,
  EmojiPickerContent,
  EmojiPickerFooter,
  EmojiPickerSearch,
} from '@/components/ui/emoji-picker'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import { useUploadWhatsAppMedia } from '@/src/hooks/use-whatsapp-media-upload'
import {
  useSendWhatsAppMediaMessage,
  useSendWhatsAppTemplateMessage,
  useSendWhatsAppTextMessage,
} from '@/src/hooks/use-whatsapp-messages'
import { useWhatsAppQuickReplies } from '@/src/hooks/use-whatsapp-quick-replies'
import { useWhatsAppTemplates } from '@/src/hooks/use-whatsapp-templates'
import type { WhatsAppMessageTypeDTO } from '@/types/whatsapp-message'

function mediaTypeFromMime(mime: string): WhatsAppMessageTypeDTO {
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  return 'DOCUMENT'
}

function useAudioRecorder(onRecorded: (blob: Blob) => void) {
  const [isRecording, setIsRecording] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        for (const track of stream.getTracks()) track.stop()
        onRecorded(blob)
      }

      recorder.start()
      recorderRef.current = recorder
      setIsRecording(true)
    } catch {
      notify.error('Não foi possível acessar o microfone')
    }
  }

  function stop() {
    recorderRef.current?.stop()
    setIsRecording(false)
  }

  return { isRecording, start, stop }
}

export function WhatsappComposer({
  workspaceId,
  conversationId,
  disabled,
}: {
  workspaceId: string
  conversationId: string
  disabled?: boolean
}) {
  const [text, setText] = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [quickReplyOpen, setQuickReplyOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const quickReplies = useWhatsAppQuickReplies(workspaceId)
  const templates = useWhatsAppTemplates(workspaceId)
  const sendText = useSendWhatsAppTextMessage(workspaceId, conversationId)
  const sendMedia = useSendWhatsAppMediaMessage(workspaceId, conversationId)
  const sendTemplate = useSendWhatsAppTemplateMessage(
    workspaceId,
    conversationId,
  )
  const uploadMedia = useUploadWhatsAppMedia(workspaceId)

  const audioRecorder = useAudioRecorder(async (blob) => {
    try {
      const file = new File(
        [blob],
        `audio.${blob.type.includes('ogg') ? 'ogg' : 'webm'}`,
        {
          type: blob.type,
        },
      )
      const uploaded = await uploadMedia.mutateAsync(file)
      await sendMedia.mutateAsync({ mediaUrl: uploaded.url, type: 'AUDIO' })
    } catch {
      notify.error('Erro ao enviar áudio')
    }
  })

  const isBusy =
    sendText.isPending || sendMedia.isPending || uploadMedia.isPending
  const isDisabled = Boolean(disabled) || isBusy

  async function handleSendText() {
    const trimmed = text.trim()
    if (!trimmed || isDisabled) return
    try {
      await sendText.mutateAsync(trimmed)
      setText('')
    } catch {
      notify.error('Erro ao enviar mensagem')
    }
  }

  async function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    try {
      const uploaded = await uploadMedia.mutateAsync(file)
      await sendMedia.mutateAsync({
        mediaUrl: uploaded.url,
        type: mediaTypeFromMime(file.type),
        fileName: file.name,
      })
    } catch {
      notify.error('Erro ao enviar arquivo')
    }
  }

  return (
    <div className='flex items-end gap-1.5 border-t p-2'>
      <input
        ref={photoInputRef}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={handleFileSelected}
      />
      <input
        ref={videoInputRef}
        type='file'
        accept='video/*'
        className='hidden'
        onChange={handleFileSelected}
      />
      <input
        ref={fileInputRef}
        type='file'
        className='hidden'
        onChange={handleFileSelected}
      />

      <Popover open={quickReplyOpen} onOpenChange={setQuickReplyOpen}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={isDisabled}
              aria-label='Mensagem rápida'
            >
              <SteelIcon icon={FlashIcon} size={18} />
            </Button>
          }
        />
        <PopoverContent align='start' className='w-72 p-1'>
          <div className='max-h-64 overflow-y-auto'>
            {quickReplies.data?.length ? (
              quickReplies.data.map((qr) => (
                <button
                  key={qr.id}
                  type='button'
                  className='flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted'
                  onClick={() => {
                    setText((current) => `${current}${qr.body}`)
                    setQuickReplyOpen(false)
                  }}
                >
                  <span className='font-medium'>/{qr.shortcut}</span>
                  <span className='line-clamp-1 text-muted-foreground text-xs'>
                    {qr.body}
                  </span>
                </button>
              ))
            ) : (
              <p className='p-2 text-muted-foreground text-xs'>
                Nenhuma mensagem rápida cadastrada
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={isDisabled}
              aria-label='Template'
            >
              <SteelIcon icon={File02Icon} size={18} />
            </Button>
          }
        />
        <PopoverContent align='start' className='w-72 p-1'>
          <div className='max-h-64 overflow-y-auto'>
            {templates.data?.length ? (
              templates.data.map((template) => (
                <button
                  key={template.id}
                  type='button'
                  className='flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50'
                  disabled={
                    template.status !== 'APPROVED' || sendTemplate.isPending
                  }
                  onClick={async () => {
                    setTemplateOpen(false)
                    try {
                      await sendTemplate.mutateAsync({
                        templateName: template.name,
                        language: template.language,
                      })
                    } catch {
                      notify.error('Erro ao enviar template')
                    }
                  }}
                >
                  <span className='font-medium'>{template.name}</span>
                  <span className='text-muted-foreground text-xs'>
                    {template.language} · {template.status}
                  </span>
                </button>
              ))
            ) : (
              <p className='p-2 text-muted-foreground text-xs'>
                Nenhum template sincronizado
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
        <PopoverTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={isDisabled}
              aria-label='Emoji'
            >
              <SteelIcon icon={SmileIcon} size={18} />
            </Button>
          }
        />
        <PopoverContent className='h-80 w-72 p-0'>
          <EmojiPicker
            className='h-full'
            onEmojiSelect={({ emoji }) => {
              setText((current) => `${current}${emoji}`)
            }}
          >
            <EmojiPickerSearch />
            <EmojiPickerContent />
            <EmojiPickerFooter />
          </EmojiPicker>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              disabled={isDisabled}
              aria-label='Anexo'
            >
              <SteelIcon icon={Attachment01Icon} size={18} />
            </Button>
          }
        />
        <DropdownMenuContent align='start'>
          <DropdownMenuItem onClick={() => photoInputRef.current?.click()}>
            <SteelIcon icon={Camera01Icon} size={16} />
            Foto
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
            <SteelIcon icon={Video01Icon} size={16} />
            Vídeo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
            <SteelIcon icon={Folder01Icon} size={16} />
            Arquivo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type='button'
        variant={audioRecorder.isRecording ? 'destructive' : 'ghost'}
        size='icon-sm'
        disabled={isDisabled}
        aria-label={
          audioRecorder.isRecording ? 'Parar gravação' : 'Gravar áudio'
        }
        onClick={() =>
          audioRecorder.isRecording
            ? audioRecorder.stop()
            : audioRecorder.start()
        }
      >
        <SteelIcon icon={Mic01Icon} size={18} />
      </Button>

      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault()
            handleSendText()
          }
        }}
        placeholder='Digite uma mensagem'
        disabled={isDisabled}
        className='max-h-32 min-h-9 flex-1 resize-none'
        rows={1}
      />

      <Button
        type='button'
        size='icon-sm'
        disabled={isDisabled || !text.trim()}
        aria-label='Enviar'
        onClick={handleSendText}
      >
        <SteelIcon icon={SentIcon} size={16} />
      </Button>
    </div>
  )
}
