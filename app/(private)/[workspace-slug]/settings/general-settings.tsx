'use client'

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Copy01Icon,
  Delete02Icon,
  ImageUpload01Icon,
  Loading03Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react'
import { WorkspaceAvatar } from '@/app/_components/workspace/workspace-avatar'
import { SteelIcon } from '@/components/icon/icon'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { notify } from '@/lib/notify'
import {
  useRemoveWorkspaceLogo,
  useUpdateWorkspace,
  useUploadWorkspaceLogo,
  useWorkspaceSlugAvailability,
} from '@/src/hooks/use-workspace'
import { WorkspaceSlugSchema } from '@/src/schemas/workspace.schema'
import type { WorkspaceCompanySizeDTO, WorkspaceDTO } from '@/types/workspace'
import {
  DELETE_WORKSPACE_COPY,
  DeleteWorkspaceDialog,
} from './delete-workspace-dialog'

export const COMPANY_SIZE_LABEL: Record<WorkspaceCompanySizeDTO, string> = {
  SIZE_1_10: '1–10 pessoas',
  SIZE_11_50: '11–50 pessoas',
  SIZE_51_200: '51–200 pessoas',
  SIZE_201_1000: '201–1.000 pessoas',
  SIZE_1000_PLUS: 'Mais de 1.000 pessoas',
}

const COMPANY_SIZES = Object.keys(
  COMPANY_SIZE_LABEL,
) as WorkspaceCompanySizeDTO[]

const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/webp']
const LOGO_MAX_BYTES = 2 * 1024 * 1024

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER' | string

/** Lowercases and turns spaces into hyphens while the user types. */
export function normalizeSlugInput(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '-')
}

