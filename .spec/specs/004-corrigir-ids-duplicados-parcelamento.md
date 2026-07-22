# Spec 004 — Correção de IDs duplicados na criação de lançamento parcelado

> Spec de feature (Spec-Driven Development). Descreve o **o quê** e o **porquê** antes
> do código — nunca o **como** detalhado (stack, classes, algoritmos). Deriva do PRD
> (`.spec/prd.md`) e o referencia.

| Campo | Valor |
|-------|-------|
| ID | 004 |
| Slug | `corrigir-ids-duplicados-parcelamento` |
| Status | Concluída |
| Criada em | 2026-07-22 |
| Atualizada em | 2026-07-22 |
| Responsável | Titular (João Vitor) |

## Objetivo

Restaurar a capacidade de cadastrar lançamentos parcelados, hoje totalmente bloqueada
pelo erro `duplicate key value violates unique constraint "lancamentos_pkey"`. Atende à
**HU02** do PRD (lançar transações) e ao **RF04** (IDs sequenciais `Lnnnnnn`), garantindo
que cada parcela receba um identificador único.

## Contexto

O formulário de lançamento monta todas as parcelas em memória e as grava em um único
`insert` em lote ([js/forms/lancamento.js:1087](../../js/forms/lancamento.js#L1087)).
O identificador de cada parcela vem de `proximoIdLancamento()`
([js/services/supabase.js:175-188](../../js/services/supabase.js#L175-L188)), que **lê do
banco** o maior `id_lancamento` existente e soma 1.

Como esse helper é invocado uma vez por parcela
([js/forms/lancamento.js:1035 e 1066](../../js/forms/lancamento.js#L1066)) **antes** de
qualquer gravação, o estado do banco não muda entre as chamadas: todas retornam o mesmo
`Lnnnnnn`. O lote chega ao PostgreSQL com a chave primária repetida e a transação é
rejeitada por inteiro.

Consequências observadas hoje:

- Qualquer parcelamento com 2 ou mais parcelas futuras falha — a funcionalidade está
  inoperante, não degradada.
- Como o `insert` é atômico, **nenhuma** linha é gravada; não há parcelamento
  parcialmente criado no banco (por isso não há correção de dados legados nesta spec).
- Lançamentos simples, transferências e faturas continuam funcionando, pois geram um
  único ID por operação.

## Escopo

**Dentro do escopo**
- Geração de identificadores únicos para **todas** as parcelas de um mesmo lote de
  lançamento parcelado, preservando o formato `Lnnnnnn` sequencial (PRD RF04).
- Preservação da ordem: a parcela 1 recebe o primeiro identificador do bloco e as
  seguintes recebem identificadores consecutivos crescentes.
- Comportamento correto em cadastros sucessivos: um novo parcelamento continua a
  numeração a partir do último identificador efetivamente gravado.
- Mensagem de erro amigável preservada caso a gravação ainda falhe (PRD RF07).

**Fora do escopo**
- Alteração da geração de `id_parcela` (`Pnnnnnn`) e `id_transf` (`Tnnnnnn`) — cada
  operação gera um único valor e não colide.
- Mudança dos demais fluxos de escrita (lançamento simples, transferência, fatura,
  edição de lançamento).
- Migração de banco: criação de `sequence`, `trigger`, `default` ou qualquer geração de
  identificador no PostgreSQL.
- Troca do formato `Lnnnnnn` por UUID ou identificador não sequencial.
- Otimização das chamadas a `resolverFatura` feitas uma vez por parcela dentro do laço —
  é questão de desempenho, não a causa do defeito.
- Correção de dados existentes: não há parcelamento parcialmente gravado a corrigir.
- Tratamento de concorrência multiusuário (o produto é single-user — PRD, Restrições).

## Histórias de usuário

- **HU01** (deriva da HU02 do PRD) — Como titular, quero cadastrar uma compra parcelada
  em N vezes e ver todas as parcelas salvas, para registrar o comprometimento futuro sem
  precisar lançar parcela a parcela.
- **HU02** — Como titular, quero cadastrar vários parcelamentos em sequência na mesma
  sessão, para lançar de uma vez as compras acumuladas sem recarregar a página.

## Atores / Personas

| Ator | Papel nesta feature |
|------|---------------------|
| Titular (único usuário) | Preenche o formulário de lançamento com parcelamento e salva |

## Requisitos Funcionais (EARS)

- **RF01** (HU01) — QUANDO o titular salva um lançamento com `qtd_parcelas` maior que 1,
  o sistema DEVE gravar exatamente `qtd_parcelas − parcela_atual + 1` lançamentos, um
  para cada parcela de `parcela_atual` até `qtd_parcelas`. _(evento)_
- **RF02** (HU01) — O sistema DEVE atribuir a cada parcela do lote um `id_lancamento`
  **distinto** de todos os demais do lote e de todos os já existentes na tabela
  `lancamentos`. _(ubíquo)_
- **RF03** (HU01) — O sistema DEVE atribuir aos lançamentos do lote identificadores no
  formato `Lnnnnnn` (PRD RF04), consecutivos e crescentes na ordem das parcelas, de modo
  que a parcela de menor `parcela_atual` receba o menor identificador do bloco. _(ubíquo)_
- **RF04** (HU01) — O sistema DEVE preservar, para cada parcela gravada, os demais dados
  já produzidos pelo formulário (data, competência, conta, método, categoria,
  subcategoria, valor, `id_parcela`, `qtd_parcelas`, `parcela_atual` e vínculo de
  fatura), sem alteração de comportamento. _(ubíquo)_
- **RF05** (HU02) — QUANDO o titular salva um novo lançamento parcelado após já ter
  salvo outro na mesma sessão, o sistema DEVE iniciar o novo bloco de identificadores
  a partir do maior `id_lancamento` já gravado, sem reutilizar valores. _(evento)_
- **RF06** (HU01) — SE a gravação do lote falhar por qualquer motivo, ENTÃO o sistema
  DEVE exibir mensagem de erro no formulário, reabilitar o botão de salvar e não gravar
  nenhuma parcela (comportamento tudo-ou-nada), conforme o PRD RF07. _(indesejado)_
- **RF07** (HU01) — ENQUANTO o formulário estiver com parcelamento cuja `parcela_atual`
  seja igual a `qtd_parcelas`, o sistema DEVE gravar apenas um lançamento, mantendo o
  comportamento atual. _(estado)_

## Requisitos Não-Funcionais

- **RNF01** — A geração dos identificadores do lote DEVE consumir **exatamente uma**
  consulta ao banco para leitura do último `id_lancamento`, independentemente do número
  de parcelas (hoje são N consultas para N parcelas).
- **RNF02** — Um parcelamento de até 48 parcelas DEVE ser gravado em uma única operação
  de `insert`, mantendo a atomicidade que garante o RF06.
- **RNF03** — Conformidade com o projeto vanilla: sem build, sem `package.json`, sem
  dependência nova e sem migração de banco (PRD ADR-001).
- **RNF04** — Manutenibilidade: a lógica de geração de identificadores permanece na
  camada `js/services/`, sem que a camada de formulário monte consulta crua (PRD RNF03).
- **RNF05** — Todo o domínio, mensagens e comentários permanecem em pt-BR.

## Design técnico

A correção troca a estratégia de **um identificador por consulta** por **reserva de um
bloco de identificadores**:

1. A camada de serviço passa a expor a capacidade de obter um bloco de `n`
   identificadores sequenciais: lê **uma vez** o maior `id_lancamento` existente e deriva
   os `n` valores subsequentes em memória, mantendo o formato `Lnnnnnn`.
2. O formulário de lançamento, ao montar o lote de parcelas, solicita o bloco com o
   tamanho exato do lote e consome os identificadores na ordem das parcelas — eliminando
   a chamada por iteração dentro do laço.
3. O restante do fluxo (resolução de competência, resolução de fatura, montagem do
   objeto de cada parcela e o `insert` em lote único) permanece inalterado.

A geração para lançamentos não parcelados continua usando o caminho de identificador
único já existente, que é o caso `n = 1` do mesmo mecanismo.

### Contratos (API / dados)

Tabela `lancamentos`, campo `id_lancamento` (chave primária, `text`):

```
formato        : 'Lnnnnnn'  (letra L + 6 dígitos com zeros à esquerda)
unicidade      : global na tabela (constraint lancamentos_pkey)
ordem no lote  : parcela_atual crescente ⇒ id_lancamento crescente
```

Exemplo — parcelamento de 4x, `parcela_atual = 1`, último identificador gravado
`L000420`:

| parcela_atual | id_lancamento | id_parcela |
|---------------|---------------|------------|
| 1 | L000421 | P000011 |
| 2 | L000422 | P000011 |
| 3 | L000423 | P000011 |
| 4 | L000424 | P000011 |

Comportamento atual (defeituoso): as quatro linhas recebem `L000421` e o `insert` é
rejeitado por `lancamentos_pkey`.

### Integrações externas

Nenhuma além do Supabase (PostgreSQL/PostgREST) já em uso.

## Dependências

- [js/services/supabase.js](../../js/services/supabase.js) — origem da geração de
  `id_lancamento`.
- [js/forms/lancamento.js](../../js/forms/lancamento.js) — consumidor no fluxo de
  parcelamento.
- Nenhuma dependência de outra spec. A spec 003 depende da mesma convenção `Lnnnnnn`
  (seu RF04), mas não é bloqueante nem bloqueada por esta.

## Decisões técnicas (ADRs)

### ADR-001 — Reservar bloco de IDs no cliente em vez de gerar no banco (atende: RF02, RF03)
- **Contexto:** o identificador é lido do banco e incrementado no cliente; N leituras
  sem gravação intermediária produzem N valores idênticos.
- **Decisão:** ler o último identificador uma única vez e derivar em memória o bloco
  completo necessário para o lote.
- **Motivo:** corrige a causa raiz com mudança mínima, preserva o formato `Lnnnnnn`
  exigido pelo PRD RF04 e reduz N consultas para uma (RNF01). Alternativa descartada:
  mover a geração para uma `sequence`/`trigger` no PostgreSQL — resolveria também a
  corrida entre abas, mas exige migração de banco, muda o contrato de escrita de todos
  os fluxos e não se justifica em um app single-user (PRD, Restrições).
- **Consequências:** a unicidade continua dependendo de o cliente ser o único escritor no
  intervalo entre a leitura e o `insert`. Aceitável no cenário single-user; caso o
  produto deixe de ser single-user, a geração no banco volta à mesa.

### ADR-002 — Não adicionar retentativa automática em colisão de chave (atende: RF06)
- **Contexto:** mesmo com o bloco reservado, uma escrita concorrente (outra aba aberta)
  poderia, em tese, colidir.
- **Decisão:** manter o comportamento de falha explícita — mensagem de erro no formulário
  e nenhuma linha gravada.
- **Motivo:** o cenário exige duas abas gravando no mesmo instante, improvável em uso
  single-user; retentativa automática adicionaria complexidade sem requisito que a
  sustente (gate de simplicidade). Alternativa descartada: recalcular o bloco e tentar
  novamente uma vez.
- **Consequências:** numa colisão real o titular vê o erro e salva de novo, o que resolve
  o caso por já haver novo estado no banco.

### ADR-003 — Manter o `insert` em lote único (atende: RF01, RF06)
- **Contexto:** gravar parcela a parcela também eliminaria a duplicidade, pois cada
  leitura enxergaria a gravação anterior.
- **Decisão:** preservar a gravação em lote único.
- **Motivo:** garante atomicidade (RF06) — hoje uma falha no meio não deixa parcelamento
  quebrado no banco. Alternativa descartada: N `insert` sequenciais, que reintroduziriam
  N round-trips e a possibilidade de parcelamento parcialmente gravado.
- **Consequências:** a unicidade precisa ser garantida antes da gravação, o que é
  exatamente o que a ADR-001 faz.

## Riscos e trade-offs

- **Sequência dessincronizada após restore/pausa do Supabase** (ver memória do projeto)
  → o bloco é derivado do maior identificador realmente presente na tabela, não de uma
  sequence do banco, então permanece coerente.
- **Duas abas do app salvando simultaneamente** → colisão possível; mitigado pela falha
  explícita e nova tentativa manual (ADR-002).
- **Identificadores com número de dígitos acima de 6** (acima de `L999999`) → fora do
  horizonte de volume de um app pessoal; comportamento inalterado em relação ao atual.
- **Regressão em lançamento simples** → mitigada por o caso não parcelado ser o `n = 1`
  do mesmo mecanismo, coberto por critério de aceitação dedicado.

## Critérios de aceitação

- [ ] (RF01/RF02/RF03) QUANDO um lançamento parcelado em 4x com `parcela_atual = 1` é
      salvo, o sistema DEVE gravar 4 linhas com o mesmo `id_parcela` e `id_lancamento`
      distintos e consecutivos, sem exibir erro.
- [ ] (RF03) A parcela `parcela_atual = 1` DEVE ter o menor `id_lancamento` do bloco e a
      parcela `parcela_atual = qtd_parcelas`, o maior.
- [ ] (RF02) Nenhum `id_lancamento` gravado DEVE coincidir com identificador já existente
      na tabela `lancamentos` (verificável por contagem de duplicatas igual a zero).
- [ ] (RF04) Os demais campos das parcelas gravadas (data, competência, conta, método,
      categoria, subcategoria, valor, `qtd_parcelas`, `parcela_atual`, `id_fatura`) DEVEM
      permanecer idênticos ao comportamento anterior ao defeito.
- [ ] (RF05) QUANDO um segundo parcelamento é salvo na mesma sessão, sem recarregar a
      página, ele DEVE ser gravado sem erro e com identificadores maiores que os do
      primeiro.
- [ ] (RF06) SE a gravação falhar, ENTÃO nenhuma parcela DEVE existir no banco e o
      formulário DEVE exibir a mensagem de erro com o botão de salvar reabilitado.
- [ ] (RF07) Um lançamento sem parcelamento e um lançamento com `parcela_atual` igual a
      `qtd_parcelas` DEVEM continuar gravando exatamente uma linha.
- [ ] (RNF01) A gravação de um parcelamento de N parcelas DEVE realizar apenas uma
      consulta de leitura do último `id_lancamento`, verificável na aba Rede do navegador.
- [ ] (RNF03) Nenhum arquivo de build, `package.json`, dependência nova ou migração de
      banco DEVE ser adicionado.

## Plano de implementação

1. Reproduzir o defeito: cadastrar um parcelado 3x e confirmar o erro
   `lancamentos_pkey`.
2. Estender a camada de serviço com a reserva de bloco de identificadores sequenciais
   (`n` valores a partir de uma única leitura), mantendo o helper de identificador único
   como caso `n = 1`.
3. Ajustar o fluxo de parcelamento em [js/forms/lancamento.js](../../js/forms/lancamento.js)
   para consumir o bloco na ordem das parcelas, removendo a chamada por iteração.
4. Validar sintaxe dos módulos alterados (`node --check`).
5. Verificar manualmente os critérios de aceitação: parcelado 4x, dois parcelamentos
   seguidos, lançamento simples, última parcela, e contagem de duplicatas no banco.

## Skills relacionadas

- [.agents/skills/database](../../.agents/skills/) — geração de IDs e escrita no
  Supabase via `js/services/supabase.js`.
- [.agents/skills/convencoes](../../.agents/skills/) — IDs sequenciais `Lnnnnnn`,
  competência como primeiro dia do mês, domínio pt-BR.
- [.agents/skills/arquitetura](../../.agents/skills/) — separação entre `js/forms/` e
  `js/services/`; a UI não monta consulta crua.

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
