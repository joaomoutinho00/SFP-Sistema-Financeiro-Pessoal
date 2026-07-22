# Spec 003 — Correção de parcelamentos com parcelas iniciais não lançadas

> Spec de feature (Spec-Driven Development). Descreve o **o quê** e o **porquê** antes
> do código — nunca o **como** detalhado (stack, classes, algoritmos). Deriva do PRD
> (`.spec/prd.md`) e o referencia.

| Campo | Valor |
|-------|-------|
| ID | 003 |
| Slug | `corrigir-parcelas-iniciais` |
| Status | Concluída |
| Criada em | 2026-06-28 |
| Atualizada em | 2026-07-22 |
| Responsável | Titular (João Vitor) |

## Objetivo

Corrigir parcelamentos que começaram em 2025 mas tiveram as **primeiras parcelas não
lançadas** (porque o registro no SFP só começou em 2026), de modo que a barra de
progressão da aba Parcelamentos reflita a realidade: um parcelamento `finalizado` deve
mostrar 100% pago. Atende à **HU03** do PRD (acompanhar parcelamentos: pago vs.
restante) eliminando a incoerência entre o status e o progresso exibido.

## Contexto

A aba Parcelamentos ([js/tabs/parcelamentos.js](../../js/tabs/parcelamentos.js)) agrupa
lançamentos por `id_parcela` e calcula:

- `qtdTotal = qtd_parcelas` (metadado de cada linha);
- `pct = round(pagas.length / qtdTotal * 100)`;
- `status = finalizado` quando não há parcelas futuras **e** existe a linha com
  `parcela_atual === qtdTotal`.

Como o uso do sistema começou em 2026, alguns parcelamentos iniciados em 2025 só têm no
banco as parcelas de 2026 em diante. A última parcela existe e está no passado → o plano
é (corretamente) classificado como `finalizado`, mas `pct` usa `pagas.length` (apenas as
linhas existentes) sobre `qtd_parcelas` (o total real), resultando em barra <100%.

Diagnóstico no banco (query `count(parcelas) <> qtd_parcelas`) — exatamente **2 planos**:

| id_parcela | Descrição | Conta | Valor/parc | Existem | Faltam | Datas faltantes |
|------------|-----------|-------|-----------|---------|--------|-----------------|
| P000005 | Sócio Torcedor Metropolitano (12x) | SAFRA | R$ 54,16 | parcelas 9–12 (jan–abr/2026) | **1–8** | 2025-05-01 … 2025-12-01 |
| P000002 | Robô Aspirador (6x) | NUBANK | R$ 197,83 | parcelas 4–6 (jan–mar/2026) | **1–3** | 2025-10-02, 2025-11-02, 2025-12-02 |

Ambos são método `CRÉDITO` (`afeta_saldo = false`), logo não impactam saldo de conta.
O plano **P000010** ("Sócio Metropolitano" renovado, R$ 99,90, mai/2026→abr/2027) é um
parcelamento **separado e completo** (12/12) e está fora de escopo.

## Escopo

**Dentro do escopo**
- Inserir, como lançamentos, as parcelas iniciais faltantes de P000005 (1–8) e
  P000002 (1–3), com data/competência reais de 2025.
- As novas parcelas copiam conta, método, categoria/subcategoria, valor e sinal das
  parcelas irmãs já existentes do mesmo `id_parcela`; só variam `parcela_atual`, `data`,
  `competencia` e o sufixo `(n/total)` da descrição.
- Guarda de coerência em [js/tabs/parcelamentos.js](../../js/tabs/parcelamentos.js):
  um parcelamento `finalizado` nunca exibe barra de progresso <100%.

**Fora do escopo**
- P000010 (sócio renovado 2026→2027) e qualquer plano já completo.
- Criação ou vinculação de faturas de cartão de 2025 (`id_fatura` das novas parcelas
  fica nulo — registros históricos neutros).
