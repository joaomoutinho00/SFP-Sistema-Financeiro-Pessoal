---
name: arquitetura
description: >-
  Arquitetura do SFP: SPA vanilla com router de abas por import dinâmico e camadas
  tabs/services/forms. Use ao criar uma aba nova, alterar o roteamento, mover lógica
  entre camadas ou decidir onde um código deve viver. Não use para detalhes de query
  Supabase (ver skill database) nem para regras de seguranca.
---

# Arquitetura — SFP

## Visão geral

App single-page **vanilla** servido sem build. `js/app.js` inicializa o Supabase e o
router; `js/router.js` troca abas e importa o módulo da aba sob demanda. Cada aba é um
módulo isolado em `js/tabs/`. Lógica reutilizável vive em `js/services/`; formulários em
`js/forms/`.

## Regras (faça)

- Toda aba é um módulo em `js/tabs/<aba>.js` que exporta `render(container)`:

  ```js
  // js/tabs/<aba>.js
  import { supabase } from '../config.js'
  import { formatBRL } from '../services/formatters.js'

  export async function render(container) {
    container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
    try {
      const dados = await buscar()
      renderTela(container, dados)
    } catch (err) {
      console.error(err)
      container.innerHTML = `<p style="color:var(--red)">Erro ao carregar.</p>`
    }
  }
  ```

- Ao adicionar uma aba, registre-a **nos dois lugares**: o botão em
  [index.html](../../../index.html) (`<button class="nav-tab" data-tab="...">`) e o mapa
  `TABS` em [js/router.js](../../../js/router.js):

  ```js
  const TABS = {
    'minha-aba': () => import('./tabs/minha-aba.js'),
  }
  ```

- Coloque acesso a dados em `js/services/` e formatação em
  `js/services/formatters.js`. A aba consome services, não duplica queries.

## Anti-padrões (não faça)

- Não introduza framework, bundler ou `package.json` — o projeto é vanilla por decisão
  (ADR-001). Dependências novas vêm via CDN com `import` dinâmico.

  ```js
  // errado: import 'react' / criar webpack.config.js / npm install
  ```

- Não confie em re-render automático ao voltar para uma aba: o router cacheia abas já
  carregadas (`loaded` Set) e **não** chama `render` de novo. Se a aba precisa atualizar,
  exponha um handler explícito.

- Não deixe uma aba derrubar as outras: sempre `try/catch` no `render`.

## Referências

- PRD: `.spec/prd.md` (ADR-001, ADR-002, RNF03, RNF04)
- Skills relacionadas: `database`, `convencoes`, `tecnologias/javascript`
