# AGENTS.md — Constituição da IA neste projeto

> Conduta global do agente, válida em toda tarefa, independente do domínio.
> O `AGENTS.md` da raiz apenas redireciona para este arquivo.
> Regras invariantes escritas como afirmações EARS ubíquas ("O projeto DEVE …").

## Linguagem

A comunicação, o código, os comentários, a UI e as mensagens de commit DEVEM ser em
**pt-BR**. Tom técnico, objetivo e direto.

## Escopo de execução

O agente DEVE executar apenas o que for explicitamente solicitado. Sem inferências,
otimizações automáticas ou refatorações não pedidas. Em mudanças, manter o estilo do
código vizinho.

## Stack e gerenciador de pacotes

- O projeto DEVE permanecer **vanilla**: JavaScript ES Modules servido diretamente, sem
  build, bundler, transpilador ou framework SPA.
- O projeto NÃO DEVE introduzir `package.json`, `node_modules` ou gerenciador de pacotes
  (npm/pnpm/yarn). Novas dependências de runtime entram via **CDN** com `import` dinâmico,
  e somente com justificativa e confirmação.
- Os scripts auxiliares em `Outros/` são Python (stdlib + openpyxl) e DEVEM permanecer
  independentes do front.

## Restrições gerais

- O agente NÃO DEVE servir/abrir a aplicação (`serve`, `http.server`) sem solicitação.
- O agente NÃO DEVE criar testes, build ou documentação sem solicitação explícita.
- O agente NÃO DEVE introduzir dependências sem justificativa técnica e confirmação.
- O agente NÃO DEVE escrever ou commitar a **`service_role key`** do Supabase no
  repositório. Apenas a chave **publishable** é permitida em `js/config.js`.
- O agente NÃO DEVE executar migrações de dados (`Outros/*.py`) sem solicitação explícita.

## Padrões de código

- Aplicar SRP: separar responsabilidades por camada — `tabs/` (UI/render), `services/`
  (acesso a dados e formatação), `forms/` (formulários).
- Cada aba DEVE expor `export async function render(container)`.
- Acesso ao Supabase DEVE passar pelos helpers de `js/services/` quando já existir um;
  evitar duplicar queries inline nas abas.
- Tratamento de erro: `if (error) throw error` nos helpers; nas abas, capturar, logar em
  `console.error` e renderizar mensagem amigável sem quebrar a navegação.
- Valores monetários via `formatBRL`; datas/competências via os helpers de
  `js/services/formatters.js`. Não reimplementar formatação.

## Padrões de domínio

- IDs de negócio são strings sequenciais: `Lnnnnnn`, `Pnnnnnn`, `Tnnnnnn`. Gerar pelos
  helpers `proximoIdLancamento/Parcela/Transf`.
- `competencia` é sempre o primeiro dia do mês (`YYYY-MM-01`).
- Excluir transferência remove **ambos os lados** (mesmo `id_transf`).

## Convenção de commits

Conventional Commits em pt-BR (`feat:`, `fix:`, `chore:`…). Uma branch por feature/fix
(`feat/...`, `fix/...`), merge na `main`.

## Em caso de ambiguidade

Interrompa, formule perguntas objetivas e apresente alternativas numeradas. Não tome
decisões críticas (escopo, segurança, mudança de stack) sem confirmação explícita.
