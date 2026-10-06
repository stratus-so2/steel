import { useEffect, useRef } from 'react'

/**
 * Opens a record from the `?record=<id>` query param (deep links from the
 * notification inbox). Reads `window.location` after mount — no
 * `useSearchParams`, so pages need no Suspense boundary — and calls `open`
 * once, as soon as `isAvailable(id)` says the record is loaded.
 */
export function useRecordParam(
  open: (id: string) => void,
  isAvailable: (id: string) => boolean,
): void {
  const consumed = useRef(false)

  useEffect(() => {
    if (consumed.current) return
    const id = new URLSearchParams(window.location.search).get('record')
    if (!id) {
      consumed.current = true
      return
    }
    if (!isAvailable(id)) return
    consumed.current = true
    open(id)
  }, [open, isAvailable])
}
