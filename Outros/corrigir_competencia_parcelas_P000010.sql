-- ============================================================
-- Correção pontual: competência de parcelas do plano P000010
-- ============================================================
--
-- Problema
-- --------
-- 9 parcelas do parcelamento P000010 ("Sócio torcedor - Metropolitano",
-- R$ 99,90) foram gravadas por uma versão antiga do gerador de parcelas com
-- `competencia` travada em 2026-06-01, enquanto `data` e `id_fatura` estavam
-- corretamente distribuídos nos meses jul/2026 a abr/2027.
--
-- Efeito: a Visão Geral (que agrupa a fatura por `competencia`) empilhava as
-- parcelas futuras em junho/2026, inflando a fatura do mês em 9 × 99,90 =
-- R$ 899,10, e deixava jul/2026…abr/2027 sem essas parcelas. A tela de Cartões
-- (que agrupa por `id_fatura`) já mostrava o valor correto.
--
-- Correção
-- --------
-- Realinhar a `competencia` de todo lançamento de crédito/reembolso à
-- competência da fatura à qual já está vinculado (que coincide com o primeiro
-- dia do mês da `data`). Idempotente: só toca linhas ainda divergentes.
--
-- O gerador atual (js/forms/lancamento.js) já grava a competência correta;
-- isto é apenas correção de dado legado.
--
-- Aplicado em 2026-07-03 — afetou 9 linhas (todas do P000010).

UPDATE lancamentos l
SET competencia = f.competencia
FROM faturas f, metodos m
WHERE l.id_fatura = f.id
  AND l.id_metodo = m.id
  AND m.nome IN ('CRÉDITO', 'REEMBOLSO CARTÃO')
  AND l.competencia <> f.competencia;

-- Validação (deve retornar 0):
-- SELECT COUNT(*)
-- FROM lancamentos l
-- JOIN faturas f ON f.id = l.id_fatura
-- JOIN metodos m ON m.id = l.id_metodo
-- WHERE m.nome IN ('CRÉDITO', 'REEMBOLSO CARTÃO')
--   AND l.competencia <> f.competencia;
