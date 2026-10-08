export type Theme = 'LIGHT' | 'DARK' | 'SYSTEM'
export type QuickSendShortcut = 'ENTER' | 'CTRL_ENTER'

export interface UserPreferenceDTO {
  theme: Theme,
  smoothCursor: boolean,
  quickSendShortcut: QuickSendShortcut,
  timezone: string,
  weekStartsOn: number,
  weekendDays: number[],
  /** "Atalhos de uma tecla" (WCAG 2.1.4): off keeps only Ctrl/Alt/⌘ ones. */
  singleKeyShortcuts: boolean
}
