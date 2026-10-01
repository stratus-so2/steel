import z from 'zod'

/**
 * Mensagens padrão do Zod em **pt-BR**. Sem isto, o que escapa de uma
 * mensagem customizada chega ao usuário em inglês ("Invalid input: expected
 * string, received number") — as `issues` vão no `details` do
 * `VALIDATION_ERROR` e aparecem nos formulários.
 *
 * Módulo só de efeito: importe (`import '@/src/lib/zod-locale'`) nas entradas
 * — layout do app, helper de resposta HTTP das rotas, worker e setup dos
 * testes. Mensagens específicas em cada schema continuam valendo.
 */
z.config(z.locales.pt())
