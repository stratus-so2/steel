import { cleanup, configure } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

// jsdom lacks a handful of layout/browser APIs that Base UI, input-otp,
// cmdk and friends touch on mount. Minimal no-op polyfills keep those
// components renderable; tests assert behavior, never layout.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
class IntersectionObserverStub {
  readonly root = null
  readonly rootMargin = ''
  readonly thresholds: number[] = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}

if (typeof window !== 'undefined') {
  if (!('ResizeObserver' in window)) {
    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: ResizeObserverStub,
    })
    Object.defineProperty(globalThis, 'ResizeObserver', {
      writable: true,
      value: ResizeObserverStub,
    })
  }
  if (!('IntersectionObserver' in window)) {
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: IntersectionObserverStub,
    })
    Object.defineProperty(globalThis, 'IntersectionObserver', {
      writable: true,
      value: IntersectionObserverStub,
    })
  }
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }
  const proto = window.HTMLElement.prototype as unknown as Record<
    string,
    unknown
  >
  proto.scrollIntoView ??= () => {}
  proto.hasPointerCapture ??= () => false
  proto.setPointerCapture ??= () => {}
  proto.releasePointerCapture ??= () => {}
  // `document.elementFromPoint` is used by input-otp to detect password
  // managers; jsdom does not implement it.
  if (!document.elementFromPoint) {
    document.elementFromPoint = () => null
  }
  window.scrollTo ??= () => {}
}

// `findBy*`/`waitFor` default to 1s, which the heavier screens (data grid,
// dialogs) can miss on a busy CI runner.
configure({ asyncUtilTimeout: 3000 })

// Unmount any rendered tree and reset mocks between component tests so a
// previous render's DOM never leaks into the next assertion.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})
