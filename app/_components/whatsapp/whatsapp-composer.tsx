'use client'

import {
  Attachment01Icon,
  Camera01Icon,
  Cancel01Icon,
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
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from '@/components/ui/attachment'
import { Button } from '@/components/ui/button'
import {
  QuotedMessageThumbnail,
  quotedMessageLabel,
} from '@/components/ui/chat/quoted-message-preview'
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
import { useUser } from '@/src/hooks/use-user'
import { useUploadWhatsAppMedia } from '@/src/hooks/use-whatsapp-media-upload'
import {
  useSendWhatsAppMediaMessage,
  useSendWhatsAppTemplateMessage,
  useSendWhatsAppTextMessage,
} from '@/src/hooks/use-whatsapp-messages'
import { useWhatsAppQuickReplies } from '@/src/hooks/use-whatsapp-quick-replies'
import { useWhatsAppTemplates } from '@/src/hooks/use-whatsapp-templates'
import {
  extractTemplateFillableFields,
  hasFillableFields,
  parseMetaTemplateComponents,
  renderQuickReplyBody,
} from '@/src/lib/whatsapp/template-variables'
import type {
  WhatsAppMessageDTO,
  WhatsAppMessageTypeDTO,
} from '@/types/whatsapp-message'
import type { WhatsAppTemplateDTO } from '@/types/whatsapp-template'
import { TemplateVariablesDialog } from './template-variables-dialog'

function mediaTypeFromMime(mime: string): WhatsAppMessageTypeDTO {
  if (mime.startsWith('image/')) return 'IMAGE'
  if (mime.startsWith('video/')) return 'VIDEO'
  if (mime.startsWith('audio/')) return 'AUDIO'
  return 'DOCUMENT'
}

interface StagedAttachment {
  id: string
  file: File
  type: WhatsAppMessageTypeDTO
  previewUrl?: string
  status: 'uploading' | 'done' | 'error'
  uploadedUrl?: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
  contactName,
  disabled,
  replyTarget,
  onClearReply,
}: {
  workspaceId: string
  conversationId: string
  contactName?: string | null
  disabled?: boolean
  replyTarget?: WhatsAppMessageDTO | null
  onClearReply?: () => void
}) {
  const [text, setText] = useState('')
  const [attachments, setAttachments] = useState<StagedAttachment[]>([])
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [quickReplyOpen, setQuickReplyOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [pendingTemplate, setPendingTemplate] =
    useState<WhatsAppTemplateDTO | null>(null)
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const currentUser = useUser()
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

  const isUploading = attachments.some((a) => a.status === 'uploading')
  const isBusy =
    sendText.isPending || sendMedia.isPending || uploadMedia.isPending
  const isDisabled = Boolean(disabled) || isBusy || isUploading
  const hasAttachments = attachments.length > 0

  function removeAttachment(id: string) {
    setAttachments((current) => {
      const target = current.find((a) => a.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return current.filter((a) => a.id !== id)
    })
  }

  async function handleSend() {
    const trimmed = text.trim()
    if (isDisabled) return

    if (hasAttachments) {
      const readyAttachments = attachments.filter((a) => a.status === 'done')
      if (readyAttachments.length === 0) return
      try {
        for (const [index, attachment] of readyAttachments.entries()) {
          if (!attachment.uploadedUrl) continue
          await sendMedia.mutateAsync({
            mediaUrl: attachment.uploadedUrl,
            type: attachment.type,
            fileName: attachment.file.name,
            caption: index === 0 ? trimmed || undefined : undefined,
            replyToMessageId: index === 0 ? replyTarget?.id : undefined,
          })
        }
        for (const attachment of readyAttachments) {
          if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        }
        setAttachments((current) => current.filter((a) => a.status !== 'done'))
        setText('')
        onClearReply?.()
      } catch {
        notify.error('Erro ao enviar arquivo')
      }
      return
    }

    if (!trimmed) return
    try {
      await sendText.mutateAsync({
        text: trimmed,
        replyToMessageId: replyTarget?.id,
      })
      setText('')
      onClearReply?.()
    } catch {
      notify.error('Erro ao enviar mensagem')
    }
  }

  function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    const id = crypto.randomUUID()
    const type = mediaTypeFromMime(file.type)
    const previewUrl =
      type === 'IMAGE' || type === 'VIDEO'
        ? URL.createObjectURL(file)
        : undefined

    setAttachments((current) => [
      ...current,
      { id, file, type, previewUrl, status: 'uploading' },
    ])

    uploadMedia.mutate(file, {
      onSuccess: (uploaded) => {
        setAttachments((current) =>
          current.map((a) =>
            a.id === id
              ? { ...a, status: 'done', uploadedUrl: uploaded.url }
              : a,
          ),
        )
      },
      onError: () => {
        notify.error('Erro ao enviar arquivo')
        setAttachments((current) =>
          current.map((a) => (a.id === id ? { ...a, status: 'error' } : a)),
        )
      },
    })
  }

  return (
    <div className='border-t p-2'>
      {replyTarget && (
        <div className='mb-2 flex items-center justify-between gap-2 rounded-md border-primary border-l-2 bg-muted/50 px-2.5 py-1.5'>
          <div className='flex min-w-0 items-center gap-2'>
            <QuotedMessageThumbnail message={replyTarget} />
            <div className='min-w-0'>
              <p className='font-medium text-primary text-xs'>Respondendo</p>
              <p className='truncate text-muted-foreground text-xs'>
                {quotedMessageLabel(replyTarget)}
              </p>
            </div>
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon-sm'
            aria-label='Cancelar resposta'
            onClick={onClearReply}
          >
            <SteelIcon icon={Cancel01Icon} size={14} />
          </Button>
        </div>
      )}
      {hasAttachments && (
        <AttachmentGroup className='mb-2 px-0.5'>
          {attachments.map((attachment) => (
            <Attachment key={attachment.id} size='sm' state={attachment.status}>
              <AttachmentMedia
                variant={attachment.previewUrl ? 'image' : 'icon'}
              >
                {attachment.previewUrl && attachment.type === 'IMAGE' ? (
                  <img src={attachment.previewUrl} alt={attachment.file.name} />
                ) : (
                  <SteelIcon icon={File02Icon} size={16} />
                )}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{attachment.file.name}</AttachmentTitle>
                <AttachmentDescription>
                  {attachment.status === 'uploading'
                    ? 'Enviando…'
                    : attachment.status === 'error'
                      ? 'Falha no envio'
                      : formatFileSize(attachment.file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              <AttachmentActions>
                <AttachmentAction
                  aria-label='Remover anexo'
                  onClick={() => removeAttachment(attachment.id)}
                >
                  <SteelIcon icon={Cancel01Icon} size={14} />
                </AttachmentAction>
              </AttachmentActions>
            </Attachment>
          ))}
        </AttachmentGroup>
      )}
      <div className='flex items-end gap-1.5'>
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
                      const rendered = renderQuickReplyBody(qr.body, {
                        contactName,
                        userName: currentUser.data?.name,
                      })
                      setText((current) => `${current}${rendered}`)
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
                      const fields = extractTemplateFillableFields(
                        parseMetaTemplateComponents(template.components),
                      )
                      if (hasFillableFields(fields)) {
                        setPendingTemplate(template)
                        setVariablesDialogOpen(true)
                        return
                      }
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
              handleSend()
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
          disabled={
            isDisabled ||
            (hasAttachments
              ? !attachments.some((a) => a.status === 'done')
              : !text.trim())
          }
          aria-label='Enviar'
          onClick={handleSend}
        >
          <SteelIcon icon={SentIcon} size={16} />
        </Button>
      </div>

      <TemplateVariablesDialog
        template={pendingTemplate}
        open={variablesDialogOpen}
        onOpenChange={setVariablesDialogOpen}
        isSubmitting={sendTemplate.isPending}
        onConfirm={async (components) => {
          if (!pendingTemplate) return
          try {
            await sendTemplate.mutateAsync({
              templateName: pendingTemplate.name,
              language: pendingTemplate.language,
              components,
            })
            setVariablesDialogOpen(false)
            setPendingTemplate(null)
          } catch {
            notify.error('Erro ao enviar template')
          }
        }}
      />
    </div>
  )
}
