# AGENTS.md

> Ponteiro raiz para agentes genéricos (Cursor, Codex, Copilot, Windsurf, Gemini…).
> Lido automaticamente em toda interação. Não duplique conteúdo aqui — redirecione.
> Para Claude Code, o entry point equivalente é CLAUDE.md (também na raiz).

## Constituição

Siga **integralmente** as regras em [.agents/rules/AGENTS.md](.agents/rules/AGENTS.md)
em qualquer tarefa neste repositório.

## Contexto de produto

Antes de decisões de escopo, consulte o PRD em [.spec/prd.md](.spec/prd.md) e as
specs de feature em `.spec/specs/`.

## Skills

Carregue automaticamente as skills de `.agents/skills/` cuja `description`
corresponda à tarefa:

- `arquitetura` — SPA vanilla, router de abas, camadas `tabs/`/`services/`/`forms/`.
- `convencoes` — nomenclatura pt-BR, IDs sequenciais, formatação, render por template string.
- `seguranca` — chave publishable, RLS, dados financeiros, proibição de `service_role`.
- `database` — Supabase/PostgREST, queries `supabase-js`, joins aninhados.
- `tecnologias/javascript` — idioms e anti-padrões do ES Modules vanilla.

> `.claude/skills/` aponta para o mesmo diretório via symlink — a fonte é única.
