// ============================================================
// SFP — Aba: Visão Geral
// ============================================================

import { getLancamentos } from '../services/supabase.js'
import { supabase } from '../config.js'
import { abrirNovoLancamento } from '../forms/lancamento.js'
import { formatBRL, formatData, formatCompetencia, competenciaAtual, addMeses, iniciais, badgeBanco, classeValor, sinaisValor } from '../services/formatters.js'

const COR_CAT = {
  'ALIMENTAÇÃO FORA': '#f97316',
  'NOITE':            '#8b5cf6',
  'TRANSPORTE':       '#3b82f6',
  'ESPORTES':         '#10b981',
  'ASSINATURAS':      '#e11d48',
  'CASA':             '#f59e0b',
  'COMPRAS':          '#ec4899',
  'DATE':             '#f472b6',
  'VÍDEO GAME':       '#84cc16',
  'CUIDADO PESSOAL':  '#14b8a6',
  'METROPOLITANO':    '#16a34a',
  'POD':              '#1a1a1a',
  'VIAGENS':          '#0ea5e9',
}

const corCat = nome => COR_CAT[nome?.toUpperCase()] ?? '#6b7280'

let competencia = competenciaAtual()
let chartLinha  = null

const eEntrada    = l => l.metodos?.id_tipo === 1 && l.categorias?.id_tipo !== 4
const eCredito    = l => l.metodos?.id_tipo === 2 && l.metodos?.nome === 'CRÉDITO'   && l.categorias?.id_tipo !== 4
const eDespesa    = l => l.metodos?.id_tipo === 2 && l.metodos?.nome !== 'CRÉDITO'   && l.metodos?.nome !== 'FATURA' && l.categorias?.id_tipo !== 4
const eSaida      = l => l.metodos?.id_tipo === 2 && l.metodos?.nome !== 'FATURA'    && l.categorias?.id_tipo !== 4
const eReembolsoC = l => l.metodos?.id_tipo === 4 && l.metodos?.nome === 'REEMBOLSO CARTÃO'

export async function render(container) {
  container.innerHTML = renderShell()
  bindEventos(container)
  await carregarDados()
}

