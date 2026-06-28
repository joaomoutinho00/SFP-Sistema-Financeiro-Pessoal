# PRD — SFP (Sistema Financeiro Pessoal)

> Fonte de verdade sobre produto e requisitos. Versionado em `.spec/prd.md`.
> **Não invente.** Onde faltar informação essencial, registre
> `[NECESSITA CLARIFICAÇÃO: pergunta]` em vez de assumir.

## Objetivo / Problema

Controlar as finanças pessoais (receitas, despesas, faturas de cartão, parcelamentos,
assinaturas e investimentos) em uma única aplicação web, substituindo a planilha
`Controle Financeiro 2026 - BASE.xlsm`. O objetivo é ter visão mensal por competência,
acompanhar o comprometimento futuro (parcelas e faturas) e categorizar gastos sem o
atrito de manter uma planilha manual.

## Escopo

**Dentro do escopo**
- Visão Geral mensal: receitas, despesas, faturas e investimentos por competência.
- Saldos por conta/banco.
- Lançamentos (transações): cadastro, filtros por competência, banco, tipo, categoria e
  busca por descrição; exclusão de lançamento e de transferência (ambos os lados).
- Parcelamentos: agrupamento por `id_parcela`, progresso pago/restante, status em
  andamento/finalizado.
- Assinaturas recorrentes.
- Categorias e subcategorias, com drill-down para lançamentos.
- Cartões: faturas por cartão, fechamento/vencimento configuráveis, exportação (CSV/PDF).
- DRE (aba presente na navegação).
- Scripts auxiliares de migração da planilha para o Supabase (`Outros/`).

**Fora do escopo (nesta fase)**
- Autenticação/login no front-end e suporte multiusuário.
- Aplicativo mobile nativo.
- Integração bancária automática (Open Finance, importação de extrato).
- Build/bundler, framework SPA e pipeline de testes automatizados.

## Personas / Atores

| Persona | Papel | Necessidade principal |
|---------|-------|-----------------------|
| Titular (único usuário) | Dono das finanças; opera o app localmente | Registrar e visualizar suas finanças por competência |

## Histórias de usuário (alto nível)

- **HU01** — Como titular, quero ver o resumo do mês (receitas, despesas, fatura,
  investimentos), para entender minha situação financeira na competência.
- **HU02** — Como titular, quero lançar transações com método, conta, categoria e
  competência, para registrar movimentações.
- **HU03** — Como titular, quero acompanhar meus parcelamentos (pago vs. restante), para
  saber o quanto já está comprometido.
- **HU04** — Como titular, quero acompanhar faturas por cartão com fechamento/vencimento
  configuráveis e exportá-las, para conferir e arquivar.
- **HU05** — Como titular, quero migrar os dados da planilha para o Supabase, para deixar
  de manter a planilha manualmente.

## Stack técnica

- **Linguagem:** JavaScript (ES Modules, sem transpilação/build).
- **Framework:** nenhum — SPA vanilla com roteamento por abas via `import()` dinâmico.
- **Gerenciador de pacotes:** nenhum — dependências carregadas via CDN (sem `package.json`).
- **Banco de dados:** Supabase (PostgreSQL) acessado via `@supabase/supabase-js` (CDN) e
  REST PostgREST.
- **Bibliotecas (CDN):** Chart.js 4.4.0; Google Fonts (Sora).
- **Tooling auxiliar:** Python (openpyxl, urllib) para migração — `Outros/Migrar.py`,
  `Outros/Criar_faturas.py`.
- **Infra / deploy:** estático, servido por HTTP (`npx serve .` ou `python -m http.server`).
  Sem container.

## Restrições

- **Arquitetura:** manter o projeto vanilla (sem build, bundler, framework ou
  `package.json`). Novas dependências entram via CDN com `import` dinâmico.
- **Segurança:** uso pessoal single-user; não há camada de auth no front. A chave
  publishable do Supabase fica em `js/config.js`. A proteção dos dados depende do
  Row Level Security (RLS) configurado no Supabase. Nunca commitar a `service_role key`.
- **Compliance:** dados financeiros pessoais do próprio titular; sem terceiros (LGPD não
  se aplica a tratamento por pessoa natural para fins exclusivamente pessoais).
- **Idioma:** todo conteúdo (código, UI, commits, comunicação da IA) em pt-BR.

