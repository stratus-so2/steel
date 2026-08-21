'use client'

import {
  Calendar01Icon,
  Delete02Icon,
  ImageAdd02Icon,
  PlusSignIcon,
  SentIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useMemo, useRef, useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldGroup } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCancelCrmScheduledPost,
  useCreateCrmScheduledPost,
  useCreateCrmSocialConnection,
  useCrmScheduledPosts,
  useCrmSocialConnections,
  useDeleteCrmScheduledPost,
  useDeleteCrmSocialConnection,
  usePublishCrmScheduledPost,
  useRescheduleCrmScheduledPost,
} from '@/src/hooks/use-crm-social'
import {
  CRM_INSTAGRAM_POST_TYPE_MEDIA,
  CRM_PLATFORM_MEDIA_REQUIREMENT,
  CRM_PLATFORM_TEXT_LIMIT,
  type CrmPublishablePlatform,
} from '@/src/schemas/crm-social.schema'
import type { CrmInstagramPostType } from '@/src/schemas/crm-social-instagram.schema'
import type {
  CrmScheduledPostDTO,
  CrmScheduledPostStatusDTO,
  CrmScheduledPostTargetStatusDTO,
  CrmSocialPlatformDTO,
} from '@/types/crm-social'

const PLATFORMS: CrmSocialPlatformDTO[] = [
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'TWITTER',
  'LINKEDIN',
]

const PUBLISHABLE_PLATFORMS = PLATFORMS as CrmPublishablePlatform[]

const dateFmt = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const POST_STATUS_LABEL: Record<CrmScheduledPostStatusDTO, string> = {
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendado',
  PUBLISHING: 'Publicando',
  PUBLISHED: 'Publicado',
  PARTIALLY_FAILED: 'Parcial',
  FAILED: 'Falhou',
  CANCELED: 'Cancelado',
}

const POST_STATUS_VARIANT: Record<
  CrmScheduledPostStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  PUBLISHING: 'secondary',
  PUBLISHED: 'default',
  PARTIALLY_FAILED: 'destructive',
  FAILED: 'destructive',
  CANCELED: 'outline',
}

const TARGET_STATUS_COLOR: Record<CrmScheduledPostTargetStatusDTO, string> = {
  PENDING: 'text-muted-foreground',
  PUBLISHING: 'text-amber-600',
  PUBLISHED: 'text-emerald-600',
  FAILED: 'text-destructive',
  CANCELED: 'text-muted-foreground line-through',
}

const INSTAGRAM_POST_TYPE_LABELS: Record<CrmInstagramPostType, string> = {
  FEED: 'Publicação (feed)',
  REELS: 'Reels',
  STORIES: 'Stories',
}

export function CrmSocialPanel({ workspaceId }: { workspaceId: string }) {
  return (
    <div className='flex flex-col gap-6'>
      <CrmSocialConnectionsSection workspaceId={workspaceId} />
      <CrmScheduledPostsSection workspaceId={workspaceId} />
    </div>
  )
}

