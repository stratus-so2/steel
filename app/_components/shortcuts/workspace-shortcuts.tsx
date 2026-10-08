'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { AskSteelAiDialog } from '@/app/_components/steel-ai-ask/ask-steel-ai-dialog'
import { notify } from '@/lib/notify'
import { useSteelAiCapabilities } from '@/src/hooks/use-steel-ai'
import { useUserPreferences } from '@/src/hooks/use-user-preferences'
import { ShortcutsCheatSheet } from './shortcuts-cheat-sheet'
import {
  isTypingTarget,
  ShortcutsProvider,
  topOverlay,
  useShortcut,
} from './shortcuts-provider'
import {
  useCommandNavigate,
  type WorkspaceCommand,
  workspaceCommands,
} from './workspace-commands'

function CommandShortcut({
  command,
  enabled,
  go,
}: {
  command: WorkspaceCommand
  enabled: boolean
  go: (href: string) => void
}) {
  useShortcut(command.id, () => go(command.href), { enabled })
  return null
}

/** "Sobre a tela Incidentes · ServiceDesk": the page title as context. */
export function screenLabel(title: string): string {
  const parts = title
    .split('|')
    .map((part) => part.trim())
    .filter((part) => part && part !== 'Steel')
  return parts.join(' · ') || 'atual'
}

function BuiltinShortcuts({
  slug,
  workspaceId,
  wikiEnabled,
}: {
  slug: string
  workspaceId: string
  wikiEnabled: boolean
}) {
  const go = useCommandNavigate()
  const capabilities = useSteelAiCapabilities(workspaceId)
  const modules = capabilities.data?.modules ?? []
  const [asking, setAsking] = useState<string | null>(null)

  // Esc inside a plain field leaves it, giving the single keys back.
  useShortcut('global.escape', (event) => {
    const target = event.target
    if (!isTypingTarget(target) || !(target instanceof HTMLElement))
      return false
    if (target.isContentEditable) return false
    target.blur()
  })

  // Ctrl+Enter submits the form in focus (dialogs, sheets, settings).
  useShortcut('global.submit', (event) => {
    const target = event.target
    const form =
      target instanceof Element
        ? target.closest('form')
        : (topOverlay()?.querySelector('form') ?? null)
    if (!form) return false
    if (form.querySelector('[type="submit"]:disabled')) return false
    form.requestSubmit()
  })

  // Ctrl+S: the screen's Save button (`data-shortcut-save`, the open dialog
  // first), else the focused form. Elsewhere the browser keeps its Ctrl+S.
  useShortcut('global.save', (event) => {
    const scope: ParentNode = topOverlay() ?? document
    const buttons = [
      ...scope.querySelectorAll<HTMLButtonElement>(
        '[data-shortcut-save]:not(:disabled)',
      ),
    ]
    const button = buttons.at(-1)
    if (button) {
      button.click()
      return
    }
    const form =
      event.target instanceof Element ? event.target.closest('form') : null
    if (!form?.querySelector('[type="submit"]:not(:disabled)')) return false
    form.requestSubmit()
  })

  useShortcut('global.copy-link', () => {
    void navigator.clipboard
      ?.writeText(window.location.href)
      .then(() => notify.success('Link copiado'))
      .catch(() => notify.error('Não foi possível copiar o link'))
  })

  // Record screens bind their own `global.ask-ai` with the record as
  // context; this fallback asks about the screen.
  useShortcut('global.ask-ai', () => setAsking(screenLabel(document.title)), {
    enabled: capabilities.data?.aiEnabled ?? false,
  })

  const commands = workspaceCommands(slug)
  return (
    <>
      {commands.map((command) => (
        <CommandShortcut
          key={command.id}
          command={command}
          go={go}
          enabled={
            (!command.module || modules.includes(command.module)) &&
            (!command.wiki || wikiEnabled)
          }
        />
      ))}
      {asking ? (
        <AskSteelAiDialog
          open
          onOpenChange={(open) => {
            if (!open) setAsking(null)
          }}
          workspaceId={workspaceId}
          slug={slug}
          reference={{ kind: 'page', label: asking }}
        />
      ) : null}
    </>
  )
}

/**
 * Keyboard shortcuts of the workspace shell: the provider (with the user's
 * "Atalhos de uma tecla" preference), the global bindings and the cheat
 * sheet. Mounted once by the workspace layout.
 */
export function WorkspaceShortcuts({
  slug,
  workspaceId,
  wikiEnabled = false,
  children,
}: {
  slug: string
  workspaceId: string
  wikiEnabled?: boolean
  children: ReactNode
}) {
  const preferences = useUserPreferences()
  const router = useRouter()
  return (
    <ShortcutsProvider
      navigate={router.push}
      singleKeyEnabled={preferences.data?.singleKeyShortcuts ?? true}
      quickSendMode={preferences.data?.quickSendShortcut ?? 'ENTER'}
    >
      <BuiltinShortcuts
        slug={slug}
        workspaceId={workspaceId}
        wikiEnabled={wikiEnabled}
      />
      {children}
      <ShortcutsCheatSheet />
    </ShortcutsProvider>
  )
}
