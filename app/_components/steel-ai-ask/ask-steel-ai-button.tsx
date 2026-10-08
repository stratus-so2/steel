'use client'

import { AiMagicIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useRef, useState } from 'react'
import { ShortcutHint } from '@/app/_components/shortcuts/shortcut-kbd'
import { useShortcut } from '@/app/_components/shortcuts/shortcuts-provider'
import { SteelIcon } from '@/components/icon/icon'
import { Button } from '@/components/ui/button'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { AskSteelAiDialog } from './ask-steel-ai-dialog'
import type { AskSteelAiReference } from './ask-steel-ai-prompt'

export const ASK_STEEL_AI_LABEL = 'Perguntar ao Steel AI'

export interface AskSteelAiButtonProps {
  workspaceId: string
  slug?: string
  reference: AskSteelAiReference
  className?: string
}

/** Quiet icon button for record headers; opens the ask dialog. */
export function AskSteelAiButton({
  workspaceId,
  slug,
  reference,
  className,
}: AskSteelAiButtonProps) {
  const [open, setOpen] = useState(false)
  // Ctrl+I asks about this record (also inside the record's sheet).
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  useShortcut('global.ask-ai', () => setOpen(true), { ref: buttonRef })

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              ref={buttonRef}
              type='button'
              variant='ghost'
              size='icon-sm'
              aria-label={ASK_STEEL_AI_LABEL}
              className={className}
              onClick={() => setOpen(true)}
            >
              <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
            </Button>
          }
        />
        <TooltipContent>
          <ShortcutHint id='global.ask-ai' label={ASK_STEEL_AI_LABEL} />
        </TooltipContent>
      </Tooltip>
      {open ? (
        <AskSteelAiDialog
          open
          onOpenChange={setOpen}
          workspaceId={workspaceId}
          slug={slug}
          reference={reference}
        />
      ) : null}
    </>
  )
}

/**
 * Menu entry for a "⋯" dropdown. The dialog lives outside the menu (the
 * menu unmounts on close), so the screen renders `AskSteelAiDialog` itself
 * — only while open — and passes `onSelect` to open it.
 */
export function AskSteelAiMenuItem({ onSelect }: { onSelect: () => void }) {
  return (
    <DropdownMenuItem onClick={onSelect}>
      <SteelIcon icon={AiMagicIcon} strokeWidth={2} />
      {ASK_STEEL_AI_LABEL}
    </DropdownMenuItem>
  )
}