function CrmSocialConnectionsSection({ workspaceId }: { workspaceId: string }) {
  const { data: connections, isLoading } = useCrmSocialConnections(workspaceId)
  const deleteConnection = useDeleteCrmSocialConnection(workspaceId)

  async function handleDelete(connectionId: string) {
    try {
      await deleteConnection.mutateAsync(connectionId)
      notify.success('Conexão removida')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium text-sm'>Conexões sociais</h3>
        <CreateCrmSocialConnectionDialog workspaceId={workspaceId} />
      </div>
      <p className='text-muted-foreground text-xs'>
        Conecte via OAuth em cada studio de plataforma (menu Social) — o
        formulário abaixo é o cadastro manual legado, para contas já autorizadas
        fora do Steel.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plataforma</TableHead>
            <TableHead>Conta</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className='w-10' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && connections?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhuma conexão
              </TableCell>
            </TableRow>
          )}
          {connections?.map((connection) => (
            <TableRow key={connection.id}>
              <TableCell>{connection.platform}</TableCell>
              <TableCell>
                {connection.accountName ?? connection.externalAccountId}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    connection.status === 'CONNECTED' ? 'default' : 'outline'
                  }
                >
                  {connection.status}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(connection.id)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CreateCrmSocialConnectionDialog({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<CrmSocialPlatformDTO>('INSTAGRAM')
  const [externalAccountId, setExternalAccountId] = useState('')
  const [accountName, setAccountName] = useState('')
  const createConnection = useCreateCrmSocialConnection(workspaceId)

  function handleClose() {
    setOpen(false)
    setExternalAccountId('')
    setAccountName('')
    createConnection.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createConnection.mutateAsync({
        platform,
        externalAccountId,
        accountName: accountName || undefined,
      })
      notify.success('Conexão criada')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Nova conexão
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Select
                items={PLATFORMS.map((p) => ({ value: p, label: p }))}
                value={platform}
                onValueChange={(value) =>
                  setPlatform(value as CrmSocialPlatformDTO)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <Input
                placeholder='ID da conta externa'
                value={externalAccountId}
                onChange={(e) => setExternalAccountId(e.target.value)}
                required
              />
            </Field>
            <Field>
              <Input
                placeholder='Nome da conta (opcional)'
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={createConnection.isPending || !externalAccountId}
            >
              {createConnection.isPending ? 'Criando...' : 'Criar conexão'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CrmScheduledPostsSection({ workspaceId }: { workspaceId: string }) {
  const { data: posts, isLoading } = useCrmScheduledPosts(workspaceId)
  const { data: connections } = useCrmSocialConnections(workspaceId)
  const deletePost = useDeleteCrmScheduledPost(workspaceId)
  const publishPost = usePublishCrmScheduledPost(workspaceId)
  const cancelPost = useCancelCrmScheduledPost(workspaceId)

  const connected = useMemo(() => {
    const set = new Set<CrmPublishablePlatform>()
    for (const c of connections ?? []) {
      if (
        c.status === 'CONNECTED' &&
        PUBLISHABLE_PLATFORMS.includes(c.platform as CrmPublishablePlatform)
      ) {
        set.add(c.platform as CrmPublishablePlatform)
      }
    }
    return set
  }, [connections])

  async function handleDelete(postId: string) {
    try {
      await deletePost.mutateAsync(postId)
      notify.success('Post removido')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handlePublish(postId: string) {
    try {
      await publishPost.mutateAsync(postId)
      notify.success('Tentativa de publicação registrada')
    } catch (err) {
      notify.error(err)
    }
  }

  async function handleCancel(postId: string) {
    try {
      await cancelPost.mutateAsync(postId)
      notify.success('Post cancelado')
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium text-sm'>Posts agendados</h3>
        <CreateCrmScheduledPostDialog
          workspaceId={workspaceId}
          connected={connected}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Conteúdo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Agendado para</TableHead>
            <TableHead>Plataformas</TableHead>
            <TableHead className='w-52' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && posts?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className='text-center text-muted-foreground'
              >
                Nenhum post agendado
              </TableCell>
            </TableRow>
          )}
          {posts?.map((post) => (
            <CrmScheduledPostRow
              key={post.id}
              post={post}
              workspaceId={workspaceId}
              onPublish={() => handlePublish(post.id)}
              onCancel={() => handleCancel(post.id)}
              onDelete={() => handleDelete(post.id)}
              publishing={publishPost.isPending}
              canceling={cancelPost.isPending}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function CrmScheduledPostRow({
  post,
  workspaceId,
  onPublish,
  onCancel,
  onDelete,
  publishing,
  canceling,
}: {
  post: CrmScheduledPostDTO
  workspaceId: string
  onPublish: () => void
  onCancel: () => void
  onDelete: () => void
  publishing: boolean
  canceling: boolean
}) {
  const canCancel =
    post.status === 'SCHEDULED' ||
    post.status === 'FAILED' ||
    post.status === 'PARTIALLY_FAILED'
  const canReschedule = canCancel
  const canPublishNow =
    post.status !== 'PUBLISHED' && post.status !== 'PUBLISHING'

  return (
    <TableRow>
      <TableCell className='max-w-64'>
        <p className='truncate'>{post.content || '(sem texto)'}</p>
        {post.lastError && (
          <p className='truncate text-destructive text-xs'>{post.lastError}</p>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={POST_STATUS_VARIANT[post.status]}>
          {POST_STATUS_LABEL[post.status]}
        </Badge>
      </TableCell>
      <TableCell className='text-xs'>
        {post.scheduledFor ? dateFmt.format(new Date(post.scheduledFor)) : '—'}
      </TableCell>
      <TableCell>
        <div className='flex flex-wrap items-center gap-2 text-xs'>
          {post.targets?.map((t) => (
            <span
              key={t.id}
              className={TARGET_STATUS_COLOR[t.status]}
              title={t.error ?? undefined}
            >
              {t.platform}
            </span>
          ))}
          {post.media && post.media.length > 0 && (
            <span className='text-muted-foreground'>
              · {post.media.length} mídia(s)
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className='flex items-center justify-end gap-1'>
          {canPublishNow && (
            <Button
              variant='default'
              size='xs'
              onClick={onPublish}
              disabled={publishing}
            >
              <SteelIcon icon={SentIcon} strokeWidth={2} />
              Publicar
            </Button>
          )}
          {canReschedule && (
            <RescheduleCrmScheduledPostDialog
              workspaceId={workspaceId}
              postId={post.id}
            />
          )}
          {canCancel && (
            <Button
              variant='outline'
              size='xs'
              onClick={onCancel}
              disabled={canceling}
            >
              Cancelar
            </Button>
          )}
          <Button variant='ghost' size='icon-xs' onClick={onDelete}>
            <SteelIcon icon={Delete02Icon} strokeWidth={2} />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

function RescheduleCrmScheduledPostDialog({
  workspaceId,
  postId,
}: {
  workspaceId: string
  postId: string
}) {
  const [open, setOpen] = useState(false)
  const [scheduledFor, setScheduledFor] = useState('')
  const reschedule = useRescheduleCrmScheduledPost(workspaceId)

  function handleClose() {
    setOpen(false)
    setScheduledFor('')
    reschedule.reset()
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await reschedule.mutateAsync({
        postId,
        scheduledFor: new Date(scheduledFor).toISOString(),
      })
      notify.success('Post reagendado')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='outline' size='xs'>
            <SteelIcon icon={Calendar01Icon} strokeWidth={2} />
            Reagendar
          </Button>
        }
      />
      <DialogContent className='w-full sm:max-w-sm'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Input
                type='datetime-local'
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
                required
              />
            </Field>
          </FieldGroup>
          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button
              size='sm'
              type='submit'
              disabled={reschedule.isPending || !scheduledFor}
            >
              {reschedule.isPending ? 'Salvando...' : 'Reagendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CreateCrmScheduledPostDialog({
  workspaceId,
  connected,
}: {
  workspaceId: string
  connected: Set<CrmPublishablePlatform>
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [platforms, setPlatforms] = useState<CrmPublishablePlatform[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [mode, setMode] = useState<'now' | 'schedule'>('schedule')
  const [scheduledFor, setScheduledFor] = useState('')
  const [igPostType, setIgPostType] = useState<CrmInstagramPostType>('FEED')
  const [youtubePrivacy, setYoutubePrivacy] = useState<
    'public' | 'unlisted' | 'private'
  >('public')
  const [tiktokPrivacy, setTiktokPrivacy] = useState<
    | 'PUBLIC_TO_EVERYONE'
    | 'MUTUAL_FOLLOW_FRIENDS'
    | 'FOLLOWER_OF_CREATOR'
    | 'SELF_ONLY'
  >('SELF_ONLY')
  const fileRef = useRef<HTMLInputElement>(null)
  const createPost = useCreateCrmScheduledPost(workspaceId)

  const hasImage = files.some((f) => f.type.startsWith('image/'))
  const hasVideo = files.some((f) => f.type.startsWith('video/'))
  const needsInstagram = platforms.includes('INSTAGRAM')
  const needsYoutube = platforms.includes('YOUTUBE')
  const needsTiktok = platforms.includes('TIKTOK')

  const textLimit = platforms.length
    ? Math.min(...platforms.map((p) => CRM_PLATFORM_TEXT_LIMIT[p]))
    : 10_000

  function handleClose() {
    setOpen(false)
    setContent('')
    setTitle('')
    setPlatforms([])
    setFiles([])
    setMode('schedule')
    setScheduledFor('')
    setIgPostType('FEED')
    if (fileRef.current) fileRef.current.value = ''
    createPost.reset()
  }

  function togglePlatform(platform: CrmPublishablePlatform) {
    if (!connected.has(platform)) return
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    )
  }

  function validate(): string | null {
    if (platforms.length === 0) return 'Selecione ao menos uma plataforma.'
    if (content.length > textLimit) {
      return `O texto excede o limite de ${textLimit} caracteres.`
    }
    for (const platform of platforms) {
      if (platform === 'INSTAGRAM') {
        const req = CRM_INSTAGRAM_POST_TYPE_MEDIA[igPostType]
        if (req === 'image' && !hasImage) {
          return `${INSTAGRAM_POST_TYPE_LABELS[igPostType]} no Instagram exige uma imagem.`
        }
        if (req === 'video' && !hasVideo) {
          return `${INSTAGRAM_POST_TYPE_LABELS[igPostType]} no Instagram exige um vídeo.`
        }
        if (req === 'either' && !hasImage && !hasVideo) {
          return `${INSTAGRAM_POST_TYPE_LABELS[igPostType]} no Instagram exige uma imagem ou vídeo.`
        }
        continue
      }
      const req = CRM_PLATFORM_MEDIA_REQUIREMENT[platform]
      if (req === 'image' && !hasImage) return `${platform} exige uma imagem.`
      if (req === 'video' && !hasVideo) return `${platform} exige um vídeo.`
    }
    if (
      (platforms.includes('TWITTER') || platforms.includes('LINKEDIN')) &&
      !content.trim()
    ) {
      return 'X e LinkedIn exigem um texto.'
    }
    if (mode === 'schedule') {
      if (!scheduledFor) return 'Informe a data e hora do agendamento.'
      if (new Date(scheduledFor).getTime() <= Date.now()) {
        return 'A data do agendamento deve estar no futuro.'
      }
    }
    return null
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    const problem = validate()
    if (problem) {
      notify.error(problem)
      return
    }
    try {
      await createPost.mutateAsync({
        content,
        title: title.trim() || undefined,
        mode,
        scheduledFor:
          mode === 'schedule'
            ? new Date(scheduledFor).toISOString()
            : undefined,
        platforms,
        options: {
          instagram: needsInstagram ? { postType: igPostType } : undefined,
          youtube: needsYoutube
            ? { privacy: youtubePrivacy, tags: [] }
            : undefined,
          tiktok: needsTiktok
            ? {
                privacy: tiktokPrivacy,
                disableComment: false,
                disableDuet: false,
                disableStitch: false,
              }
            : undefined,
        },
        media: files,
      })
      notify.success(mode === 'now' ? 'Publicação enviada!' : 'Post agendado!')
      handleClose()
    } catch (err) {
      notify.error(err)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => (v ? setOpen(true) : handleClose())}
    >
      <DialogTrigger
        render={
          <Button variant='default' size='xs'>
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Novo post
          </Button>
        }
      />
      <DialogContent className='max-h-[85vh] w-full overflow-y-auto sm:max-w-lg'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-5 p-4'>
          <div className='flex flex-col gap-2'>
            <span className='font-medium text-sm'>Plataformas</span>
            <div className='flex flex-wrap gap-2'>
              {PUBLISHABLE_PLATFORMS.map((platform) => {
                const isConnected = connected.has(platform)
                const isOn = platforms.includes(platform)
                return (
                  <button
                    key={platform}
                    type='button'
                    disabled={!isConnected}
                    onClick={() => togglePlatform(platform)}
                    title={
                      isConnected
                        ? undefined
                        : 'Conecte esta conta no studio da plataforma'
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                      isOn
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {platform}
                  </button>
                )
              })}
            </div>
          </div>

          {needsInstagram && (
            <FieldGroup>
              <Field>
                <span className='font-medium text-xs'>
                  Modelo de post (Instagram)
                </span>
                <Select
                  items={(['FEED', 'REELS', 'STORIES'] as const).map((v) => ({
                    value: v,
                    label: INSTAGRAM_POST_TYPE_LABELS[v],
                  }))}
                  value={igPostType}
                  onValueChange={(v) =>
                    v && setIgPostType(v as CrmInstagramPostType)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {(['FEED', 'REELS', 'STORIES'] as const).map((v) => (
                        <SelectItem key={v} value={v}>
                          {INSTAGRAM_POST_TYPE_LABELS[v]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          )}

          {needsYoutube && (
            <FieldGroup>
              <Field>
                <span className='font-medium text-xs'>Título (YouTube)</span>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder='Título do vídeo'
                  maxLength={100}
                />
              </Field>
            </FieldGroup>
          )}

          <FieldGroup>
            <Field>
              <span className='font-medium text-xs'>Conteúdo</span>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder='Escreva o texto do post…'
                rows={5}
                maxLength={textLimit}
                className='resize-none'
              />
              <span className='text-muted-foreground text-xs'>
                {content.length}/{textLimit}
              </span>
            </Field>
          </FieldGroup>

          <FieldGroup>
            <Field>
              <span className='font-medium text-xs'>Mídia</span>
              <Input
                ref={fileRef}
                type='file'
                accept='image/*,video/*'
                multiple
                onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <ul className='flex flex-col gap-1 text-muted-foreground text-xs'>
                  {files.map((f) => (
                    <li key={f.name} className='flex items-center gap-1.5'>
                      <SteelIcon icon={ImageAdd02Icon} strokeWidth={2} />
                      {f.name} ({(f.size / 1024 / 1024).toFixed(1)} MB)
                    </li>
                  ))}
                </ul>
              )}
            </Field>
          </FieldGroup>

          {(needsYoutube || needsTiktok) && (
            <div className='grid gap-4 sm:grid-cols-2'>
              {needsYoutube && (
                <Field>
                  <span className='font-medium text-xs'>
                    Privacidade (YouTube)
                  </span>
                  <Select
                    items={[
                      { value: 'public', label: 'Público' },
                      { value: 'unlisted', label: 'Não listado' },
                      { value: 'private', label: 'Privado' },
                    ]}
                    value={youtubePrivacy}
                    onValueChange={(v) =>
                      v &&
                      setYoutubePrivacy(v as 'public' | 'unlisted' | 'private')
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value='public'>Público</SelectItem>
                        <SelectItem value='unlisted'>Não listado</SelectItem>
                        <SelectItem value='private'>Privado</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {needsTiktok && (
                <Field>
                  <span className='font-medium text-xs'>
                    Privacidade (TikTok)
                  </span>
                  <Select
                    items={[
                      { value: 'PUBLIC_TO_EVERYONE', label: 'Público' },
                      { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Amigos' },
                      { value: 'FOLLOWER_OF_CREATOR', label: 'Seguidores' },
                      { value: 'SELF_ONLY', label: 'Somente eu' },
                    ]}
                    value={tiktokPrivacy}
                    onValueChange={(v) =>
                      v && setTiktokPrivacy(v as typeof tiktokPrivacy)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value='PUBLIC_TO_EVERYONE'>
                          Público
                        </SelectItem>
                        <SelectItem value='MUTUAL_FOLLOW_FRIENDS'>
                          Amigos
                        </SelectItem>
                        <SelectItem value='FOLLOWER_OF_CREATOR'>
                          Seguidores
                        </SelectItem>
                        <SelectItem value='SELF_ONLY'>Somente eu</SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              )}
            </div>
          )}

          <div className='flex flex-col gap-2'>
            <span className='font-medium text-sm'>Quando publicar</span>
            <div className='flex flex-wrap items-center gap-3'>
              <Button
                type='button'
                variant={mode === 'now' ? 'default' : 'outline'}
                size='xs'
                onClick={() => setMode('now')}
              >
                Agora
              </Button>
              <Button
                type='button'
                variant={mode === 'schedule' ? 'default' : 'outline'}
                size='xs'
                onClick={() => setMode('schedule')}
              >
                Agendar
              </Button>
              {mode === 'schedule' && (
                <Input
                  type='datetime-local'
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  className='w-auto'
                />
              )}
            </div>
          </div>

          <div className='flex justify-end gap-2'>
            <DialogClose
              render={
                <Button
                  variant='outline'
                  size='sm'
                  type='button'
                  onClick={handleClose}
                >
                  Cancelar
                </Button>
              }
            />
            <Button size='sm' type='submit' disabled={createPost.isPending}>
              <SteelIcon
                icon={mode === 'now' ? SentIcon : Calendar01Icon}
                strokeWidth={2}
              />
              {createPost.isPending
                ? 'Enviando...'
                : mode === 'now'
                  ? 'Publicar agora'
                  : 'Agendar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
