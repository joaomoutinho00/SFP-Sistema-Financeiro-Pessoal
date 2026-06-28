---
name: javascript
description: >-
  Idioms e anti-padrões do JavaScript ES Modules vanilla do SFP (sem build/framework):
  import dinâmico, top-level await, render por template string com event listeners,
  estado em escopo de módulo. Use ao escrever/alterar qualquer arquivo .js do front.
  Não use para os scripts Python de migração em Outros/.
---

# JavaScript (ES Modules vanilla) — SFP

## Visão geral

Front 100% vanilla: ES Modules nativos no navegador, **sem** transpilação, bundler ou
framework. Dependências de runtime vêm de CDN. A UI é montada com template strings e
event listeners anexados após o `innerHTML`.

## Regras (faça)

- Carregue dependências externas por **CDN** com `import` dinâmico (como `app.js` faz com
  o supabase-js):

  ```js
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
  ```

- Renderize com template strings e **anexe os listeners depois** de setar `innerHTML`,
  consultando dentro do container:

  ```js
  container.innerHTML = `<button id="btnAndamento">Em andamento</button>`
  container.querySelector('#btnAndamento').addEventListener('click', () => {
    filtroStatus = 'andamento'
    renderTela(container, grupos)   // re-render explícito
  })
  ```

- Use encadeamento opcional e nullish para dados do banco que podem faltar:
  `l.metodos?.id_tipo`, `ref.qtd_parcelas ?? parcelas.length`, `data ?? []`.

- Estado de tela vive em **escopo de módulo** (ex.: `let filtroStatus = 'andamento'`);
  re-render é sempre uma chamada explícita à função de render.

## Anti-padrões (não faça)

- Não introduza sintaxe que exija build (JSX, TypeScript, decorators) nem `import` de
  pacotes npm locais — não há toolchain.

  ```js
  // errado: import _ from 'lodash'  (sem node_modules)
  // certo:  import dinâmico de CDN, ou função utilitária própria em services/
  ```

- Não delegue eventos no `document` quando o container é recriado a cada render; prefira
  anexar no elemento recém-criado para evitar listeners duplicados/órfãos.

- Não dependa de `this` em módulos; use funções puras e imports nomeados.

## Referências

- PRD: `.spec/prd.md` (ADR-001, ADR-002, RNF01)
- Skills relacionadas: `arquitetura`, `convencoes`, `database`