- Mecanismo genérico/recorrente de detecção automática de parcelamentos com gap.
- Alteração de `qtd_parcelas` ou renumeração de parcelas existentes.
- Correção de inconsistências de `competencia` de outros planos (ex.: P000010).

## Histórias de usuário

- **HU01** (deriva da HU03 do PRD) — Como titular, quero que um parcelamento já quitado
  apareça com 100% pago, para que o progresso reflita a realidade.
- **HU02** — Como titular, quero que as parcelas pagas em 2025 (antes do início do uso do
  sistema) constem no histórico do parcelamento, para que o valor total e o número de
  parcelas pagas estejam completos.

## Atores / Personas

| Ator | Papel nesta feature |
|------|---------------------|
| Titular (único usuário) | Aciona/valida a correção e consulta a aba Parcelamentos |

## Requisitos Funcionais (EARS)

- **RF01** (HU02) — O sistema DEVE conter, para P000005, as parcelas `parcela_atual` 1 a
  8 e, para P000002, as parcelas 1 a 3, cada uma com `id_parcela`, `qtd_parcelas`, conta,
  método, categoria/subcategoria e valor (mesmo sinal) idênticos aos das parcelas irmãs
  existentes do mesmo plano. _(ubíquo)_
- **RF02** (HU02) — O sistema DEVE atribuir a cada parcela inserida `data` e `competencia`
  coerentes com a cadência mensal do plano: para P000005, datas `2025-05-01` a
  `2025-12-01`; para P000002, datas `2025-10-02`, `2025-11-02`, `2025-12-02`; em todos os
  casos `competencia` = primeiro dia do mês da `data`. _(ubíquo)_
- **RF03** (HU02) — O sistema DEVE registrar `id_fatura = null` nas parcelas inseridas
  (registros históricos neutros, sem vínculo a fatura de cartão). _(ubíquo)_
- **RF04** (HU02) — O sistema DEVE atribuir a cada parcela inserida um `id_lancamento` no
  formato `Lnnnnnn`, sequencial e único, continuando a numeração existente
  (ver [js/services/supabase.js](../../js/services/supabase.js)). _(ubíquo)_
- **RF05** (HU01) — APÓS a inserção, QUANDO a aba Parcelamentos for renderizada, o
  sistema DEVE exibir P000005 e P000002 com `pct = 100%`, `qtdPagas = qtdTotal`
  (12 e 6) e valor pago igual ao valor total do plano. _(evento)_
- **RF06** (HU01) — ENQUANTO um parcelamento estiver com `status = finalizado`, o sistema
  DEVE exibir a barra de progresso em 100%, ainda que o número de parcelas existentes no
  banco seja menor que `qtd_parcelas`. _(estado)_
- **RF07** (HU02) — A correção DEVE ser idempotente: SE uma parcela com o mesmo
  `id_parcela` e `parcela_atual` já existir, ENTÃO o sistema NÃO DEVE criar duplicata.
  _(indesejado)_

## Requisitos Não-Funcionais

- **RNF01** — A correção de dados deve afetar **exatamente 11 linhas** novas (8 de
  P000005 + 3 de P000002) e nenhuma outra linha da tabela `lancamentos`.
- **RNF02** — As parcelas inseridas, por terem `competencia` em 2025, NÃO devem aparecer
  em nenhuma tela filtrada por competência de 2026 (Visão Geral, DRE 2026, faturas 2026),
  garantindo zero poluição das visões do ano corrente.
- **RNF03** — A guarda no front-end não deve adicionar nenhuma consulta extra ao banco
  (puro cálculo em memória sobre os grupos já carregados).
- **RNF04** — Conformidade com o projeto vanilla: sem build, sem dependências novas, todo
  o domínio em pt-BR (ver [.agents/skills/convencoes](../../.agents/skills/)).

## Design técnico

Duas frentes independentes:

