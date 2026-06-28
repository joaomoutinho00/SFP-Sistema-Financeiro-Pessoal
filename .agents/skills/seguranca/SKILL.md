---
name: seguranca
description: >-
  Modelo de segurança do SFP: app single-user sem login no front, chave publishable do
  Supabase no código e proteção por RLS. Use ao mexer em config.js, credenciais, exposição
  de dados, ou ao avaliar deploy público. Não use para detalhes de query (ver database).
---

# Segurança — SFP

## Visão geral

App de uso **pessoal single-user**, sem camada de autenticação no front. A única chave
no código é a **publishable** do Supabase ([js/config.js](../../../js/config.js)). A
barreira de acesso aos dados é o **Row Level Security (RLS)** configurado no Supabase.

## Regras (faça)

- Apenas a chave **publishable** pode existir no repositório:

  ```js
  // js/config.js — OK: publishable key
  export const SUPABASE_KEY = "sb_publishable_..."
  ```

- A `service_role key` (e qualquer secret de admin) é **proibida** no repositório e no
  front. Operações privilegiadas, se necessárias, ficam fora do código versionado.

- Antes de qualquer **deploy público**, revise as políticas RLS de todas as tabelas
  (`lancamentos`, `contas`, `faturas`, …): com a publishable key, o front só deve
  conseguir o que o RLS permitir.

- Trate os dados como **financeiros pessoais**: não exponha valores/saldos em logs
  enviados a terceiros; `console.error` local é aceitável para depuração.

## Anti-padrões (não faça)

- Não commite `service_role key`, tokens de admin ou `.env` com secrets.

  ```js
  // errado: service_role no front
  export const SUPABASE_KEY = "sb_service_role_..."
  ```

- Não assuma que "sem login" significa "sem proteção": o RLS é a defesa. Não desative RLS
  para "facilitar" uma query.

- Não publique a aplicação em host público sem antes confirmar RLS — a chave publishable
  fica visível no bundle estático.

## Referências

- PRD: `.spec/prd.md` (Restrições/Segurança, RNF02, ADR-003)
- Skills relacionadas: `database`
