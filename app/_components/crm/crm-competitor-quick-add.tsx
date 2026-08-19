'use client'

import { Search01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { apiFetch } from '@/src/hooks/_fetch'
import { CRM_COMPETITOR_SYNCABLE_PLATFORMS } from '@/src/schemas/crm-competitor.schema'
import { CRM_SOCIAL_PLATFORM_LABELS } from '@/src/schemas/crm-social.schema'
import type {
  CrmCompetitorDTO,
  CrmCompetitorPreviewDTO,
} from '@/types/crm-competitor'

type SyncablePlatform = (typeof CRM_COMPETITOR_SYNCABLE_PLATFORMS)[number]

function formatFollowers(count: number): string {
  return new Intl.NumberFormat('pt-BR').format(count)
}

/**
 * Cadastro rápido de concorrente: busca nome, avatar, bio e seguidores a
 * partir do handle (Instagram/YouTube), usando o token da conta já
 * conectada no workspace. Fica fora do `DataTable` genérico para não
 * acoplar essa UX especial ao grid compartilhado por outros recursos do CRM.
 */
export function CrmCompetitorQuickAdd({
  workspaceId,
  onAdded,
}: {
  workspaceId: string
  onAdded: () => void
}) {
  const [open, setOpen] = useState(false)
  const [platform, setPlatform] = useState<SyncablePlatform>('INSTAGRAM')
  const [handle, setHandle] = useState('')
  const [preview, setPreview] = useState<CrmCompetitorPreviewDTO | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setHandle('')
    setPreview(null)
    setError(null)
  }

  async function handleSearch() {
    if (!handle.trim()) return
    setIsSearching(true)
    setError(null)
    setPreview(null)
    try {
      const data = await apiFetch<CrmCompetitorPreviewDTO>(
        `/api/workspaces/${workspaceId}/crm/competitors/preview`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform, handle }),
        },
        'Não foi possível buscar esse perfil.',
      )
      setPreview(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível buscar esse perfil.',
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setIsSaving(true)
    setError(null)
    try {
      await apiFetch<CrmCompetitorDTO>(
        `/api/workspaces/${workspaceId}/crm/competitors`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform,
            handle,
            displayName: preview.displayName,
            avatarUrl: preview.avatarUrl,
            bio: preview.bio,
            followersCount: preview.followersCount,
            profileUrl: preview.profileUrl,
          }),
        },
        'Não foi possível adicionar o concorrente.',
      )
      onAdded()
      setOpen(false)
      reset()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível adicionar o concorrente.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <PopoverTrigger
        render={
          <Button variant='outline' size='sm'>
            <SteelIcon icon={Search01Icon} size={14} />
            Buscar e adicionar
          </Button>
        }
      />
      <PopoverContent className='w-80 space-y-3' align='start'>
        <div className='flex gap-2'>
          <Select
            value={platform}
            onValueChange={(value) => {
              setPlatform(value as SyncablePlatform)
              setPreview(null)
            }}
          >
            <SelectTrigger size='sm' className='w-32 shrink-0'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {CRM_COMPETITOR_SYNCABLE_PLATFORMS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {CRM_SOCIAL_PLATFORM_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            placeholder='@concorrente'
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSearch()
            }}
          />
        </div>

        <Button
          size='sm'
          className='w-full'
          disabled={!handle.trim() || isSearching}
          onClick={handleSearch}
        >
          {isSearching ? 'Buscando…' : 'Buscar dados'}
        </Button>

        {error && <p className='text-destructive text-xs'>{error}</p>}

        {preview && (
          <div className='space-y-3 rounded-md border p-3'>
            <div className='flex items-center gap-2'>
              <Avatar className='size-9'>
                <AvatarImage src={preview.avatarUrl ?? undefined} />
                <AvatarFallback>
                  {handle.replace('@', '').slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className='min-w-0'>
                <p className='truncate text-sm font-medium'>
                  {preview.displayName ?? handle}
                </p>
                <p className='text-muted-foreground text-xs'>
                  {formatFollowers(preview.followersCount)} seguidores
                </p>
              </div>
            </div>
            {preview.bio && (
              <p className='text-muted-foreground line-clamp-2 text-xs'>
                {preview.bio}
              </p>
            )}
            <Button
              size='sm'
              className='w-full'
              disabled={isSaving}
              onClick={handleConfirm}
            >
              {isSaving ? 'Adicionando…' : 'Adicionar concorrente'}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