## Requisitos Funcionais (EARS)

- **RF01** — O sistema DEVE exibir todos os valores monetários em BRL e datas no formato
  pt-BR. _(ubíquo)_
- **RF02** — O sistema DEVE organizar lançamentos por competência (primeiro dia do mês). _(ubíquo)_
- **RF03** — QUANDO o usuário seleciona uma aba, o sistema DEVE carregar o módulo
  correspondente sob demanda e renderizá-lo na seção respectiva. _(evento)_
- **RF04** — QUANDO o usuário cria um lançamento, o sistema DEVE gerar IDs sequenciais
  (`Lnnnnnn`, `Pnnnnnn`, `Tnnnnnn`) conforme o tipo. _(evento)_
- **RF05** — QUANDO o usuário exclui uma transferência, o sistema DEVE remover ambos os
  lados (mesmo `id_transf`). _(evento)_
- **RF06** — ENQUANTO houver parcelas com data futura, o parcelamento DEVE ser
  classificado como "em andamento"; caso contrário, "finalizado". _(estado)_
- **RF07** — SE uma chamada ao Supabase retornar erro, ENTÃO o sistema DEVE registrar no
  console e exibir mensagem de erro amigável na aba, sem quebrar a navegação. _(indesejado)_
- **RF08** — O sistema PODE exportar faturas em CSV e PDF. _(opcional)_

## Requisitos Não-Funcionais

- **RNF01** — Compatibilidade: a aplicação DEVE funcionar em navegadores modernos com
  suporte a ES Modules e `import()` dinâmico, sem etapa de build.
- **RNF02** — Segurança: apenas a chave **publishable** pode aparecer no código-fonte
  versionado; a `service_role key` é proibida no repositório.
- **RNF03** — Manutenibilidade: cada aba é um módulo independente em `js/tabs/` que expõe
  `render(container)`; lógica de acesso a dados isolada em `js/services/`.
- **RNF04** — Resiliência: falha ao carregar/renderizar uma aba não DEVE derrubar as
  demais abas já carregadas.

## Decisões técnicas (ADRs inline)

> A skill `sdd-exec` propaga aqui as ADRs aplicadas durante a implementação das specs.

### ADR-001 — Manter stack vanilla sem build
- **Contexto:** projeto pessoal de um único dev; planilha sendo substituída por web app.
- **Decisão:** JavaScript ES Modules servido diretamente, dependências via CDN, sem
  bundler, framework ou `package.json`.
- **Motivo:** simplicidade e zero fricção de toolchain; o escopo não exige SPA framework.
  Alternativas (React/Vite) descartadas por adicionarem build e dependências.
- **Consequências:** sem tree-shaking/minificação; libs vêm do CDN em runtime; sem
  ecossistema npm de lint/test (decisão consciente).

### ADR-002 — Roteamento por abas com import dinâmico
- **Contexto:** múltiplas telas (abas) em uma única página.
- **Decisão:** `js/router.js` mapeia cada aba a um `() => import('./tabs/<aba>.js')` e
  cada módulo expõe `render(section)`; módulos são cacheados após o primeiro load.
- **Motivo:** carregamento sob demanda sem framework; isolamento por aba.
- **Consequências:** estado vive em escopo de módulo; recarregar a aba não re-executa
  `render` (cache via `Set`).

### ADR-003 — Persistência no Supabase via supabase-js + REST
- **Contexto:** necessidade de banco gerenciado sem backend próprio.
- **Decisão:** acesso direto do front ao Supabase com a chave publishable; segurança por
  RLS. Scripts de migração usam REST PostgREST (`Prefer: resolution=merge-duplicates`).
- **Motivo:** elimina backend; suficiente para uso pessoal single-user.
- **Consequências:** regras de acesso dependem inteiramente de RLS bem configurado;
  qualquer deploy público exige RLS revisado.