function renderShell() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="period-btn" id="btnAnterior">&#8249;</button>
        <span class="period-label" id="periodLabel">${formatCompetencia(competencia)}</span>
        <button class="period-btn" id="btnProximo">&#8250;</button>
      </div>
      <button class="btn btn-primary" id="btnNovaTransacao">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
        Novo Lançamento
      </button>
    </div>

    <div class="kpi-grid" id="kpiGrid">
      ${Array(4).fill('<div class="card"><div class="card-title">...</div><div class="card-value" style="color:var(--text-muted)">—</div></div>').join('')}
    </div>

    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:24px">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Ritmo de Gastos</div>
        <div style="height:200px;position:relative">
          <canvas id="chartLinha"></canvas>
        </div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Saldo Atual</div>
        <div id="listaContas"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Principais Categorias</div>
        <div id="listaCategorias"></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Últimos Lançamentos</div>
        <div id="listaUltimas"></div>
      </div>
    </div>
  `
}

async function carregarDados() {
  document.getElementById('periodLabel').textContent = formatCompetencia(competencia)

  chartLinha?.destroy()
  chartLinha = null

  try {
    const compAnt = addMeses(competencia, -1)
    const [lancamentos, lancamentosAnt, contas] = await Promise.all([
      getLancamentos({ competencia }),
      getLancamentos({ competencia: compAnt }),
      calcSaldoContas(),
    ])

    renderKPIs(lancamentos)
    renderRitmoGastos(lancamentos)
    renderContas(contas)
    renderCategorias(lancamentos, lancamentosAnt)
    renderUltimas(lancamentos)
  } catch (err) {
    console.error(err)
  }
}

function renderKPIs(lancamentos) {
  const soma = filtro => lancamentos.filter(filtro).reduce((s, l) => s + Math.abs(l.valor), 0)

  const receitas = soma(eEntrada)
  const despesas = soma(eDespesa)
  const fatura   = soma(eCredito) - soma(eReembolsoC)
  const saldo    = receitas - despesas - fatura

  document.getElementById('kpiGrid').innerHTML = `
    <div class="card">
      <div class="card-title">Receitas</div>
      <div class="card-value valor-entrada">${formatBRL(receitas)}</div>
    </div>
    <div class="card">
      <div class="card-title">Despesas</div>
      <div class="card-value valor-saida">${formatBRL(despesas)}</div>
    </div>
    <div class="card">
      <div class="card-title">Fatura</div>
      <div class="card-value valor-saida">${formatBRL(fatura)}</div>
    </div>
    <div class="card">
      <div class="card-title">Saldo Final</div>
      <div class="card-value ${saldo >= 0 ? 'valor-entrada' : 'valor-saida'}">${formatBRL(saldo)}</div>
    </div>
  `
}

function renderRitmoGastos(lancamentos) {
  const ano  = parseInt(competencia.slice(0, 4))
  const mes  = parseInt(competencia.slice(5, 7))
  const dias = new Date(ano, mes, 0).getDate()

  const gastosDia = Array(dias).fill(0)
  for (const l of lancamentos) {
    if (!l.data) continue
    if (l.categorias?.id_tipo === 4) continue
    const nome = l.metodos?.nome
    if (nome !== 'PIX' && nome !== 'CRÉDITO') continue
    const d = parseInt(l.data.slice(8, 10)) - 1
    if (d >= 0 && d < dias) gastosDia[d] += Math.abs(l.valor)
  }

  const acumulado = []
  let soma = 0
  for (const v of gastosDia) { soma += v; acumulado.push(soma) }

  chartLinha = new Chart(document.getElementById('chartLinha'), {
    type: 'line',
    data: {
      labels: Array.from({ length: dias }, (_, i) => i + 1),
      datasets: [{
        data: acumulado,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37,99,235,0.07)',
        borderWidth: 2,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHoverRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => formatBRL(ctx.parsed.y) } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af', maxTicksLimit: 10 }
        },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: 'Sora', size: 11 },
            color: '#9ca3af',
            callback: v => `R$ ${(v / 1000).toFixed(1)}k`
          }
        }
      }
    }
  })
}

async function calcSaldoContas() {
  const hoje = new Date().toISOString().split('T')[0]

  const [{ data: contas, error: errContas }, { data: lancamentos, error: errLanc }] = await Promise.all([
    supabase.from('contas').select('id, nome, saldo_inicial, is_investimento'),
    supabase.from('lancamentos')
      .select('id_lancamento, id_conta, valor, data, metodos(id, nome, afeta_saldo, id_tipo)')
      .lte('data', hoje),
  ])

  if (errContas) throw errContas
  if (errLanc)   throw errLanc

  for (const conta of contas) {
    let saldo       = conta.saldo_inicial ?? 0
    const lances    = lancamentos.filter(l => l.id_conta === conta.id)

    for (const l of lances) {
      const metodo = l.metodos
      const valor  = Math.abs(l.valor)

      if (!metodo?.afeta_saldo) continue

      if (!conta.is_investimento) {
        if (metodo.nome === 'CONTA')    saldo += valor
        if (metodo.nome === 'PIX')      saldo -= valor
        if (metodo.nome === 'FATURA')   saldo -= valor
        if (metodo.nome === 'ENTRADA')  saldo += valor
        if (metodo.nome === 'SAÍDA')    saldo -= valor
        if (metodo.nome === 'APORTE')   saldo -= valor
        if (metodo.nome === 'RETIRADA') saldo += valor
      } else {
        if (metodo.nome === 'APORTE')     saldo += valor
        if (metodo.nome === 'RETIRADA')   saldo -= valor
        if (metodo.nome === 'RENDIMENTO') saldo += valor
      }
    }

    conta.saldo_calculado = saldo
  }

  return contas
}

function renderContas(contas) {
  if (!contas.length) {
    document.getElementById('listaContas').innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:16px 0">Nenhuma conta</p>`
    return
  }

  document.getElementById('listaContas').innerHTML = contas.map((c, i) => {
    const saldo = c.saldo_calculado ?? 0
    return `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;${i < contas.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        ${badgeBanco(c.nome)}
        <span style="font-size:14px;font-weight:600;color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">
          ${formatBRL(saldo)}
        </span>
      </div>
    `
  }).join('')
}

