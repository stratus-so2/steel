'use client'

import {
  Delete02Icon,
  Mail01Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
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
  useCreateCrmScheduledPost,
  useCreateCrmSocialConnection,
  useCrmScheduledPosts,
  useCrmSocialConnections,
  useDeleteCrmScheduledPost,
  useDeleteCrmSocialConnection,
  usePublishCrmScheduledPost,
} from '@/src/hooks/use-crm-social'
import type {
  CrmScheduledPostStatusDTO,
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

const POST_STATUS_VARIANT: Record<
  CrmScheduledPostStatusDTO,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  DRAFT: 'outline',
  SCHEDULED: 'secondary',
  PUBLISHED: 'default',
  FAILED: 'destructive',
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
        Não há OAuth real contra Meta/TikTok/YouTube/X/LinkedIn neste módulo —
        registre aqui os dados de uma conta já autorizada fora do Steel.
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
  const deletePost = useDeleteCrmScheduledPost(workspaceId)
  const publishPost = usePublishCrmScheduledPost(workspaceId)

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

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center justify-between'>
        <h3 className='font-medium text-sm'>Posts agendados</h3>
        <CreateCrmScheduledPostDialog workspaceId={workspaceId} />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Conteúdo</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plataformas</TableHead>
            <TableHead className='w-40' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {!isLoading && posts?.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={4}
                className='text-center text-muted-foreground'
              >
                Nenhum post agendado
              </TableCell>
            </TableRow>
          )}
          {posts?.map((post) => (
            <TableRow key={post.id}>
              <TableCell className='max-w-64 truncate'>
                {post.content}
              </TableCell>
              <TableCell>
                <Badge variant={POST_STATUS_VARIANT[post.status]}>
                  {post.status}
                </Badge>
              </TableCell>
              <TableCell className='text-xs'>
                {post.targets?.map((t) => t.platform).join(', ')}
              </TableCell>
              <TableCell className='flex items-center justify-end gap-1'>
                {post.status !== 'PUBLISHED' && (
                  <Button
                    variant='default'
                    size='xs'
                    onClick={() => handlePublish(post.id)}
                    disabled={publishPost.isPending}
                  >
                    <SteelIcon icon={Mail01Icon} strokeWidth={2} />
                    Publicar
                  </Button>
                )}
                <Button
                  variant='ghost'
                  size='icon-xs'
                  onClick={() => handleDelete(post.id)}
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

function CreateCrmScheduledPostDialog({
  workspaceId,
}: {
  workspaceId: string
}) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [platforms, setPlatforms] = useState<CrmSocialPlatformDTO[]>([])
  const createPost = useCreateCrmScheduledPost(workspaceId)

  function handleClose() {
    setOpen(false)
    setContent('')
    setPlatforms([])
    createPost.reset()
  }

  function togglePlatform(platform: CrmSocialPlatformDTO) {
    setPlatforms((current) =>
      current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    )
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      await createPost.mutateAsync({ content, platforms })
      notify.success('Post agendado criado')
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
      <DialogContent className='w-full sm:max-w-md'>
        <form onSubmit={handleSubmit} className='flex flex-col gap-4 p-4'>
          <FieldGroup>
            <Field>
              <Textarea
                placeholder='Conteúdo do post'
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                required
              />
            </Field>
            <Field>
              <div className='flex flex-wrap gap-2'>
                {PLATFORMS.map((platform) => (
                  <Button
                    key={platform}
                    type='button'
                    variant={
                      platforms.includes(platform) ? 'default' : 'outline'
                    }
                    size='xs'
                    onClick={() => togglePlatform(platform)}
                  >
                    {platform}
                  </Button>
                ))}
              </div>
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
              disabled={
                createPost.isPending || !content || platforms.length === 0
              }
            >
              {createPost.isPending ? 'Criando...' : 'Criar post'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
