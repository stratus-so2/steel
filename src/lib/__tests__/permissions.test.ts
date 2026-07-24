import { describe, expect, it } from 'vitest'
import {
  can,
  SYSTEM_PROFILE_PERMISSIONS,
  sanitizePermissions,
} from '../permissions'

describe('permissions matrizes de sistema', () => {
  it('OWNER e ADMIN têm acesso total', () => {
    for (const key of ['OWNER', 'ADMIN']) {
      const m = SYSTEM_PROFILE_PERMISSIONS[key]
      expect(can(m, 'companies', 'DELETE')).toBe(true)
      expect(can(m, 'members', 'EDIT')).toBe(true)
      expect(can(m, 'settings', 'DELETE')).toBe(true)
    }
  })

  it('MEMBER cria/edita entidades mas não exclui nem gere acesso', () => {
    const m = SYSTEM_PROFILE_PERMISSIONS.MEMBER
    expect(can(m, 'companies', 'CREATE')).toBe(true)
    expect(can(m, 'companies', 'EDIT')).toBe(true)
    expect(can(m, 'companies', 'DELETE')).toBe(false)
    expect(can(m, 'members', 'EDIT')).toBe(false)
    expect(can(m, 'settings', 'VIEW')).toBe(false)
    // recursos de config: somente leitura
    expect(can(m, 'pipelines', 'VIEW')).toBe(true)
    expect(can(m, 'pipelines', 'EDIT')).toBe(false)
  })
})

describe('sanitizePermissions', () => {
  it('descarta recursos e ações inválidos', () => {
    const out = sanitizePermissions({
      companies: ['VIEW', 'FLY'],
      invoices: ['VIEW'],
      people: 'x',
    })
    expect(out.companies).toEqual(['VIEW'])
    expect(out.invoices).toBeUndefined()
    expect(out.people).toBeUndefined()
  })

  it('remove duplicatas', () => {
    const out = sanitizePermissions({ companies: ['VIEW', 'VIEW', 'EDIT'] })
    expect(out.companies).toEqual(['VIEW', 'EDIT'])
  })
})
