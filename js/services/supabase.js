// ============================================================
// SFP — Service: Supabase helpers
// Funções genéricas de acesso ao banco
// ============================================================

import { supabase } from '../config.js'

// Busca lançamentos com filtros opcionais
export async function getLancamentos({ competencia, banco, tipo, categoria, subcategoria, busca, dataInicio, dataFim } = {}) {
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
      contas   ( id, nome, is_investimento ),
      categorias   ( id, nome, id_tipo ),
      subcategorias ( id, nome )
    `)
    .order('data', { ascending: false })

  if (competencia) query = query.eq('competencia', competencia)
  if (dataInicio)  query = query.gte('data', dataInicio)
  if (dataFim)     query = query.lte('data', dataFim)
  if (banco)        query = query.eq('id_conta', banco)
  if (categoria)    query = query.eq('id_categoria', categoria)
  if (subcategoria) query = query.eq('id_subcategoria', subcategoria)

  const { data, error } = await query
  if (error) throw error

  let resultado = data

  // Filtro de busca por descrição (insensível a acentos e caixa)
  if (busca) {
    const norm  = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const termo = norm(busca)
    resultado   = resultado.filter(l => norm(l.descricao ?? '').includes(termo))
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

// Busca todos os métodos
export async function getMetodos() {
  const { data, error } = await supabase.from('metodos').select('*').order('nome')
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

// Exclui um lançamento
export async function deletarLancamento(idLancamento) {
  const { error } = await supabase.from('lancamentos').delete().eq('id_lancamento', idLancamento)
  if (error) throw error
}

// Exclui todos os lançamentos de uma transferência (ambos os lados)
export async function deletarTransferencia(idTransf) {
  const { error } = await supabase.from('lancamentos').delete().eq('id_transf', idTransf)
  if (error) throw error
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

// Busca dados agregados para o DRE (ano inteiro, uma query)
export async function getDRE(ano) {
  const { data, error } = await supabase
    .from('lancamentos')
    .select(`
      valor,
      competencia,
      metodos       ( id, nome, id_tipo ),
      categorias    ( id, nome ),
      subcategorias ( id, nome )
    `)
    .gte('competencia', `${ano}-01-01`)
    .lte('competencia', `${ano}-12-01`)

  if (error) throw error

  const secoes = { receitas: {}, despesas: {}, investimentos: {} }
  const totaisMes = {
    receitas:      new Array(12).fill(0),
    despesas:      new Array(12).fill(0),
    investimentos: new Array(12).fill(0),
    resultado:     new Array(12).fill(0),
  }

  for (const l of data) {
    if (!l.competencia) continue
    const mes    = parseInt(l.competencia.split('-')[1], 10) - 1
    if (mes < 0 || mes > 11) continue

    const idTipo = l.metodos?.id_tipo
    const metodo = l.metodos?.nome
    const valor  = Math.abs(l.valor)
    const cat    = l.categorias?.nome || 'SEM CATEGORIA'
    const sub    = l.subcategorias?.nome || null

    let secao = null
    if      (idTipo === 1)                              secao = 'receitas'
    else if (idTipo === 2 && metodo !== 'FATURA')       secao = 'despesas'
    else if (idTipo === 3 && metodo === 'INVESTIMENTO') secao = 'investimentos'

    if (!secao) continue

    const mapa = secoes[secao]
    if (!mapa[cat]) mapa[cat] = { total: 0, meses: new Array(12).fill(0), subcats: {} }
    mapa[cat].meses[mes] += valor
    mapa[cat].total      += valor
    totaisMes[secao][mes] += valor

    if (sub) {
      if (!mapa[cat].subcats[sub])
        mapa[cat].subcats[sub] = { total: 0, meses: new Array(12).fill(0) }
      mapa[cat].subcats[sub].meses[mes] += valor
      mapa[cat].subcats[sub].total      += valor
    }
  }

  for (let i = 0; i < 12; i++)
    totaisMes.resultado[i] = totaisMes.receitas[i] - totaisMes.despesas[i]

  const toArr = mapa => Object.entries(mapa)
    .sort((a, b) => b[1].total - a[1].total)
    .map(([nome, d]) => ({
      nome,
      total: d.total,
      meses: d.meses,
      subcats: Object.entries(d.subcats)
        .sort((a, b) => b[1].total - a[1].total)
        .map(([sn, sd]) => ({ nome: sn, total: sd.total, meses: sd.meses }))
    }))

  return {
    ano,
    receitas:      toArr(secoes.receitas),
    despesas:      toArr(secoes.despesas),
    investimentos: toArr(secoes.investimentos),
    totaisMes,
  }
}

// Gera próximo ID de transferência
export async function proximoIdTransf() {
  const { data, error } = await supabase
    .from('lancamentos')
    .select('id_transf')
    .not('id_transf', 'is', null)
    .order('id_transf', { ascending: false })
    .limit(1)

  if (error) throw error
  if (!data.length) return 'T000001'

  const ultimo = data[0].id_transf
  const num    = parseInt(ultimo.replace('T', '')) + 1
  return `T${String(num).padStart(6, '0')}`
}
