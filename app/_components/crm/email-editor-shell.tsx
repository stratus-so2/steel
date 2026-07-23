'use client'

import '@react-email/editor/themes/default.css'
import { EmailEditor, type EmailEditorRef } from '@react-email/editor'
import type { Content } from '@tiptap/core'
import { forwardRef } from 'react'

type Props = {
  initialContent?: Content
  placeholder?: string
}

const DEFAULT_PLACEHOLDER =
  "Pressione '/' e selecione um bloco para começar — ou escreva direto…"

/**
 * Wrapper fino do `EmailEditor` do react-email — só amarra props comuns e
 * estiliza o container. O parent pega o HTML/JSON pelo `ref`.
 *
 * Dark-mode: o CSS embarcado do editor escolhe a paleta por
 * `prefers-color-scheme`, mas o projeto usa `.dark` no <html>. Os overrides
 * em `app/globals.css` (`.dark .email-editor-shell`) mapeiam as variáveis
 * `--re-*` para os tokens do tema do Steel.
 */
export const EmailEditorShell = forwardRef<EmailEditorRef, Props>(
  function EmailEditorShell({ initialContent, placeholder }, ref) {
    return (
      <div className='email-editor-shell overflow-hidden rounded-lg border border-border bg-card'>
        <EmailEditor
          ref={ref}
          content={initialContent}
          placeholder={placeholder ?? DEFAULT_PLACEHOLDER}
        />
      </div>
    )
  },
)
