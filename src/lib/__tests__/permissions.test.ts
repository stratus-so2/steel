import { describe, expect, it } from 'vitest'
import {
  can,
  ROLE_TO_SYSTEM_KEY,
  SYSTEM_PROFILE_PERMISSIONS,
  SYSTEM_PROFILES,
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

describe('matriz do Visualizador (VIEWER)', () => {
  const m = SYSTEM_PROFILE_PERMISSIONS.VIEWER

  it('só visualiza — nunca cria, edita ou exclui', () => {
    for (const [resource, actions] of Object.entries(m)) {
      expect(
        actions?.every((a) => a === 'VIEW'),
        resource,
      ).toBe(true)
    }
    expect(can(m, 'companies', 'VIEW')).toBe(true)
    expect(can(m, 'conversations', 'VIEW')).toBe(true)
    expect(can(m, 'companies', 'CREATE')).toBe(false)
  })

  it('não enxerga membros, configurações nem integrações', () => {
    expect(can(m, 'members', 'VIEW')).toBe(false)
    expect(can(m, 'settings', 'VIEW')).toBe(false)
    expect(can(m, 'integrations', 'VIEW')).toBe(false)
  })

  it('é semeado como perfil de sistema e mapeado do papel', () => {
    expect(SYSTEM_PROFILES.map((p) => p.systemKey)).toContain('VIEWER')
    expect(ROLE_TO_SYSTEM_KEY.VIEWER).toBe('VIEWER')
  })
})

describe('Comunicação', () => {
  it('Membro conversa mas não cria transmissões/templates nem exclui conversas', () => {
    const m = SYSTEM_PROFILE_PERMISSIONS.MEMBER
    expect(can(m, 'conversations', 'CREATE')).toBe(true)
    expect(can(m, 'conversations', 'DELETE')).toBe(false)
    expect(can(m, 'broadcasts', 'VIEW')).toBe(true)
    expect(can(m, 'broadcasts', 'CREATE')).toBe(false)
    expect(can(m, 'message-templates', 'CREATE')).toBe(false)
  })

  it('Admin tem acesso total', () => {
    const m = SYSTEM_PROFILE_PERMISSIONS.ADMIN
    expect(can(m, 'broadcasts', 'CREATE')).toBe(true)
    expect(can(m, 'conversations', 'DELETE')).toBe(true)
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
