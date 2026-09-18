# 0006 — Assistente de IA central roda Claude via Claude Code em container; dados pessoais de clientes proibidos nos prompts

- **Status:** Aceita
- **Data:** 2026-09-13
- **Decisores:** dono do produto

## Contexto

Além das funcionalidades de IA dentro do produto (IA do CRM, resposta
automática e sentimento no WhatsApp), a Stratus quer um **assistente central**
de uso interno (operação, suporte, engenharia) com acesso a ferramentas —
repositório, logs, documentação — e não só a um chat.

O Steel guarda dados pessoais de clientes (contatos do CRM, conversas de
WhatsApp, e-mails), sujeitos à LGPD.

## Decisão

1. O assistente central roda o **Claude via Claude Code dentro de um
   container** dedicado, isolado da aplicação (sem montar volumes de dados de
   produção, sem credenciais do banco de produção).
2. **É proibido colocar dados pessoais de clientes nos prompts** do
   assistente central: nomes, telefones, e-mails, CPF/CNPJ de pessoa física,
   conteúdo de conversas, anexos. Para investigar um caso, use IDs internos
   (cuid) e dados agregados/anonimizados.

## Consequências

- O assistente tem ferramentas de verdade (lê código, roda comandos no
  container) sem abrir acesso aos dados de clientes.
- A regra é de **processo**, não técnica: quem usa o assistente é responsável
  por não colar dados pessoais. Treinar o time; incidentes de vazamento
  seguem o fluxo de incidente LGPD.
- As funcionalidades de IA **dentro do produto** que processam dados do
  próprio cliente (a pedido dele) seguem outra regra — ver
  [0007](./0007-multi-provider-ai-per-workspace.md).
