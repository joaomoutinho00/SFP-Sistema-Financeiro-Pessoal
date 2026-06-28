#!/usr/bin/env bash
#
# pre-commit.sh — hook determinístico executado antes de cada commit.
#
# Projeto vanilla (sem package.json/lint/testes). A única verificação determinística
# disponível é a checagem de SINTAXE dos módulos JS via `node --check`.
#
# Modo seguro: enquanto ENFORCE=false, o hook apenas avisa e libera o commit (exit 0).
# Após validar, defina ENFORCE=true para que erros de sintaxe BLOQUEIEM o commit.
#
# Registro (git nativo):
#   git config core.hooksPath .agents/hooks
# (o arquivo precisa estar executável: chmod +x .agents/hooks/pre-commit.sh)

set -euo pipefail

readonly ENFORCE=false

fail=0

# Checa sintaxe de cada .js staged (ignora removidos).
while IFS= read -r file; do
  [[ -z "$file" ]] && continue
  [[ "$file" == *.js ]] || continue
  [[ -f "$file" ]] || continue
  echo "→ node --check ${file}"
  if ! node --check "$file"; then
    echo "  ✗ erro de sintaxe em ${file}"
    fail=1
  fi
done < <(git diff --cached --name-only --diff-filter=ACM)

if [[ "$fail" -ne 0 ]]; then
  if [[ "$ENFORCE" == true ]]; then
    echo "✗ Commit bloqueado: corrija os erros de sintaxe acima."
    exit 1
  fi
  echo "⚠ Erros de sintaxe encontrados (hook em modo seguro — commit liberado)."
  echo "  Defina ENFORCE=true em .agents/hooks/pre-commit.sh para bloquear."
fi

echo "✓ Hook concluído — commit liberado"
exit 0
