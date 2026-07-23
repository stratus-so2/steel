'use client'

import { Extension } from '@tiptap/core'
import { ReactRenderer } from '@tiptap/react'
import Suggestion, {
  type SuggestionKeyDownProps,
  type SuggestionProps,
} from '@tiptap/suggestion'
import * as React from 'react'
import {
  type InsertItem,
  SLASH_ITEMS,
} from '@/app/_components/crm/rich-text/insert-items'
import { SteelIcon } from '@/components/icon/icon'
import { cn } from '@/lib/utils'

type MenuRef = { onKeyDown: (props: SuggestionKeyDownProps) => boolean }

const SlashMenu = React.forwardRef<MenuRef, SuggestionProps<InsertItem>>(
  function SlashMenu({ items, command }, ref) {
    const [selected, setSelected] = React.useState(0)

    React.useEffect(() => setSelected(0), [items])

    const pick = React.useCallback(
      (index: number) => {
        const item = items[index]
        if (item) command(item)
      },
      [items, command],
    )

    React.useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          setSelected((s) => (s + items.length - 1) % items.length)
          return true
        }
        if (event.key === 'ArrowDown') {
          setSelected((s) => (s + 1) % items.length)
          return true
        }
        if (event.key === 'Enter') {
          pick(selected)
          return true
        }
        return false
      },
    }))

    if (!items.length) {
      return (
        <div className='rounded-md bg-popover p-2 text-muted-foreground text-sm shadow-md ring-1 ring-foreground/10'>
          Nenhum bloco
        </div>
      )
    }

    return (
      <div className='max-h-72 w-56 overflow-y-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10'>
        {items.map((item, index) => (
          <button
            type='button'
            key={item.key}
            onMouseEnter={() => setSelected(index)}
            onClick={() => pick(index)}
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
              index === selected
                ? 'bg-accent text-accent-foreground'
                : 'text-foreground',
            )}
          >
            <SteelIcon
              icon={item.icon}
              strokeWidth={2}
              className='size-4 shrink-0 text-muted-foreground'
            />
            <span className='truncate'>{item.title}</span>
          </button>
        ))}
      </div>
    )
  },
)

/** Posiciona um popup fixo no caret a partir do retângulo do cliente. */
function place(popup: HTMLElement, rect: DOMRect | null) {
  if (!rect) return
  popup.style.position = 'fixed'
  popup.style.left = `${rect.left}px`
  popup.style.top = `${rect.bottom + 6}px`
  popup.style.zIndex = '60'
}

/** Extensão de menu de barra ("/") com a lista de blocos. */
export const SlashCommand = Extension.create({
  name: 'slashCommand',
  addProseMirrorPlugins() {
    return [
      Suggestion<InsertItem>({
        editor: this.editor,
        char: '/',
        command: ({ editor, range, props }) => {
          editor.chain().focus().deleteRange(range).run()
          props.action(editor)
        },
        items: ({ query }) => {
          const q = query.toLowerCase()
          return SLASH_ITEMS.filter((item) =>
            `${item.title} ${item.keywords ?? ''}`.toLowerCase().includes(q),
          )
        },
        render: () => {
          let component: ReactRenderer<
            MenuRef,
            SuggestionProps<InsertItem>
          > | null = null
          let popup: HTMLDivElement | null = null

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashMenu, {
                props,
                editor: props.editor,
              })
              popup = document.createElement('div')
              popup.appendChild(component.element)
              document.body.appendChild(popup)
              place(popup, props.clientRect?.() ?? null)
            },
            onUpdate: (props) => {
              component?.updateProps(props)
              if (popup) place(popup, props.clientRect?.() ?? null)
            },
            onKeyDown: (props) => {
              if (props.event.key === 'Escape') {
                popup?.remove()
                return true
              }
              return component?.ref?.onKeyDown(props) ?? false
            },
            onExit: () => {
              popup?.remove()
              popup = null
              component?.destroy()
              component = null
            },
          }
        },
      }),
    ]
  },
})