1. **Correção de dados (one-off).** Script idempotente que insere as 11 parcelas
   faltantes. Para cada plano, lê uma parcela irmã existente como modelo, deriva os
   campos fixos (conta, método, categoria, subcategoria, valor, sinal, `qtd_parcelas`) e
   gera as linhas faltantes variando `parcela_atual`, `data`, `competencia` e a descrição.
   Os `id_lancamento` continuam a sequência `Lnnnnnn`. A idempotência vem de só inserir
   parcelas `(id_parcela, parcela_atual)` ainda inexistentes.

2. **Guarda de coerência (código).** Em
   [js/tabs/parcelamentos.js](../../js/tabs/parcelamentos.js), ao montar o objeto do
   grupo, assegurar que `status === 'finalizado'` implica `pct = 100`. Isso elimina a
   incoerência visual mesmo que, no futuro, surja novo plano com parcelas iniciais
   ausentes. A camada de acesso a dados permanece em `js/services/`.

### Contratos (API / dados)

Tabela `lancamentos` — campos relevantes por parcela inserida:

```
id_lancamento    : 'Lnnnnnn'  (sequencial, novo)
id_parcela       : 'P000005' | 'P000002'   (igual às irmãs)
qtd_parcelas     : 12 | 6                   (igual às irmãs)
parcela_atual    : 1..8 (P000005) | 1..3 (P000002)
data             : ver RF02
competencia      : primeiro dia do mês de `data`
descricao        : 'Sócio Torcedor Metropolitano (n/12)' | 'Robo Aspirador (n/6)'
valor            : 54.16 | 197.83  (mesmo sinal das irmãs)
id_conta, id_metodo, id_categoria, id_subcategoria : copiados das irmãs
id_fatura        : null
id_transf        : null
```

### Integrações externas

Nenhuma além do Supabase (PostgreSQL/PostgREST) já em uso.

## Dependências

- Spec 002 (DRE) — apenas para confirmar (via RNF02) que competências 2025 não afetam o
  DRE 2026.
- Camada [js/services/supabase.js](../../js/services/supabase.js) (geração de
  `id_lancamento`).

## Decisões técnicas (ADRs)

### ADR-001 — Inserir as parcelas faltantes em vez de ajustar `qtd_parcelas` (atende: RF01, RF02)
- **Contexto:** o plano está incompleto no banco; há duas formas de torná-lo coerente.
- **Decisão:** inserir as parcelas de 2025 com data/valor reais.
- **Motivo:** preserva a verdade histórica (foi 12x/6x e o valor total pago real).
  Reduzir `qtd_parcelas` ao existente foi descartado por falsear o histórico e subnotificar
  o valor pago. Correção só visual foi descartada por deixar o banco inconsistente.
- **Consequências:** passam a existir lançamentos com competência de 2025; aceitável
  porque ficam fora das telas de 2026 (RNF02).

### ADR-002 — Parcelas 2025 como registros históricos neutros (`id_fatura = null`) (atende: RF03)
- **Contexto:** as parcelas são de cartão de crédito e normalmente se ligam a uma fatura.
- **Decisão:** não criar/associar faturas de 2025; `id_fatura` fica nulo.
- **Motivo:** o objetivo é só a coerência do parcelamento; criar faturas de 2025 (que não
  existem no sistema) traria dados e telas do ano anterior sem valor para o titular.
- **Consequências:** a tela de cartões de 2025 não reflete essas parcelas — irrelevante,
  pois o uso começou em 2026.

### ADR-003 — Guarda `finalizado ⇒ 100%` no render (atende: RF06)
- **Contexto:** a incoerência status×progresso pode reaparecer com futuros planos legados.
- **Decisão:** forçar `pct = 100` quando `status = finalizado` na montagem do grupo.
- **Motivo:** correção de baixo custo e sem consulta extra; alternativa de recalcular
  status por cobertura de `parcela_atual` foi adiada por não ser necessária ao caso atual.