export function WorkspaceGeneralSettings({
  workspace: initial,
  role,
  appUrl,
}: {
  workspace: WorkspaceDTO
  role: WorkspaceRole
  appUrl: string
}) {
  const router = useRouter()
  const [workspace, setWorkspace] = useState(initial)
  const canEdit = role === 'OWNER' || role === 'ADMIN'
  const isOwner = role === 'OWNER'

  const [name, setName] = useState(initial.name)
  const [slug, setSlug] = useState(initial.slug)
  const [companySize, setCompanySize] =
    useState<WorkspaceCompanySizeDTO | null>(initial.companySize)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const update = useUpdateWorkspace(workspace.id)
  const uploadLogo = useUploadWorkspaceLogo(workspace.id)
  const removeLogo = useRemoveWorkspaceLogo(workspace.id)

  const origin = appUrl.replace(/\/+$/, '')
  const workspaceLink = `${origin}/${workspace.slug}`

  const slugChanged = slug !== workspace.slug
  const slugFormat = WorkspaceSlugSchema.safeParse(slug)
  const availability = useWorkspaceSlugAvailability(
    workspace.id,
    slug,
    canEdit && slugChanged && slugFormat.success,
  )

  const nameTrimmed = name.trim()
  const nameError =
    nameTrimmed.length < 2
      ? 'Nome deve ter ao menos 2 caracteres'
      : nameTrimmed.length > 100
        ? 'Nome deve ter no máximo 100 caracteres'
        : null

  let slugError: string | null = null
  if (slugChanged) {
    if (!slugFormat.success) {
      slugError = slugFormat.error.issues[0]?.message ?? 'Endereço inválido'
    } else if (availability.data && !availability.data.available) {
      slugError = availability.data.message ?? 'Endereço indisponível'
    } else if (availability.error && !availability.isFetching) {
      slugError = 'Não foi possível verificar o endereço. Tente de novo.'
    }
  }
  const slugChecking =
    slugChanged && slugFormat.success && availability.isFetching
  const slugAvailable =
    slugChanged &&
    slugFormat.success &&
    !availability.isFetching &&
    availability.data?.available === true

  const dirty =
    nameTrimmed !== workspace.name ||
    slugChanged ||
    companySize !== workspace.companySize
  const canSave =
    canEdit &&
    dirty &&
    !nameError &&
    !slugError &&
    (!slugChanged || slugAvailable) &&
    !update.isPending

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(workspaceLink)
      notify.success('Link copiado')
    } catch {
      notify.error('Não foi possível copiar o link')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!canSave) return
    const payload: {
      name?: string
      slug?: string
      companySize?: WorkspaceCompanySizeDTO | null
    } = {}
    if (nameTrimmed !== workspace.name) payload.name = nameTrimmed
    if (slugChanged) payload.slug = slug
    if (companySize !== workspace.companySize) payload.companySize = companySize

    try {
      const saved = await update.mutateAsync(payload)
      setWorkspace(saved)
      setName(saved.name)
      setSlug(saved.slug)
      setCompanySize(saved.companySize)
      notify.success('Alterações salvas')
      if (saved.slug !== workspace.slug) {
        router.replace(`/${saved.slug}/settings`)
      }
      router.refresh()
    } catch (error) {
      notify.error(error, 'Não foi possível salvar as alterações')
    }
  }

  function handleReset() {
    setName(workspace.name)
    setSlug(workspace.slug)
    setCompanySize(workspace.companySize)
  }

  async function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!LOGO_TYPES.includes(file.type)) {
      notify.error('Formato não suportado. Use PNG, JPEG ou WebP')
      return
    }
    if (file.size > LOGO_MAX_BYTES) {
      notify.error('Arquivo muito grande. Máximo 2 MB')
      return
    }
    try {
      const saved = await uploadLogo.mutateAsync(file)
      setWorkspace(saved)
      notify.success('Logo atualizado')
      router.refresh()
    } catch (error) {
      notify.error(error, 'Não foi possível enviar o logo')
    }
  }

  async function handleRemoveLogo() {
    try {
      const saved = await removeLogo.mutateAsync()
      setWorkspace(saved)
      notify.success('Logo removido')
      router.refresh()
    } catch (error) {
      notify.error(error, 'Não foi possível remover o logo')
    }
  }

  const logoBusy = uploadLogo.isPending || removeLogo.isPending

  return (
    <div className='mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6'>
      <Card>
        <CardContent className='flex min-w-0 items-center gap-4'>
          <WorkspaceAvatar
            name={workspace.name}
            logoUrl={workspace.logoUrl}
            className='size-16 rounded-lg border border-border text-2xl'
          />
          <div className='min-w-0 flex-1 space-y-1'>
            <p className='truncate text-lg font-semibold'>{workspace.name}</p>
            <div className='flex min-w-0 items-center gap-1'>
              <a
                href={workspaceLink}
                className='truncate text-sm text-muted-foreground hover:underline'
              >
                {workspaceLink}
              </a>
              <Button
                type='button'
                variant='ghost'
                size='icon-sm'
                aria-label='Copiar link do workspace'
                onClick={handleCopyLink}
              >
                <SteelIcon icon={Copy01Icon} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {!canEdit && (
        <Alert>
          <SteelIcon icon={Alert02Icon} />
          <AlertDescription>
            Apenas o dono e os administradores do workspace podem editar estas
            informações.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Logo</CardTitle>
          <CardDescription>
            Aparece no seletor de workspaces. PNG, JPEG ou WebP de até 2 MB — de
            preferência quadrado, com pelo menos 256 × 256 px.
          </CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center gap-4'>
          <WorkspaceAvatar
            name={workspace.name}
            logoUrl={workspace.logoUrl}
            className='size-12 rounded-lg border border-border text-lg'
          />
          {canEdit && (
            <div className='flex flex-wrap gap-2'>
              <input
                ref={fileInput}
                type='file'
                accept={LOGO_TYPES.join(',')}
                className='hidden'
                aria-label='Arquivo do logo'
                data-testid='workspace-logo-input'
                onChange={handleLogoChange}
              />
              <Button
                type='button'
                variant='outline'
                disabled={logoBusy}
                onClick={() => fileInput.current?.click()}
              >
                <SteelIcon
                  icon={
                    uploadLogo.isPending ? Loading03Icon : ImageUpload01Icon
                  }
                  className={uploadLogo.isPending ? 'animate-spin' : undefined}
                />
                {workspace.logoUrl ? 'Trocar logo' : 'Carregar logo'}
              </Button>
              {workspace.logoUrl && (
                <Button
                  type='button'
                  variant='ghost'
                  disabled={logoBusy}
                  onClick={handleRemoveLogo}
                >
                  <SteelIcon icon={Delete02Icon} />
                  Remover
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações do workspace</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className='space-y-6'>
            <FieldGroup>
              <Field data-invalid={(dirty && !!nameError) || undefined}>
                <FieldLabel htmlFor='workspace-name'>
                  Nome do espaço de trabalho
                </FieldLabel>
                <Input
                  id='workspace-name'
                  value={name}
                  maxLength={100}
                  disabled={!canEdit}
                  onChange={(e) => setName(e.target.value)}
                />
                {dirty && nameError && <FieldError>{nameError}</FieldError>}
              </Field>

              <Field>
                <FieldLabel htmlFor='workspace-company-size'>
                  Tamanho da empresa
                </FieldLabel>
                <Select
                  value={companySize ?? ''}
                  disabled={!canEdit}
                  onValueChange={(value) =>
                    setCompanySize(
                      value ? (String(value) as WorkspaceCompanySizeDTO) : null,
                    )
                  }
                >
                  <SelectTrigger
                    id='workspace-company-size'
                    className='w-full'
                    aria-label='Tamanho da empresa'
                  >
                    <span
                      className={companySize ? '' : 'text-muted-foreground'}
                    >
                      {companySize
                        ? COMPANY_SIZE_LABEL[companySize]
                        : 'Selecione o tamanho'}
                    </span>
                  </SelectTrigger>
                  <SelectContent alignItemWithTrigger={false}>
                    {COMPANY_SIZES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {COMPANY_SIZE_LABEL[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field data-invalid={!!slugError || undefined}>
                <FieldLabel htmlFor='workspace-slug'>
                  URL do espaço de trabalho
                </FieldLabel>
                <InputGroup>
                  <InputGroupAddon className='max-w-[45%]'>
                    <InputGroupText className='truncate'>
                      {origin.replace(/^https?:\/\//, '')}/
                    </InputGroupText>
                  </InputGroupAddon>
                  <InputGroupInput
                    id='workspace-slug'
                    value={slug}
                    maxLength={50}
                    disabled={!canEdit}
                    autoComplete='off'
                    spellCheck={false}
                    aria-invalid={!!slugError || undefined}
                    onChange={(e) =>
                      setSlug(normalizeSlugInput(e.target.value))
                    }
                  />
                  {slugChanged && (slugChecking || slugAvailable) && (
                    <InputGroupAddon align='inline-end'>
                      <SteelIcon
                        icon={
                          slugChecking ? Loading03Icon : CheckmarkCircle02Icon
                        }
                        className={
                          slugChecking ? 'animate-spin' : 'text-primary'
                        }
                        aria-label={
                          slugChecking ? 'Verificando' : 'Endereço disponível'
                        }
                      />
                    </InputGroupAddon>
                  )}
                </InputGroup>
                {slugError ? (
                  <FieldError>{slugError}</FieldError>
                ) : slugAvailable ? (
                  <FieldDescription>Endereço disponível.</FieldDescription>
                ) : (
                  <FieldDescription>
                    Letras minúsculas, números e hífens.
                  </FieldDescription>
                )}
                {slugChanged && (
                  <Alert>
                    <SteelIcon icon={Alert02Icon} />
                    <AlertDescription>
                      Ao trocar o endereço, os links antigos (favoritos,
                      e-mails, integrações e links compartilhados) deixam de
                      funcionar. Todos os membros passam a usar o novo endereço.
                    </AlertDescription>
                  </Alert>
                )}
              </Field>
            </FieldGroup>

            {canEdit && (
              <div className='flex flex-wrap justify-end gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  disabled={!dirty || update.isPending}
                  onClick={handleReset}
                >
                  Descartar
                </Button>
                <Button type='submit' disabled={!canSave}>
                  {update.isPending ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className='border-destructive/40'>
        <CardHeader>
          <CardTitle className='text-destructive'>
            Excluir este workspace
          </CardTitle>
          <CardDescription>{DELETE_WORKSPACE_COPY}</CardDescription>
        </CardHeader>
        <CardContent className='flex flex-wrap items-center justify-between gap-3'>
          <p className='text-sm text-muted-foreground'>
            {isOwner
              ? 'A exclusão roda em segundo plano: os membros perdem o acesso na hora.'
              : 'Apenas o dono do workspace pode excluí-lo.'}
          </p>
          {isOwner && (
            <Button
              type='button'
              variant='destructive'
              onClick={() => setDeleteOpen(true)}
            >
              <SteelIcon icon={Delete02Icon} />
              Excluir este workspace
            </Button>
          )}
        </CardContent>
      </Card>

      {isOwner && (
        <DeleteWorkspaceDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          workspace={workspace}
        />
      )}
    </div>
  )
}
