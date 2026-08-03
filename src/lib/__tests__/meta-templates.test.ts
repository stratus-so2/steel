import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMetaTemplate } from '../whatsapp/meta-templates'

describe('createMetaTemplate()', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should always send parameter_format: POSITIONAL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'PENDING' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await createMetaTemplate({
      wabaId: 'waba-1',
      accessToken: 'token',
      name: 'confirmacao_exame',
      language: 'pt_BR',
      category: 'UTILITY',
      components: [{ type: 'BODY', text: 'Olá {{1}}' }],
    })

    const [, options] = fetchMock.mock.calls[0]
    const sentBody = JSON.parse(options.body)
    expect(sentBody.parameter_format).toBe('POSITIONAL')
  })

  it('should throw with Meta error message on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Nome já existe' } }),
      }),
    )

    await expect(
      createMetaTemplate({
        wabaId: 'waba-1',
        accessToken: 'token',
        name: 'confirmacao_exame',
        language: 'pt_BR',
        category: 'UTILITY',
        components: [],
      }),
    ).rejects.toThrow('Nome já existe')
  })
})
