---
name: database
description: >-
  Acesso a dados do SFP no Supabase (PostgreSQL/PostgREST) via supabase-js: queries,
  joins aninhados, filtros, tratamento de erro e geração de IDs. Use ao ler/escrever
  dados, criar helpers em js/services/supabase.js ou mexer nos scripts de migração Python
  em Outros/. Não use para regras de seguranca/RLS (ver skill seguranca).
---

# Database — SFP (Supabase)

## Visão geral

Persistência no Supabase (PostgreSQL) acessada do front via `@supabase/supabase-js`
(carregado por CDN). Tabelas principais: `lancamentos`, `contas`, `categorias`,
`subcategorias`, `metodos`, `faturas`. Todo acesso passa por
[js/services/supabase.js](../../../js/services/supabase.js).

## Regras (faça)

- Use o cliente compartilhado e propague erro com `if (error) throw error`:

  ```js
  import { supabase } from '../config.js'

  export async function getContas() {
    const { data, error } = await supabase.from('contas').select('*').order('nome')
    if (error) throw error
    return data
  }
  ```

- Faça **joins aninhados** do PostgREST em vez de múltiplas idas ao banco:

  ```js
  .select(`
    id_lancamento, data, descricao, valor, competencia,
    metodos      ( id, nome, afeta_saldo, id_tipo ),
    contas       ( id, nome, is_investimento ),
    categorias   ( id, nome, id_tipo ),
    subcategorias( id, nome )
  `)
  ```

- Aplique filtros condicionalmente encadeando no objeto query, e filtre por relação com
  `.is`/`.not`:

  ```js
  let query = supabase.from('lancamentos').select('*').order('data', { ascending: false })
  if (competencia) query = query.eq('competencia', competencia)
  // só parcelados:
  query = query.not('id_parcela', 'is', null)
  ```

- Excluir transferência remove **ambos os lados** pelo `id_transf` (ver
  `deletarTransferencia`).

- **Migrações** (Python, `Outros/`): upsert idempotente via REST com
  `Prefer: resolution=merge-duplicates` e `on-conflict` na chave natural.

## Anti-padrões (não faça)

- Não monte query crua dentro de uma aba quando já existe helper em `services/supabase.js`;
  adicione/edite o helper.
- Não faça N+1 (loop de queries) — prefira join aninhado ou um `.in(...)`.
- Não confie em ordenação do banco para agrupar; agrupe em memória por chave (ex.: mapa
  por `id_parcela`) quando precisar derivar status/totais.

## Referências

- PRD: `.spec/prd.md` (ADR-003, RF04, RF05)
- Skills relacionadas: `seguranca`, `convencoes`
