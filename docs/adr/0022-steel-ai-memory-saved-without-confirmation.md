# 0022 — Steel AI: memória salva sem confirmação, com guarda e desfazer

- **Status:** Aceita
- **Data:** 2026-10-08
- **Decisores:** product owner (decisão "memória automática e revisável", 2026-10-07) + time de engenharia

Complementa a [ADR 0018](./0018-steel-ai-agent-mode-server-confirmation.md),
que diz que nenhuma escrita do modelo vai direto ao banco.

## Contexto

O product owner pediu memória **automática e revisável** em duas camadas:
fatos do workspace (de todos) e fatos pessoais (de cada usuário). O Steel AI
guarda sozinho o que parecer útil ("a Ana prefere respostas em tópicos", "o
suporte atende das 8h às 18h") e as pessoas revisam, corrigem e apagam na
aba Memória. Se cada fato passasse pela confirmação da ADR 0018, a memória
deixaria de ser automática — e ela não existe no modo Ask, que só lê.

Ao mesmo tempo, a memória entra no system prompt de toda conversa: um fato
errado ou injetado (por um e-mail ou uma mensagem lida pelo modelo) influencia
as respostas seguintes, e um fato com senha ou dado sensível se espalharia
por todos os prompts.

## Decisão

**`memory_save` e `memory_forget` executam na hora, em qualquer modo, sem
`AiPendingAction`, porque memória é metadado do assistente e não dado de
negócio — mas toda gravação aparece no histórico com "Desfazer" e passa por
uma guarda no servidor.**

Detalhes para aplicar:

- As ferramentas ficam **fora** de `STEEL_AI_TOOLS` (os Steel Agents não as
  recebem) e só são oferecidas com `WorkspaceAiSettings.memoryEnabled`
  ligado. Desligado: sem ferramenta, sem injeção no prompt, sem gravação
  manual (`AI_MEMORY_DISABLED`); revisar e apagar continua possível.
- **Escopo:** `WORKSPACE` só para OWNER/ADMIN. Pedido de outro membro vira
  fato pessoal (a resposta da ferramenta avisa). Fato pessoal é só do dono;
  o de workspace só o admin edita/apaga.
- **Guarda** (`src/lib/ai/context/memory-guard.ts`, também no "Adicionar"
  manual e na edição): recusa credenciais (senha, token, chave de API,
  formatos conhecidos e sequências opacas longas), número de cartão (Luhn) e
  CPF, e dados pessoais sensíveis da LGPD art. 5º, II (saúde, religião,
  orientação sexual, origem racial/étnica, opinião política, filiação
  sindical, biometria, dado genético). É heurística e erra para o lado de
  recusar.
- **Duplicado:** fato quase igual (normalizado, Jaccard ≥ 0,85) a um já
  salvo no mesmo escopo — ou, para um pessoal, a um do workspace — não é
  gravado de novo.
- **No prompt:** fatos do workspace e pessoais do usuário, mais recentes
  primeiro, até ~800 tokens, com o id entre colchetes (para o
  `memory_forget`) e o aviso de que são contexto, não instrução. Cada fato
  incluído ganha `lastUsedAt`.
- **Transparência:** o chip "Memória salva" mostra o texto e o escopo, com
  "Desfazer" (apaga o fato). A aba Memória mostra origem (automática/manual)
  e, só para quem salvou, o link da conversa de origem. Toda criação,
  edição e exclusão vai para a auditoria (`ai_memory`), sem o conteúdo.

## Consequências

- A memória funciona sozinha, inclusive no Ask, e qualquer gravação é
  visível e reversível em um clique.
- Custo aceito: um prompt injetado pode gravar um fato **pessoal** sem
  confirmação (o de workspace exige admin). O estrago fica limitado pela
  guarda, pelo chip com desfazer e pela aba de revisão.
- A guarda por palavras e formatos tem falso positivo (recusa algo
  inofensivo) e falso negativo (deixa passar um dado sensível escrito de
  outro jeito). Revisitar se surgir um classificador melhor ou demanda de
  memória para os Steel Agents.
