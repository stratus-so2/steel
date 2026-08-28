import 'dotenv/config'
import { vi } from 'vitest'

// `next/font/google` só resolve fontes de verdade via o transform SWC do
// Next.js — fora do build (aqui, sob Vitest) os exports vêm vazios. Mocka
// qualquer função de fonte pra devolver um objeto com `className`/`variable`
// utilizáveis, sem travar em fontes específicas (ex. `Rubik` do template
// Agency) conforme novos templates adicionem outras.
function mockFont(name: string) {
  return () => ({
    className: `mock-font-${name}`,
    style: { fontFamily: name },
    variable: `--font-${name.toLowerCase()}`,
  })
}

// `next/font/google` só resolve fontes de verdade via o transform SWC do
// Next.js — fora do build (aqui, sob Vitest) os exports vêm vazios. O Vitest
// exige que os named exports do mock existam estaticamente (Proxy sem
// `ownKeys` real não resolve `import { X }`), então cada fonte usada no
// projeto precisa entrar aqui explicitamente.
vi.mock('next/font/google', () => ({
  Rubik: mockFont('Rubik'),
}))
