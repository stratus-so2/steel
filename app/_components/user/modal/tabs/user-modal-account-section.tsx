'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field'
import { authClient } from '@/src/lib/auth-client'

type DeleteState = 'idle' | 'confirming' | 'pending'
type CancelState = 'idle' | 'pending'

interface ProfileResponse {
  success: boolean
  data: {
    deletionScheduledAt: string | null
    acceptedTermsAt: string | null
    acceptedPrivacyAt: string | null
  }
}

/**
 * Legal acceptances (LGPD) and the scheduled account deletion. Moved here
 * from the workspace "Geral" settings page, which now edits the workspace.
 */
export function UserModalAccountSection() {
  const [deletionScheduledAt, setDeletionScheduledAt] = useState<string | null>(
    null,
  )
  const [acceptedTermsAt, setAcceptedTermsAt] = useState<string | null>(null)
  const [acceptedPrivacyAt, setAcceptedPrivacyAt] = useState<string | null>(
    null,
  )
  const [deleteState, setDeleteState] = useState<DeleteState>('idle')
  const [cancelState, setCancelState] = useState<CancelState>('idle')
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const refreshProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/users/me', { cache: 'no-store' })
      if (!res.ok) return
      const json: ProfileResponse = await res.json()
      setDeletionScheduledAt(json.data.deletionScheduledAt)
      setAcceptedTermsAt(json.data.acceptedTermsAt)
      setAcceptedPrivacyAt(json.data.acceptedPrivacyAt)
    } catch {
      // ignore — the section just won't update; the user can reopen it
    }
  }, [])

  useEffect(() => {
    refreshProfile()
  }, [refreshProfile])

  async function handleDeleteAccount() {
    setDeleteError(null)
    setDeleteState('pending')
    try {
      const res = await fetch('/api/users/me', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setDeleteError(json?.message ?? 'Não foi possível agendar a exclusão')
        setDeleteState('confirming')
        return
      }
      // DB sessions are revoked server-side, but better-auth's cookie cache
      // (5 min) would keep this tab "logged in". Sign out on the client to
      // drop the cookie immediately.
      await authClient.signOut()
      window.location.href = '/'
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erro de rede')
      setDeleteState('confirming')
    }
  }

  async function handleCancelDeletion() {
    setDeleteError(null)
    setCancelState('pending')
    try {
      const res = await fetch('/api/users/me/deletion', { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        setDeleteError(json?.message ?? 'Não foi possível cancelar a exclusão')
        setCancelState('idle')
        return
      }
      setDeletionScheduledAt(null)
      setCancelState('idle')
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Erro de rede')
      setCancelState('idle')
    }
  }

  const scheduledDate = deletionScheduledAt
    ? new Date(deletionScheduledAt).toLocaleString('pt-BR')
    : null
  const termsDate = acceptedTermsAt
    ? new Date(acceptedTermsAt).toLocaleDateString('pt-BR')
    : null
  const privacyDate = acceptedPrivacyAt
    ? new Date(acceptedPrivacyAt).toLocaleDateString('pt-BR')
    : null

  return (
    <>
      <div className='space-y-2'>
        <div className='flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>Termos de Serviço</span>
          <span>
            {termsDate ? `Aceito em ${termsDate}` : 'Pendente de aceite'}
          </span>
        </div>
        <div className='flex items-center justify-between gap-3 text-sm'>
          <span className='text-muted-foreground'>Política de Privacidade</span>
          <span>
            {privacyDate ? `Aceita em ${privacyDate}` : 'Pendente de aceite'}
          </span>
        </div>
        <p className='text-sm text-muted-foreground'>
          Para revogar o aceite dos Termos ou da Política de Privacidade, você
          precisa excluir sua conta: não é possível manter a conta ativa sem
          esses aceites.
        </p>
      </div>

      <div className='space-y-3'>
        <Field orientation='horizontal'>
          <FieldContent>
            <FieldLabel className='text-destructive'>Excluir conta</FieldLabel>
            <FieldDescription>
              {scheduledDate
                ? `Exclusão agendada para ${scheduledDate}. Você pode cancelar a qualquer momento antes dessa data.`
                : 'A conta será agendada para exclusão. Suas sessões serão encerradas e você precisará entrar novamente para cancelar.'}
            </FieldDescription>
          </FieldContent>
          {scheduledDate ? (
            <Button
              type='button'
              variant='outline'
              onClick={handleCancelDeletion}
              disabled={cancelState === 'pending'}
            >
              {cancelState === 'pending'
                ? 'Cancelando...'
                : 'Cancelar exclusão'}
            </Button>
          ) : (
            deleteState === 'idle' && (
              <Button
                type='button'
                variant='destructive'
                onClick={() => setDeleteState('confirming')}
              >
                Excluir conta
              </Button>
            )
          )}
        </Field>
        {deleteError && (
          <p className='text-sm text-destructive'>{deleteError}</p>
        )}
        {!scheduledDate && deleteState !== 'idle' && (
          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              onClick={() => {
                setDeleteState('idle')
                setDeleteError(null)
              }}
              disabled={deleteState === 'pending'}
            >
              Cancelar
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={handleDeleteAccount}
              disabled={deleteState === 'pending'}
            >
              {deleteState === 'pending'
                ? 'Agendando...'
                : 'Confirmar exclusão'}
            </Button>
          </div>
        )}
      </div>
    </>
  )
}
