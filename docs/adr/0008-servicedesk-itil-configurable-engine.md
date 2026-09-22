# 0008 — ServiceDesk ITIL 4 com motor configurável por workspace

- **Status:** Aceita
- **Data:** 2026-09-21
- **Decisores:** dono do produto

## Contexto

O módulo `SERVICE_DESK` era só uma casca. O pedido é um ServiceDesk que siga
o ITIL (incidente, requisição, mudança e problema, cada um com suas fases),
com visões kanban/lista/tabela, SLA, aprovação, escalonamento,
rastreabilidade, assinatura, base de conhecimento, WhatsApp, agente de IA e
dashboards — e **o máximo de customização possível**, porque cada workspace
(cliente da Stratus) atende de um jeito.

## Decisão

Construir o ServiceDesk como **um motor com semântica fixa e configuração em
tabelas**, seguindo as práticas do ITIL 4:

| Prática ITIL 4 | No Steel |
| -------------- | -------- |
| Service Desk | portal do solicitante, histórico/chat, WhatsApp, IA de pré-atendimento |
| Incident Management | `SdTicket.type = INCIDENT` |
| Service Request Management | `SERVICE_REQUEST` + modelos (`SdTicketTemplate`) + catálogo |
| Change Enablement | `CHANGE` + tipo (padrão/normal/emergencial), risco, janela, planos, aprovação (CAB) |
| Problem Management | `PROBLEM` + causa raiz, contorno, erro conhecido; incidentes como itens filhos |
| Service Level Management | `SdSlaPolicy` (SLA/OLA) × prioridade, calendário de expediente + feriados, pausa |
| Service Catalogue Management | `SdCategory` categoria > subcategoria > serviço |
| Service Configuration Management | CMDB: `SdConfigItem` + tipos customizáveis + hierarquia |
| Knowledge Management | `SdKbArticle` (Wiki do Nexo) + vínculo com chamados (KCS) |

Regras de desenho:

1. **Enum só para o que o motor precisa entender** (`SdTicketType`,
   `SdPhaseCategory`, canais, status de aprovação…). Tudo o que é "nome e
   cor" é tabela por workspace: fases (com % 0–100, WIP, campos obrigatórios,
   aprovação exigida, pausa de SLA), transições (sem transição = fluxo
   livre), impacto, urgência, **matriz impacto × urgência → prioridade**,
   severidade, classificações (do chamado e da solução), categorias, SLAs,
   calendários, regras de escalonamento, regras de automação
   (evento → condições → ações), campos customizados por entidade/tipo/
   categoria, modelos de chamado, respostas prontas, peças.
2. **Seed ITIL na liberação do módulo**: ao habilitar `SERVICE_DESK`,
   `WorkspaceModuleAccessService` semeia fases por tipo, matriz 3×3,
   prioridades P1–P4, severidades, classificações, calendário 8×5 com
   feriados nacionais, SLA padrão, tipos de CI, e os dois dashboards padrão
   (Analítico e KPIs/TV). Idempotente.
3. **Agente × solicitante**: além da matriz RBAC (`sd-*`), quem está em ao
   menos um departamento (`SdDepartmentMember`) é **agente** e vê a fila; os
   demais membros com acesso ao módulo são **solicitantes** e usam o portal
   (abrem chamados e veem só os próprios / em que participam).
4. **Cliente e Empresa** são o mesmo cadastro (`SdCustomer.kind` =
   `CLIENT`/`COMPANY`), com CPF/CNPJ validado e endereço via ViaCEP; o
   chamado tem os dois FKs. Contato (`SdContact`) liga-se a um ou mais.
5. **Rastreabilidade** é um log append-only (`SdTicketEvent`) gravado pelo
   próprio service a cada mudança — a aba "Rastreabilidade" só renderiza.
6. **SLA em minutos úteis**: prazos calculados por uma lib pura
   (`src/lib/servicedesk/sla.ts`) sobre o calendário da política; fases
   `pausesSla` congelam o relógio; o worker (`servicedesk-sla`, 1 min) marca
   risco/violação e dispara escalonamento/automação.
7. **Reuso**: dashboards usam o motor do CRM (`CrmDashboard.module =
   SERVICE_DESK`); WhatsApp usa `WhatsAppConnection` com `module =
   SERVICE_DESK` e a conversa é vinculada ao chamado; IA usa `src/lib/ai`
   (ADR 0007) com cota e features próprias (`SERVICEDESK_*`).

## Consequências

- Customização alta sem migration: novos nomes, fluxos e regras são linhas.
- O motor fica mais complexo (validação de transição, avaliação de condições,
  SLA com calendário) e precisa de testes fortes — coberto pelo piso de 95%.
- Enums novos de semântica (ex.: outra prática ITIL) exigem migration e ADR.
- Revisitar: CSAT/pesquisa, e-mail de entrada (abrir chamado por e-mail),
  OLA por departamento em paralelo ao SLA e billing de custos.
