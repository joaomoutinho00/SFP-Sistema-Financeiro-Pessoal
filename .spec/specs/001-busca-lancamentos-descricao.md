# Spec 001 — Busca de lançamentos por descrição

> Spec de feature (Spec-Driven Development). Descreve o **o quê** e o **porquê** antes
> do código — nunca o **como** detalhado (stack, classes, algoritmos). Deriva do PRD
> (`.spec/prd.md`) e o referencia.

| Campo | Valor |
|-------|-------|
| ID | 001 |
| Slug | `busca-lancamentos-descricao` |
| Status | Rascunho |
| Criada em | 2026-06-28 |
| Atualizada em | 2026-06-28 |
| Responsável | Titular (único usuário) |

## Objetivo

Permitir que o titular encontre rapidamente lançamentos pela descrição, digitando um
termo num campo de busca na aba Lançamentos, em vez de rolar a tabela ou depender apenas
dos filtros estruturados (período, banco, tipo, categoria). Atende ao item de escopo do
PRD "busca por descrição" em Lançamentos ([prd.md:21](../prd.md#L21)) e à HU02 do produto.

## Contexto

A aba Lançamentos ([js/tabs/transacoes.js](../../js/tabs/transacoes.js)) já oferece
filtros por período, banco, tipo, categoria, subcategoria e método, mas não expõe na UI
nenhuma forma de buscar por texto livre na descrição. A camada de dados **já suporta**
esse filtro: `getLancamentos({ busca })` em
[js/services/supabase.js:9](../../js/services/supabase.js#L9) aplica, hoje, um filtro
client-side por `descricao` usando apenas `toLowerCase()`
([supabase.js:43-48](../../js/services/supabase.js#L43-L48)). Falta o elemento de UI que
alimente esse parâmetro e o ajuste do casamento para ignorar acentos. Esta feature fecha
essa lacuna sem novas dependências, mantendo a stack vanilla (ADR-001 do PRD).

## Escopo

**Dentro do escopo**
- Campo de texto de busca na barra de filtros da aba Lançamentos.
- Filtragem da tabela pela descrição enquanto o usuário digita, com debounce.
- Casamento insensível a acentos e a maiúsculas/minúsculas.
- Botão "limpar" (×) que aparece quando há texto e zera a busca.
- Combinação da busca (E lógico) com os filtros já existentes.
- Atualização do contador e dos cards de resumo conforme o resultado filtrado.

**Fora do escopo**
- Busca em outros campos (valor, banco, categoria, método) — apenas `descricao`.
- Busca em outras abas (Visão Geral, Cartões, Parcelamentos, etc.).
- Persistência do termo entre trocas de aba ou recargas de página.
- Realce (highlight) do trecho casado dentro da descrição.
- Busca full-text no servidor (PostgREST/Postgres `ilike`/`tsvector`); o filtro permanece
  client-side sobre o conjunto já carregado pelos demais filtros.

## Histórias de usuário

- **HU01** — Como titular, quero digitar um termo num campo de busca na aba Lançamentos,
  para ver apenas os lançamentos cuja descrição contém aquele termo.
- **HU02** — Como titular, quero que a busca ignore acentos e maiúsculas, para encontrar
  "Água" digitando "agua" sem me preocupar com a grafia exata.
- **HU03** — Como titular, quero limpar a busca com um clique, para voltar rapidamente à
  lista completa do período sem apagar o texto manualmente.

## Atores / Personas

| Ator | Papel nesta feature |
|------|---------------------|
| Titular (único usuário) | Digita o termo, lê os resultados filtrados e limpa a busca |

## Requisitos Funcionais (EARS)

- **RF01** (HU01) — O sistema DEVE exibir, na barra de filtros da aba Lançamentos, um
  campo de texto destinado à busca por descrição. _(ubíquo)_
- **RF02** (HU01) — QUANDO o usuário altera o texto do campo de busca, o sistema DEVE,
  após uma pausa de digitação de aproximadamente 300 ms, recarregar a tabela exibindo
  apenas os lançamentos cuja descrição contém o termo. _(evento)_
- **RF03** (HU02) — O sistema DEVE casar o termo de busca de forma insensível a acentos e
  a maiúsculas/minúsculas, comparando termo e descrição após normalização equivalente
  (ex.: "agua" casa com "Água"; "AGUA" casa com "água"). _(ubíquo)_
- **RF04** (HU01) — O sistema DEVE combinar o termo de busca com os demais filtros ativos
  (período/competência, banco, tipo, categoria, subcategoria, método) por E lógico,
  exibindo apenas lançamentos que satisfaçam todos. _(ubíquo)_
- **RF05** (HU01) — QUANDO a busca filtra a tabela, o sistema DEVE atualizar o contador de
  lançamentos e os cards de resumo (Total, Despesas, Receitas, Saldo) para refletir
  apenas o resultado filtrado. _(evento)_
- **RF06** (HU03) — ENQUANTO houver texto no campo de busca, o sistema DEVE exibir um
  controle de "limpar" (×) associado ao campo. _(estado)_
- **RF07** (HU03) — QUANDO o usuário aciona o controle "limpar", o sistema DEVE esvaziar o
  campo de busca e recarregar a tabela sem o filtro de descrição. _(evento)_
- **RF08** (HU01) — QUANDO o campo de busca está vazio, o sistema DEVE exibir todos os
  lançamentos que satisfazem os demais filtros, sem aplicar filtro de descrição. _(evento)_
- **RF09** (HU01) — QUANDO o termo de busca não casa com nenhum lançamento do conjunto
  filtrado, o sistema DEVE exibir o estado vazio "Nenhum lançamento encontrado.". _(evento)_
- **RF10** (HU01) — QUANDO a aba Lançamentos é (re)renderizada, o sistema DEVE iniciar com
  o campo de busca vazio e sem filtro de descrição aplicado. _(evento)_

## Requisitos Não-Funcionais

- **RNF01** — Responsividade: a tabela DEVE recarregar no máximo ~300 ms após a última
  tecla digitada (janela de debounce), evitando recarregar a cada caractere.
- **RNF02** — Sem novas dependências: a feature DEVE ser implementada apenas com
  JavaScript ES Modules vanilla e CSS já existentes, sem build nem libs adicionais
  (coerente com ADR-001 do PRD).
- **RNF03** — Manutenibilidade: a lógica de filtragem por descrição DEVE permanecer na
  camada de service (`js/services/supabase.js`); a aba apenas fornece o termo e dispara o
  recarregamento (coerente com RNF03 do PRD).
- **RNF04** — Acessibilidade mínima: o campo DEVE ter `placeholder` descritivo e ser
  operável por teclado (foco, digitação e limpeza).

## Design técnico

Feature predominantemente de UI na aba Lançamentos, reutilizando o pipeline de
carregamento já existente:

1. **UI (aba):** adicionar um campo `<input type="search">` (com botão ×) na barra de
   filtros de [js/tabs/transacoes.js](../../js/tabs/transacoes.js), ao lado dos selects.
   Introduzir um estado de módulo `filtroBusca` (string), resetado em `render()` junto aos
   demais filtros (RF10).
2. **Debounce:** o handler de `input` agenda o recarregamento com `setTimeout` (~300 ms),
   cancelando o agendamento anterior a cada tecla (RF02/RNF01).
3. **Recarregamento:** `carregarTabela()` passa `busca: filtroBusca || undefined` para
   `getLancamentos(...)`, exatamente como os demais filtros já são repassados. A
   combinação por E lógico (RF04) é automática, pois o termo é mais um critério no mesmo
   fluxo.
4. **Cards e contador:** já derivam de `lancamentosFiltrados`/resultado renderizado, logo
   refletem o filtro sem alteração adicional (RF05).
5. **Normalização de acento (service):** ajustar o filtro `busca` em
   [supabase.js:43-48](../../js/services/supabase.js#L43-L48) para normalizar termo e
   descrição (remoção de diacríticos, ex.: `String.prototype.normalize('NFD')` + remoção
   de marcas combinantes, além de `toLowerCase`) antes do `includes` (RF03).
6. **Limpar (×):** controle exibido quando `filtroBusca` não é vazio (RF06); ao acionar,
   zera o estado, limpa o input e recarrega (RF07).

### Contratos (API / dados)

Sem mudança de schema nem de endpoint. O contrato afetado é a função de service já
existente:

```
getLancamentos({ competencia, banco, tipo, categoria, subcategoria, busca, dataInicio, dataFim })
  → Lancamento[]   // 'busca': filtra por descrição, insensível a acento e caixa
```

A normalização passa a valer para ambos os lados da comparação. Exemplo: `busca = "agua"`
retorna lançamentos com descrição "Conta de Água", "AGUA mineral", "água".

### Integrações externas

Nenhuma. Mantém o acesso atual ao Supabase via `getLancamentos`; o filtro de descrição
permanece client-side sobre os dados já carregados.

## Dependências

- Camada de service `getLancamentos` em
  [js/services/supabase.js](../../js/services/supabase.js) (já existente; ajuste de
  normalização nesta spec).
- Estilos de `.filter-pill` / inputs já presentes em [css/styles.css](../../css/styles.css).

## Decisões técnicas (ADRs)

### ADR-001 — Filtro client-side com normalização de diacríticos (atende: RF03, RF04)
- **Contexto:** a busca incide sobre o conjunto já carregado e filtrado pelos demais
  critérios; o volume é o de uma competência/período do titular (single-user).
- **Decisão:** manter a filtragem de descrição em JavaScript no service, estendendo a
  comparação para remover acentos (`normalize('NFD')` + remoção de marcas combinantes) e
  aplicar `toLowerCase` em termo e descrição.
- **Motivo:** simplicidade e zero round-trips adicionais; reaproveita o pipeline atual e a
  combinação E-lógica com os outros filtros. Alternativa descartada: `ilike`/`unaccent`
  no PostgREST — exigiria extensão `unaccent` e refazer a query, sem ganho perceptível na
  escala single-user.
- **Consequências:** a busca só enxerga o que já foi carregado pelos filtros estruturados
  (comportamento desejado); custo de normalização é desprezível no volume esperado.

### ADR-002 — Acionamento por digitação com debounce (atende: RF02, RNF01)
- **Contexto:** filtrar a cada tecla recarrega a tabela em excesso; exigir Enter/botão
  reduz a fluidez.
- **Decisão:** recarregar automaticamente após ~300 ms da última tecla (debounce).
- **Motivo:** equilibra fluidez e número de recargas. Alternativas descartadas: Enter e
  botão dedicado (escolha do usuário na clarificação foi "enquanto digita").
- **Consequências:** há um pequeno atraso perceptível entre digitar e ver o resultado,
  aceitável e coberto por RNF01.

## Riscos e trade-offs

- Recargas frequentes durante digitação rápida → mitigado pelo debounce (ADR-002/RNF01).
- Normalização de acento depende de `String.prototype.normalize`, suportada nos
  navegadores modernos alvo (RNF01 do PRD) → sem mitigação adicional necessária.
- Alterar o filtro `busca` no service afeta qualquer outro chamador de `getLancamentos`
  que use `busca` → hoje só a aba Lançamentos consumirá o parâmetro; mudança é
  retrocompatível (passa a casar mais, nunca menos).

## Critérios de aceitação

- [ ] (RF01) A barra de filtros da aba Lançamentos exibe um campo de busca por descrição.
- [ ] (RF02) Ao digitar um termo, a tabela passa a mostrar, após ~300 ms, apenas
  lançamentos cuja descrição contém o termo.
- [ ] (RF03) Digitar "agua" retorna lançamentos com descrição "Água"/"AGUA"/"água"; a
  comparação ignora acentos e caixa.
- [ ] (RF04) Com um filtro de período/banco/tipo ativo, a busca restringe ainda mais o
  resultado (E lógico), nunca ampliando além do conjunto já filtrado.
- [ ] (RF05) Contador e cards de resumo refletem apenas os lançamentos exibidos após a
  busca.
- [ ] (RF06) Com texto no campo, o controle de limpar (×) está visível.
- [ ] (RF07) Acionar o × esvazia o campo e recarrega a tabela sem filtro de descrição.
- [ ] (RF08) Com o campo vazio, todos os lançamentos do período (sujeitos aos demais
  filtros) aparecem.
- [ ] (RF09) Um termo sem correspondência exibe "Nenhum lançamento encontrado.".
- [ ] (RF10) Ao trocar para outra aba e voltar, o campo de busca reinicia vazio.

## Plano de implementação

1. Em [js/services/supabase.js](../../js/services/supabase.js), estender o filtro `busca`
   de `getLancamentos` para normalizar acentos e caixa em termo e descrição (RF03).
2. Em [js/tabs/transacoes.js](../../js/tabs/transacoes.js), adicionar o estado de módulo
   `filtroBusca` e resetá-lo em `render()` (RF10).
3. Inserir o campo de busca (input + botão ×) na barra de filtros do `buildShell()`
   (RF01/RF06).
4. Ligar o evento `input` com debounce (~300 ms) que atualiza `filtroBusca` e chama
   `carregarTabela()`; ligar o botão × para limpar (RF02/RF07).
5. Passar `busca: filtroBusca || undefined` na chamada a `getLancamentos` em
   `carregarTabela()` (RF04/RF08).
6. Verificar manualmente os critérios de aceitação servindo o app localmente.

## Skills relacionadas

- `.agents/skills/arquitetura` — camadas tabs/services e fluxo de render da aba.
- `.agents/skills/convencoes` — nomenclatura pt-BR, formatação e render via template strings.
- `.agents/skills/database` — contrato de `getLancamentos` e filtragem em `js/services/`.
- `.agents/skills/tecnologias/javascript` — idioms ES Modules vanilla (debounce, `normalize`).

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
