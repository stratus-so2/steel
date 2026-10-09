'use client'

import { useCallback, useReducer } from 'react'

/**
 * Undo/redo for the e-mail builder. Consecutive edits of the same field
 * (`group`) within `COALESCE_MS` become a single step, so undo reverts a
 * typed word or sentence, not one keystroke.
 */

export const COALESCE_MS = 800
const LIMIT = 100

export type History<T> = {
  past: T[]
  present: T
  future: T[]
  lastGroup: string | null
  lastAt: number
}

export type HistoryAction<T> =
  | { type: 'set'; value: T; group?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; value: T }

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, future: [], lastGroup: null, lastAt: 0 }
}

export function historyReducer<T>(
  state: History<T>,
  action: HistoryAction<T>,
): History<T> {
  switch (action.type) {
    case 'set': {
      if (action.value === state.present) return state
      const coalesce =
        action.group !== undefined &&
        action.group === state.lastGroup &&
        action.at - state.lastAt < COALESCE_MS
      return {
        past: coalesce
          ? state.past
          : [...state.past, state.present].slice(-LIMIT),
        present: action.value,
        future: [],
        lastGroup: action.group ?? null,
        lastAt: action.at,
      }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (previous === undefined) return state
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
        lastGroup: null,
        lastAt: 0,
      }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (next === undefined) return state
      return {
        past: [...state.past, state.present],
        present: next,
        future: rest,
        lastGroup: null,
        lastAt: 0,
      }
    }
    case 'reset':
      return initHistory(action.value)
  }
}

export function useBuilderHistory<T>(initial: T) {
  const [state, dispatch] = useReducer(
    historyReducer<T>,
    initial,
    initHistory<T>,
  )
  const set = useCallback(
    (value: T, group?: string) =>
      dispatch({ type: 'set', value, group, at: Date.now() }),
    [],
  )
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  const reset = useCallback(
    (value: T) => dispatch({ type: 'reset', value }),
    [],
  )
  return {
    value: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  }
}
