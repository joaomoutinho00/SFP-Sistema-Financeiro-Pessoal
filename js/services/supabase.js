// ============================================================
// SFP — Service: Supabase helpers
// Funções genéricas de acesso ao banco
// ============================================================

import { supabase } from '../config.js'

// Busca lançamentos com filtros opcionais
export async function getLancamentos({ competencia, banco, tipo, categoria, busca } = {}) {
  let query = supabase
    .from('lancamentos')
    .select(`
      id_lancamento,
      data,
      descricao,
      valor,
      qtd_parcelas,
      parcela_atual,
      id_parcela,
      id_transf,
      competencia,
      id_fatura,
      metodos ( id, nome, afeta_saldo, id_tipo ),
      contas   ( id, nome ),
      categorias   ( id, nome, id_tipo ),
      subcategorias ( id, nome )
    `)
    .order('data', { ascending: false })

  if (competencia) query = query.eq('competencia', competencia)
  if (banco)       query = query.eq('id_conta', banco)
  if (categoria)   query = query.eq('id_categoria', categoria)

  const { data, error } = await query
  if (error) throw error

  let resultado = data

  // Filtro de busca por descrição
  if (busca) {
    const termo = busca.toLowerCase()
    resultado = resultado.filter(l =>
      l.descricao.toLowerCase().includes(termo)
    )
  }

  // Filtro de tipo (ENTRADA=1, SAÍDA=2, TRANSF=3) via id_tipo do método
  if (tipo) {
    resultado = resultado.filter(l => l.metodos?.id_tipo === Number(tipo))
  }

  return resultado
}

// Busca resumo do mês (receitas, despesas, fatura)
export async function getResumoMes(competencia) {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('valor, metodos ( id, nome, afeta_saldo, id_tipo )')
    .eq('competencia', competencia)

  if (error) throw error

  let receitas  = 0
  let despesas  = 0
  let fatura    = 0
  let investimentos = 0

  for (const l of data) {
    const idTipo  = l.metodos?.id_tipo
    const metodo  = l.metodos?.nome
    const valor   = Math.abs(l.valor)

    if (idTipo === 1) {
      // ENTRADA
      receitas += valor
    } else if (idTipo === 2) {
      if (metodo === 'CRÉDITO') {
        fatura += valor
      } else if (metodo === 'PIX' || metodo === 'CONTA') {
        despesas += valor
      }
      // FATURA (pagamento) não entra em despesas
    } else if (idTipo === 3) {
      if (metodo === 'INVESTIMENTO') {
        investimentos += valor
      }
      // TRANSF não entra no resultado
    }
  }

  const total      = receitas - despesas - fatura
  const totalFinal = total - investimentos

  return { receitas, despesas, fatura, total, investimentos, totalFinal }
}

// Busca faturas de uma competência
export async function getFaturas(competencia) {
  const { data, error } = await supabase
    .from('faturas')
    .select('*, contas ( id, nome )')
    .eq('competencia', competencia)

  if (error) throw error
  return data
}

// Busca contas
export async function getContas() {
  const { data, error } = await supabase
    .from('contas')
    .select('*')
    .order('nome')

  if (error) throw error
  return data
}

// Busca categorias
export async function getCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('*, subcategorias (*)')
    .order('nome')

  if (error) throw error
  return data
}

// Busca métodos por tipo
export async function getMetodosPorTipo(idTipo) {
  const { data, error } = await supabase
    .from('metodos')
    .select('*')
    .eq('id_tipo', idTipo)

  if (error) throw error
  return data
}

// Insere novo lançamento
export async function inserirLancamento(lancamento) {
  const { data, error } = await supabase
    .from('lancamentos')
    .insert(lancamento)
    .select()

  if (error) throw error
  return data
}

// Gera próximo ID de lançamento
export async function proximoIdLancamento() {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id_lancamento')
    .order('id_lancamento', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data.length) return 'L000001'

  const ultimo = data[0].id_lancamento
  const num    = parseInt(ultimo.replace('L', '')) + 1
  return `L${String(num).padStart(6, '0')}`
}

// Gera próximo ID de parcela
export async function proximoIdParcela() {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id_parcela')
    .not('id_parcela', 'is', null)
    .order('id_parcela', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data.length) return 'P000001'

  const ultimo = data[0].id_parcela
  const num    = parseInt(ultimo.replace('P', '')) + 1
  return `P${String(num).padStart(6, '0')}`
}
