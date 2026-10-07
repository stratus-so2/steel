'use client'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'

/** Atalhos da caixa de entrada (abre com `?`). */
export const NOTIFICATION_SHORTCUTS: { keys: string[]; label: string }[] = [
  { keys: ['j'], label: 'Próxima notificação' },
  { keys: ['k'], label: 'Notificação anterior' },
  { keys: ['Enter'], label: 'Abrir a notificação em foco' },
  { keys: ['u'], label: 'Voltar para a lista' },
  { keys: ['e'], label: 'Arquivar (ou desarquivar)' },
  { keys: ['r'], label: 'Marcar como lida / não lida' },
  { keys: ['s'], label: 'Adiar (1–4 escolhem o horário)' },
  { keys: ['#'], label: 'Excluir' },
  { keys: ['x'], label: 'Selecionar / desmarcar' },
  { keys: ['i'], label: 'Pendências da IA' },
  { keys: ['/'], label: 'Buscar' },
  { keys: ['?'], label: 'Mostrar estes atalhos' },
  { keys: ['Esc'], label: 'Sair da busca ou limpar a seleção' },
]

export function NotificationShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Atalhos do teclado</DialogTitle>
          <DialogDescription>
            A caixa de entrada responde aos mesmos atalhos de um cliente de
            e-mail.
          </DialogDescription>
        </DialogHeader>
        <ul className='space-y-2'>
          {NOTIFICATION_SHORTCUTS.map((shortcut) => (
            <li
              key={shortcut.label}
              className='flex items-center justify-between gap-4 text-sm'
            >
              <span className='text-muted-foreground'>{shortcut.label}</span>
              <span className='flex gap-1'>
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
