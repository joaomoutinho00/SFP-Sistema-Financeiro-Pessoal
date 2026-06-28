---
name: convencoes
description: >-
  Convenções do SFP: nomenclatura de domínio em pt-BR, IDs sequenciais de negócio,
  competência como primeiro dia do mês, formatação BRL/data e renderização via template
  strings. Use ao nomear arquivos/funções, gerar IDs, formatar valores ou montar HTML.
  Não use para padrões de seguranca nem para detalhes de query.
---

# Convenções — SFP

## Visão geral

O domínio é descrito em **pt-BR** e a UI é montada com template strings. Há convenções
fixas para IDs de negócio, competência e formatação que NÃO devem ser reinventadas.

## Regras (faça)

- **Nomenclatura:** arquivos em kebab-case (`visao-geral.js`), funções em camelCase
  (`buscarParcelamentos`), domínio em pt-BR (`lancamentos`, `contas`, `competencia`).

- **IDs de negócio** são strings sequenciais com prefixo; gere pelos helpers de
  [js/services/supabase.js](../../../js/services/supabase.js):

  ```js
  import { proximoIdLancamento, proximoIdParcela, proximoIdTransf } from '../services/supabase.js'
  const id = await proximoIdLancamento()   // 'L000647'
  // L = lançamento, P = parcela, T = transferência → formato <prefixo><6 dígitos>
  ```

- **Competência** é sempre o primeiro dia do mês (`YYYY-MM-01`). Use os helpers de
  [js/services/formatters.js](../../../js/services/formatters.js):

  ```js
  import { competenciaAtual, addMeses, formatCompetencia } from '../services/formatters.js'
  competenciaAtual()                 // '2026-06-01'
  formatCompetencia('2026-06-01')    // 'Junho de 2026'
  ```

- **Formatação:** valores via `formatBRL`, datas via `formatData`. Nunca reimplemente:

  ```js
  formatBRL(1234.5)        // 'R$ 1.234,50'
  formatData('2026-06-28') // '28/06/2026'
  ```

- **Commits:** Conventional Commits em pt-BR (`feat:`, `fix:`, `chore:`); uma branch por
  feature/fix (`feat/...`, `fix/...`).

## Anti-padrões (não faça)

- Não formate moeda/data na mão (`'R$ ' + valor.toFixed(2)`); use os formatters.
- Não gere IDs concatenando à mão fora dos helpers — eles consultam o último ID no banco.
- Não use competência com dia diferente de `01`.

## Referências

- PRD: `.spec/prd.md` (RF01, RF02, RF04)
- Skills relacionadas: `arquitetura`, `database`