### ADR-SP001-001 — Filtro de busca por descrição client-side com normalização de diacríticos (spec 001-busca-lancamentos-descricao)
- **Contexto:** a busca incide sobre o conjunto já carregado e filtrado pelos demais critérios; o volume é o de uma competência/período do titular (single-user).
- **Decisão:** manter a filtragem de descrição em JavaScript no service (`getLancamentos`), usando `String.prototype.normalize('NFD')` + remoção de marcas combinantes + `toLowerCase` em termo e descrição.
- **Motivo:** simplicidade e zero round-trips adicionais; reaproveita o pipeline atual e a combinação E-lógica com os outros filtros. Alternativa descartada: `ilike`/`unaccent` no PostgREST — exigiria extensão `unaccent` e refazer a query, sem ganho perceptível na escala single-user.
- **Consequências:** a busca só enxerga o que já foi carregado pelos filtros estruturados (comportamento desejado); custo de normalização é desprezível no volume esperado.

### ADR-SP001-002 — Acionamento da busca por digitação com debounce de 300 ms (spec 001-busca-lancamentos-descricao)
- **Contexto:** filtrar a cada tecla recarrega a tabela em excesso; exigir Enter/botão reduz a fluidez.
- **Decisão:** recarregar automaticamente após ~300 ms da última tecla (debounce via `setTimeout`).
- **Motivo:** equilibra fluidez e número de recargas. Alternativas descartadas: Enter e botão dedicado.
- **Consequências:** há um pequeno atraso perceptível entre digitar e ver o resultado, aceitável.

### ADR-SP002-001 — Apuração anual com colunas mensais agregadas no cliente (spec 002-dre)
- **Contexto:** o DRE exibe 12 meses por categoria; o restante do app opera por competência única.
- **Decisão:** uma única query ao Supabase filtrando `competencia` entre `AAAA-01-01` e `AAAA-12-01`; agregação por mês/seção/categoria feita em JavaScript.
- **Motivo:** evita 12 round-trips; volume anual de um único titular é pequeno. Alternativa descartada: uma query por mês (12 chamadas).
- **Consequências:** toda a lógica de pivô mensal vive no cliente; coerente com o estilo vanilla do projeto.

### ADR-SP002-002 — Categorias do DRE derivadas dos dados, sem lista fixa (spec 002-dre)
- **Contexto:** novas categorias com movimentação devem aparecer automaticamente no DRE.
- **Decisão:** montar linhas a partir dos lançamentos do ano (mesmo padrão de `catMap` em `categorias.js`), nunca de lista hardcoded.
- **Motivo:** zero manutenção quando surge categoria nova; consistente com a aba Categorias. Alternativa descartada: enumerar categorias fixas no módulo.
- **Consequências:** categorias sem lançamento no ano não aparecem; categorias com movimento em algum mês aparecem com os demais meses zerados.

### ADR-SP002-003 — Investimentos em seção separada, fora do Resultado (spec 002-dre)
- **Contexto:** investimento não é gasto — é dinheiro que o titular mantém consigo.
- **Decisão:** Investimentos formam terceira seção; Resultado = Receitas − Despesas, sem subtrair Investimentos.
- **Motivo:** reflete intenção do titular. Alternativa descartada: somar investimentos às despesas (distorceria o resultado).
- **Consequências:** a seção Investimentos é informativa; Resultado pode ser positivo mesmo com aportes altos.

### ADR-SP002-004 — DRE reutiliza regra de classificação de `getResumoMes` (spec 002-dre)
- **Contexto:** já existe regra consolidada de entrada/saída/crédito/fatura/investimento em `getResumoMes`.
- **Decisão:** `getDRE` espelha a classificação: id_tipo 2 exceto FATURA → Despesas (incluindo CRÉDITO); id_tipo 3 só INVESTIMENTO → Investimentos.
- **Motivo:** consistência entre Visão Geral e DRE; evita duas definições divergentes de "despesa". Alternativa descartada: regra independente no módulo da aba.
- **Consequências:** mudanças na regra de tipos devem ser feitas na camada service para manter as telas alinhadas.

## Questões em aberto e riscos

- **Risco:** ~~a aba **DRE** está na navegação mas não há módulo/rota~~ — resolvido em spec 002-dre.
- **Risco:** dependência de CDNs (Chart.js, supabase-js, Sora) — indisponibilidade do CDN
  quebra o app. → mitigação: avaliar fixar versões/local se virar problema.
- **Risco:** RLS do Supabase é a única barreira de acesso aos dados. → mitigação: revisar
  políticas RLS antes de qualquer exposição pública.
- **Questão:** política de retenção/backup dos dados financeiros →
  `[NECESSITA CLARIFICAÇÃO: há rotina de backup do banco Supabase?]`
