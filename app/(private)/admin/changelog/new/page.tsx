'use client'

import {
  Delete02Icon,
  Image01Icon,
  PlusSignIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import {
  AdminPage,
  AdminPageHeader,
} from '@/app/_components/admin/shell/admin-page'
import { SteelIcon } from '@/components/icon/icon'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { notify } from '@/lib/notify'
import {
  useCreateChangelog,
  useReleaseDraft,
  useSearchChangelogUsers,
} from '@/src/hooks/use-changelog'
import { useUploadChangelogImage } from '@/src/hooks/use-changelog-image-upload'
import type {
  ChangelogReleaseDraftDTO,
  ChangelogUserSearchResultDTO,
} from '@/types/changelog'

interface DraftItem {
  key: string
  title: string
  body: string
  imageUrl?: string
}

function newDraftItem(): DraftItem {
  return { key: crypto.randomUUID(), title: '', body: '' }
}

function parseManualEmails(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/[,\n]/)
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  )
}

function ItemImageUpload({
  imageUrl,
  onChange,
}: {
  imageUrl: string | undefined
  onChange: (url: string | undefined) => void
}) {
  const inputId = useId()
  const fileRef = useRef<HTMLInputElement>(null)
  const upload = useUploadChangelogImage()

  async function handleFile(file: File) {
    try {
      const { url } = await upload.mutateAsync(file)
      onChange(url)
    } catch (error) {
      notify.error(error)
    }
  }

  if (imageUrl) {
    return (
      <div className='relative w-fit'>
        <img
          src={imageUrl}
          alt='Imagem do item'
          className='max-h-32 rounded-md'
        />
        <Button
          type='button'
          size='icon-xs'
          variant='destructive'
          className='-right-2 -top-2 absolute rounded-full'
          onClick={() => onChange(undefined)}
        >
          <SteelIcon icon={Delete02Icon} strokeWidth={2} />
        </Button>
      </div>
    )
  }

  return (
    <>
      <input
        ref={fileRef}
        id={inputId}
        type='file'
        accept='image/*'
        className='hidden'
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
      <Button
        type='button'
        size='xs'
        variant='outline'
        disabled={upload.isPending}
        onClick={() => fileRef.current?.click()}
      >
        <SteelIcon icon={Image01Icon} strokeWidth={2} />
        {upload.isPending ? 'Enviando...' : 'Adicionar imagem'}
      </Button>
    </>
  )
}