- **Consequências:** um plano marcado finalizado com gap de dados exibirá 100% mesmo sem
  todas as linhas — comportamento desejado segundo a HU01.

## Riscos e trade-offs

- **Duplicação de parcelas** ao reexecutar o script → mitigado por idempotência (RF07).
- **Sinal do valor divergente** (despesa positiva vs. negativa) → mitigado copiando o
  sinal da parcela irmã existente, nunca assumindo.
- **Sequência de `id_lancamento` dessincronizada** após restore/pausa do Supabase →
  conferir o maior `Lnnnnnn` no momento da execução (ver memória do projeto sobre
  ressincronizar sequences).

## Critérios de aceitação

- [x] (RF01/RF02/RF03/RF04) Após a correção, existem 8 linhas novas de P000005
      (`parcela_atual` 1–8, datas 2025-05-01…2025-12-01) e 3 de P000002 (1–3, datas
      2025-10-02/11-02/12-02), com `id_fatura` nulo e `id_lancamento` sequencial único.
      Verificado: `id_lancamento` L000900–L000910, `id_fatura = null` em todas.
- [x] (RF05) Na aba Parcelamentos, P000005 mostra "12 de 12 pagas" e P000002 "6 de 6
      pagas", ambos com barra em 100%. Verificado por query: 12 e 6 linhas por plano.
- [x] (RF06) Nenhum parcelamento com `status = finalizado` exibe barra <100% na aba.
      Guarda implementada em [js/tabs/parcelamentos.js](../../js/tabs/parcelamentos.js).
- [x] (RF07) Reexecutar o script não cria linhas adicionais (contagem permanece a mesma).
      Verificado: reexecução do insert idempotente manteve total em 899 linhas.
- [x] (RNF01) A correção criou exatamente 11 linhas e nenhuma outra foi alterada.
      Verificado: total de `lancamentos` foi de 888 para 899.
- [x] (RNF02) As novas parcelas não aparecem na Visão Geral, no DRE 2026 nem nas faturas
      de 2026 (competência 2025, fora dos filtros de 2026).

## Plano de implementação

1. Conferir o maior `id_lancamento` atual e o sinal do `valor` das parcelas irmãs de
   P000005 e P000002.
2. Escrever script idempotente (SQL ou Python em `Outros/`) que insere as 11 parcelas
   faltantes conforme os contratos, pulando as já existentes.
3. Executar e validar as queries de aceitação (contagem, datas, `id_fatura`, sequência).
4. Ajustar [js/tabs/parcelamentos.js](../../js/tabs/parcelamentos.js) para `finalizado ⇒ pct = 100`.
5. Verificar manualmente a aba Parcelamentos (filtros "Em andamento" e "Finalizados").

## Skills relacionadas

- [.agents/skills/database](../../.agents/skills/) — queries Supabase, geração de IDs,
  scripts de migração em `Outros/`.
- [.agents/skills/convencoes](../../.agents/skills/) — IDs sequenciais `Lnnnnnn`,
  `competencia` = primeiro dia do mês, domínio pt-BR.
- [.agents/skills/arquitetura](../../.agents/skills/) — camadas tabs/services e a aba
  Parcelamentos.

## Checklist de autorrevisão da spec

- [x] Nenhum marcador `[NECESSITA CLARIFICAÇÃO]` pendente.
- [x] Todo RF é observável, testável e usa um padrão EARS.
- [x] Todo RF rastreia a uma história de usuário; todo critério rastreia a um RF.
- [x] "Fora do escopo" está preenchido.
- [x] RNF são mensuráveis (sem termos vagos).
- [x] Critérios de aceitação são verificáveis.
- [x] Toda ADR tem motivo e alternativas descartadas.
- [x] A spec não contém código de produção (descreve o quê/porquê, não o como).
- [x] Sem complexidade não justificada (sem "pode vir a precisar").