function renderCategorias(lancamentos, lancamentosAnt) {
  const agregar = lista => {
    const acc = {}
    for (const l of lista.filter(eSaida)) {
      const k = l.categorias?.nome || 'OUTROS'
      acc[k] = (acc[k] || 0) + Math.abs(l.valor)
    }
    return acc
  }

  const atual = agregar(lancamentos)
  const ant   = agregar(lancamentosAnt)

  const top8 = Object.entries(atual).sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (!top8.length) {
    document.getElementById('listaCategorias').innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">Nenhum dado</p>`
    return
  }

  const maxRef = Math.max(
    ...top8.map(([, v]) => v),
    ...top8.map(([k]) => ant[k] || 0),
    1
  )

  const cabecalho = `
    <div style="display:grid;grid-template-columns:1fr auto minmax(72px,120px) 58px auto;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">
      <span style="font-size:12px;color:var(--text-muted);font-weight:500">Categoria</span>
      <span style="font-size:12px;color:var(--text-muted);font-weight:500">Atual</span>
      <span style="font-size:12px;color:var(--text-muted);font-weight:500;text-align:center">vs Mês Anterior</span>
      <span style="font-size:12px;color:var(--text-muted);font-weight:500;text-align:center">Variação</span>
      <span style="font-size:12px;color:var(--text-muted);font-weight:500;text-align:right">Anterior</span>
    </div>
  `

  document.getElementById('listaCategorias').innerHTML = cabecalho + top8.map(([cat, valAtual], i) => {
    const valAnt = ant[cat]
    const cor    = corCat(cat)
    const pAtual = (valAtual / maxRef * 100).toFixed(1)
    const pAnt   = valAnt ? (valAnt / maxRef * 100).toFixed(1) : 0

    let badge
    if (!valAnt) {
      badge = `<span style="font-size:11px;color:var(--text-muted)">novo</span>`
    } else {
      const diff = (valAtual - valAnt) / valAnt * 100
      badge = diff <= 0
        ? `<span style="font-size:11px;font-weight:600;color:var(--green)">↓ ${Math.abs(diff).toFixed(0)}%</span>`
        : `<span style="font-size:11px;font-weight:600;color:var(--red)">↑ ${diff.toFixed(0)}%</span>`
    }

    return `
      <div style="display:grid;grid-template-columns:1fr auto minmax(72px,120px) 58px auto;align-items:center;gap:12px;padding:9px 0;${i < top8.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        <span style="font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${cat}">${cat}</span>
        <span style="font-size:13px;font-weight:600;white-space:nowrap">${formatBRL(valAtual)}</span>
        <div style="position:relative;height:6px;border-radius:3px;background:var(--border);overflow:hidden">
          ${pAnt > 0 ? `<div style="position:absolute;left:0;top:0;height:100%;width:${pAnt}%;background:#d1d5db"></div>` : ''}
          <div style="position:absolute;left:0;top:0;height:100%;width:${pAtual}%;background:${cor}"></div>
        </div>
        ${badge}
        <span style="font-size:12px;color:var(--text-muted);text-align:right;white-space:nowrap">${valAnt ? formatBRL(valAnt) : '—'}</span>
      </div>
    `
  }).join('')
}

function renderUltimas(lancamentos) {
  const items = lancamentos.slice(0, 8)

  if (!items.length) {
    document.getElementById('listaUltimas').innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">Nenhuma transação</p>`
    return
  }

  document.getElementById('listaUltimas').innerHTML = items.map((l, i) => {
    const idTipo = l.metodos?.id_tipo
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;${i < items.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        <div class="avatar">${iniciais(l.descricao)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.descricao}</div>
          <div style="display:flex;gap:5px;margin-top:3px;flex-wrap:wrap">
            <span class="badge badge-cat" style="font-size:10px;padding:2px 7px">${l.categorias?.nome || '—'}</span>
            ${badgeBanco(l.contas?.nome)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div class="${classeValor(idTipo)}" style="font-size:13px">${sinaisValor(idTipo, l.valor)}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${formatData(l.data)}</div>
        </div>
      </div>
    `
  }).join('')
}

function bindEventos(container) {
  document.getElementById('btnAnterior').addEventListener('click', async () => {
    competencia = addMeses(competencia, -1)
    await carregarDados()
  })
  document.getElementById('btnProximo').addEventListener('click', async () => {
    competencia = addMeses(competencia, 1)
    await carregarDados()
  })
  document.getElementById('btnNovaTransacao').addEventListener('click', abrirNovoLancamento)
  window.addEventListener('sfp:lancamento-salvo', carregarDados)
}
