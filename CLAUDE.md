# CLAUDE.md

> Lido automaticamente no início de toda sessão Claude Code.
> Mantenha abaixo de 200 linhas; conteúdo extenso vive em `.agents/skills/`.

## Constituição

Siga **integralmente** as regras em [.agents/rules/AGENTS.md](.agents/rules/AGENTS.md)
em qualquer tarefa neste repositório.

## Contexto de produto

- PRD: [.spec/prd.md](.spec/prd.md)
- Specs de feature: `.spec/specs/` (consulte antes de qualquer decisão de escopo)

## Visão rápida

SFP — Sistema Financeiro Pessoal. Web app **vanilla** (JavaScript ES Modules, sem build)
sobre Supabase (PostgreSQL). SPA com router de abas via `import()` dinâmico. Single-user.

## Skills do projeto

Skills vivem em `.agents/skills/` (expostas ao Claude Code via `.claude/skills/`).
Carregadas dinamicamente pela description — use `/[nome]` para invocar explicitamente.

| Skill | Quando carregar |
|-------|-----------------|
| `arquitetura` | Estrutura `js/`, abas, router, camadas services/forms |
| `convencoes` | Nomenclatura pt-BR, IDs sequenciais, formatação, render |
| `seguranca` | Chave publishable, RLS, dados sensíveis, `config.js` |
| `database` | Queries Supabase/PostgREST, joins aninhados, migrations |
| `tecnologias/javascript` | Idioms e anti-padrões do ES Modules vanilla |

## Comandos úteis

Não há build, lint, testes ou `package.json` — projeto vanilla (ver ADR-001 no PRD).

```bash
# Servir localmente (ES Modules exigem servidor HTTP)
npx serve .
# ou
python -m http.server 8080

# Verificar sintaxe de um módulo JS (sem executar)
node --check js/<arquivo>.js

# Scripts de migração (Python) — rodar manualmente em Outros/
python Outros/Migrar.py
python Outros/Criar_faturas.py
```

## Convenções não óbvias

- Domínio em pt-BR (`lancamentos`, `contas`, `categorias`, `competencia`).
- Cada aba em `js/tabs/<aba>.js` expõe `export async function render(container)`.
- IDs de negócio são strings sequenciais: `Lnnnnnn` (lançamento), `Pnnnnnn` (parcela),
  `Tnnnnnn` (transferência) — gerados em [js/services/supabase.js](js/services/supabase.js).
- `competencia` é sempre o **primeiro dia do mês** (`YYYY-MM-01`).
- Acesso a dados centralizado em `js/services/`; UI nunca monta query inline crua sem
  passar pela camada de service quando já existe helper.