function RecipientPicker({
  selectedUsers,
  onSelectedUsersChange,
  manualEmails,
  onManualEmailsChange,
}: {
  selectedUsers: ChangelogUserSearchResultDTO[]
  onSelectedUsersChange: (users: ChangelogUserSearchResultDTO[]) => void
  manualEmails: string
  onManualEmailsChange: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timeout)
  }, [query])

  const { data: results, isFetching } = useSearchChangelogUsers(debouncedQuery)
  const selectedIds = new Set(selectedUsers.map((u) => u.id))

  function toggleUser(user: ChangelogUserSearchResultDTO) {
    if (selectedIds.has(user.id)) {
      onSelectedUsersChange(selectedUsers.filter((u) => u.id !== user.id))
    } else {
      onSelectedUsersChange([...selectedUsers, user])
    }
  }

  return (
    <div className='space-y-3'>
      <Field>
        <FieldLabel>Buscar usuários da plataforma</FieldLabel>
        <Input
          placeholder='Nome ou e-mail'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Field>

      {debouncedQuery.trim().length >= 2 && (
        <div className='max-h-48 space-y-1 overflow-y-auto rounded-md border p-2'>
          {isFetching && (
            <p className='p-1 text-muted-foreground text-xs'>Buscando...</p>
          )}
          {!isFetching && results?.length === 0 && (
            <p className='p-1 text-muted-foreground text-xs'>
              Nenhum usuário encontrado.
            </p>
          )}
          {results?.map((user) => (
            <button
              key={user.id}
              type='button'
              onClick={() => toggleUser(user)}
              className='flex w-full items-center justify-between rounded-md p-1.5 text-left text-sm hover:bg-accent'
            >
              <span>
                {user.name}{' '}
                <span className='text-muted-foreground text-xs'>
                  {user.email}
                </span>
              </span>
              {selectedIds.has(user.id) && (
                <Badge variant='secondary'>Selecionado</Badge>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedUsers.length > 0 && (
        <div className='flex flex-wrap gap-1.5'>
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant='secondary' className='gap-1'>
              {user.email}
              <button
                type='button'
                onClick={() => toggleUser(user)}
                className='ml-1'
              >
                <SteelIcon icon={Delete02Icon} strokeWidth={2} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Field>
        <FieldLabel>
          Ou cole e-mails avulsos (um por linha ou separados por vírgula)
        </FieldLabel>
        <Textarea
          placeholder={'fulano@exemplo.com\nciclano@exemplo.com'}
          value={manualEmails}
          onChange={(e) => onManualEmailsChange(e.target.value)}
          rows={3}
        />
      </Field>
    </div>
  )
}

/**
 * Pré-preenche o e-mail a partir da última release do GitHub ou de notas
 * coladas. Só gera rascunho — nada é enviado sem o admin revisar e criar.
 */
function ReleaseDraftPanel({
  onApply,
}: {
  onApply: (draft: ChangelogReleaseDraftDTO) => void
}) {
  const releaseDraft = useReleaseDraft()
  const [pasting, setPasting] = useState(false)
  const [markdown, setMarkdown] = useState('')
  const [summary, setSummary] = useState<ChangelogReleaseDraftDTO | null>(null)

  async function generate(
    input: { source: 'github' } | { source: 'manual'; markdown: string },
  ) {
    try {
      const draft = await releaseDraft.mutateAsync(input)
      setSummary(draft)
      if (draft.items.length === 0) {
        notify.error(
          'Nenhuma novidade para clientes nessas notas — só itens internos.',
        )
        return
      }
      onApply(draft)
      notify.success('Rascunho preenchido — revise antes de criar')
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <div className='space-y-3 rounded-md border border-dashed p-4'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <p className='font-medium text-sm'>Preencher a partir de release</p>
          <p className='text-muted-foreground text-xs'>
            Converte as notas em itens do e-mail, sem commits internos (ci,
            chore, test...).
          </p>
        </div>
        <div className='flex gap-2'>
          <Button
            type='button'
            size='xs'
            variant='outline'
            disabled={releaseDraft.isPending}
            onClick={() => generate({ source: 'github' })}
          >
            {releaseDraft.isPending
              ? 'Buscando...'
              : 'Última release do GitHub'}
          </Button>
          <Button
            type='button'
            size='xs'
            variant='ghost'
            onClick={() => setPasting((v) => !v)}
          >
            {pasting ? 'Fechar' : 'Colar notas'}
          </Button>
        </div>
      </div>

      {pasting && (
        <div className='space-y-2'>
          <Textarea
            placeholder={'## Novidades\n- feat(crm): ...\n- fix(whatsapp): ...'}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={6}
          />
          <div className='flex justify-end'>
            <Button
              type='button'
              size='xs'
              disabled={!markdown.trim() || releaseDraft.isPending}
              onClick={() => generate({ source: 'manual', markdown })}
            >
              Converter
            </Button>
          </div>
        </div>
      )}

      {summary && (
        <p className='text-muted-foreground text-xs'>
          {summary.release ? (
            <>
              Release{' '}
              <a
                href={summary.release.url}
                target='_blank'
                rel='noreferrer'
                className='underline'
              >
                {summary.release.tag}
              </a>
              {summary.release.fromCommits
                ? ' (notas vazias — itens montados a partir dos commits)'
                : ''}
              {' · '}
            </>
          ) : null}
          {summary.items.length} item(ns) gerado(s), {summary.skipped} linha(s)
          interna(s) removida(s).
        </p>
      )}
    </div>
  )
}

export default function NewChangelogPage() {
  const router = useRouter()
  const createChangelog = useCreateChangelog()

  const [subject, setSubject] = useState('')
  const [items, setItems] = useState<DraftItem[]>([newDraftItem()])
  const [selectedUsers, setSelectedUsers] = useState<
    ChangelogUserSearchResultDTO[]
  >([])
  const [manualEmails, setManualEmails] = useState('')

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) =>
      prev.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    )
  }

  function applyReleaseDraft(draft: ChangelogReleaseDraftDTO) {
    setSubject((prev) => prev.trim() || draft.subject)
    const drafted = draft.items.map((item) => ({ ...newDraftItem(), ...item }))
    // Substitui só se o admin ainda não escreveu nada; senão acrescenta.
    setItems((prev) =>
      prev.every((item) => !item.title.trim() && !item.body.trim())
        ? drafted
        : [...prev, ...drafted],
    )
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key))
  }

  const emailCount = parseManualEmails(manualEmails).length
  const recipientCount = selectedUsers.length + emailCount
  const canSubmit =
    subject.trim().length > 0 &&
    items.every((item) => item.title.trim() && item.body.trim()) &&
    items.length > 0 &&
    recipientCount > 0

  async function handleSubmit() {
    try {
      const changelog = await createChangelog.mutateAsync({
        subject: subject.trim(),
        items: items.map((item) => ({
          title: item.title.trim(),
          body: item.body.trim(),
          imageUrl: item.imageUrl,
        })),
        userIds: selectedUsers.map((u) => u.id),
        emails: parseManualEmails(manualEmails),
      })
      notify.success('Changelog criado como rascunho')
      router.push(`/admin/changelog/${changelog.id}`)
    } catch (error) {
      notify.error(error)
    }
  }

  return (
    <AdminPage className='max-w-3xl'>
      <AdminPageHeader
        title='Novo changelog'
        crumbs={[
          { label: 'Changelog', href: '/admin/changelog' },
          { label: 'Novo' },
        ]}
        description='Compõe um e-mail de novidades ou avisos e envia para um ou vários destinatários.'
      />

      <ReleaseDraftPanel onApply={applyReleaseDraft} />

      <Field>
        <FieldLabel>Assunto do e-mail</FieldLabel>
        <Input
          placeholder='Ex.: Novidades no Steel — Agosto 2026'
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        />
      </Field>

      <div className='space-y-4'>
        <div className='flex items-center justify-between'>
          <h2 className='font-medium text-sm'>Itens</h2>
          <Button
            type='button'
            size='xs'
            variant='outline'
            onClick={() => setItems((prev) => [...prev, newDraftItem()])}
          >
            <SteelIcon icon={PlusSignIcon} strokeWidth={2} />
            Adicionar item
          </Button>
        </div>

        {items.map((item, index) => (
          <div key={item.key} className='space-y-3 rounded-md border p-4'>
            <div className='flex items-center justify-between'>
              <span className='text-muted-foreground text-xs'>
                Item {index + 1}
              </span>
              {items.length > 1 && (
                <Button
                  type='button'
                  size='icon-xs'
                  variant='ghost'
                  onClick={() => removeItem(item.key)}
                >
                  <SteelIcon icon={Delete02Icon} strokeWidth={2} />
                </Button>
              )}
            </div>
            <FieldGroup>
              <Field>
                <FieldLabel>Título</FieldLabel>
                <Input
                  placeholder='Ex.: Política de Privacidade e Termos de Serviço'
                  value={item.title}
                  onChange={(e) =>
                    updateItem(item.key, { title: e.target.value })
                  }
                />
              </Field>
              <Field>
                <FieldLabel>Texto</FieldLabel>
                <Textarea
                  placeholder='Descreva a novidade ou o aviso...'
                  value={item.body}
                  onChange={(e) =>
                    updateItem(item.key, { body: e.target.value })
                  }
                  rows={4}
                />
              </Field>
              <ItemImageUpload
                imageUrl={item.imageUrl}
                onChange={(url) => updateItem(item.key, { imageUrl: url })}
              />
            </FieldGroup>
          </div>
        ))}
      </div>

      <div>
        <h2 className='mb-2 font-medium text-sm'>Destinatários</h2>
        <RecipientPicker
          selectedUsers={selectedUsers}
          onSelectedUsersChange={setSelectedUsers}
          manualEmails={manualEmails}
          onManualEmailsChange={setManualEmails}
        />
      </div>

      <div className='sticky bottom-0 -mx-4 flex flex-wrap items-center justify-between gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6'>
        <p className='text-muted-foreground text-sm'>
          {recipientCount} destinatário(s) selecionado(s)
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || createChangelog.isPending}
        >
          {createChangelog.isPending ? 'Criando...' : 'Criar rascunho'}
        </Button>
      </div>
    </AdminPage>
  )
}
