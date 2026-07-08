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

let competencia    = competenciaAtual()
let chartBarras    = null
let chartResultado = null
let chartEntradas  = null

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

    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title">Entradas vs Saídas</div>
        <span style="font-size:12px;color:var(--text-muted)">Últimos 6 meses</span>
      </div>
      <div style="height:220px;position:relative">
        <canvas id="chartBarras"></canvas>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px">
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Principais Categorias</div>
        <div id="listaCategorias"></div>
      </div>
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Últimos Lançamentos</div>
        <div id="listaUltimas"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="card-title">Resultado Mensal</div>
          <span style="font-size:12px;color:var(--text-muted)">Últimos 6 meses</span>
        </div>
        <div style="height:200px;position:relative">
          <canvas id="chartResultado"></canvas>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <div class="card-title">Evolução das Entradas</div>
          <span style="font-size:12px;color:var(--text-muted)">Últimos 6 meses</span>
        </div>
        <div style="height:200px;position:relative">
          <canvas id="chartEntradas"></canvas>
        </div>
      </div>
    </div>
  `
}

async function carregarDados() {
  document.getElementById('periodLabel').textContent = formatCompetencia(competencia)

  chartBarras?.destroy();    chartBarras    = null
  chartResultado?.destroy(); chartResultado = null
  chartEntradas?.destroy();  chartEntradas  = null

  try {
    const compAnt = addMeses(competencia, -1)
    const [lancamentos, lancamentosAnt, totaisMeses] = await Promise.all([
      getLancamentos({ competencia }),
      getLancamentos({ competencia: compAnt }),
      buscarTotaisMeses(),
    ])

    renderKPIs(lancamentos)
    renderComparativo(totaisMeses)
    renderCategorias(lancamentos, lancamentosAnt)
    renderUltimas(lancamentos)
    renderResultadoMeses(totaisMeses)
    renderEvolucaoEntradas(totaisMeses)
  } catch (err) {
    console.error(err)
  }
}

// Busca e agrega os últimos 6 meses em uma única query
async function buscarTotaisMeses() {
  const meses = []
  for (let i = 5; i >= 0; i--) meses.push(addMeses(competencia, -i))

  const { data, error } = await supabase
    .from('lancamentos')
    .select('valor, competencia, metodos(id, nome, id_tipo), categorias(id, id_tipo)')
    .gte('competencia', meses[0])
    .lte('competencia', meses[meses.length - 1])

  if (error) throw error

  return meses.map(m => {
    const doMes    = (data ?? []).filter(l => l.competencia === m)
    const entradas = doMes.filter(eEntrada).reduce((s, l) => s + Math.abs(l.valor), 0)
    const saidas   = doMes.filter(eSaida).reduce((s, l) => s + Math.abs(l.valor), 0)
    const label    = new Date(m + 'T00:00:00')
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace(/^\w/, c => c.toUpperCase())
    return { competencia: m, label, entradas, saidas, resultado: entradas - saidas }
  })
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
      <div class="card-value valor-fatura">${formatBRL(fatura)}</div>
    </div>
    <div class="card">
      <div class="card-title">Saldo Final</div>
      <div class="card-value ${saldo >= 0 ? 'valor-entrada' : 'valor-saida'}">${formatBRL(saldo)}</div>
    </div>
  `
}

function renderComparativo(totais) {
  chartBarras = new Chart(document.getElementById('chartBarras'), {
    type: 'bar',
    data: {
      labels: totais.map(t => t.label),
      datasets: [
        {
          label: 'Entradas',
          data: totais.map(t => t.entradas),
          backgroundColor: 'rgba(16,185,129,0.80)',
          borderRadius: 5,
          borderSkipped: false,
        },
        {
          label: 'Saídas',
          data: totais.map(t => t.saidas),
          backgroundColor: 'rgba(220,38,38,0.72)',
          borderRadius: 5,
          borderSkipped: false,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            font: { family: 'Sora', size: 11 },
            boxWidth: 10,
            boxHeight: 10,
            borderRadius: 3,
            useBorderRadius: true,
          }
        },
        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatBRL(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af' } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af', callback: v => `R$ ${(v/1000).toFixed(1)}k` }
        }
      }
    }
  })
}

function renderResultadoMeses(totais) {
  const cores = totais.map(t =>
    t.resultado >= 0 ? 'rgba(16,185,129,0.82)' : 'rgba(220,38,38,0.75)'
  )

  chartResultado = new Chart(document.getElementById('chartResultado'), {
    type: 'bar',
    data: {
      labels: totais.map(t => t.label),
      datasets: [{
        label: 'Resultado',
        data: totais.map(t => t.resultado),
        backgroundColor: cores,
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `Resultado: ${formatBRL(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af' } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af', callback: v => `R$ ${(v/1000).toFixed(1)}k` }
        }
      }
    }
  })
}

function renderEvolucaoEntradas(totais) {
  chartEntradas = new Chart(document.getElementById('chartEntradas'), {
    type: 'line',
    data: {
      labels: totais.map(t => t.label),
      datasets: [{
        label: 'Entradas',
        data: totais.map(t => t.entradas),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.35,
        pointRadius: 4,
        pointBackgroundColor: '#10b981',
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointHoverRadius: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `Entradas: ${formatBRL(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af' } },
        y: {
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Sora', size: 11 }, color: '#9ca3af', callback: v => `R$ ${(v/1000).toFixed(1)}k` }
        }
      }
    }
  })
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
  const top8  = Object.entries(atual).sort((a, b) => b[1] - a[1]).slice(0, 8)

  if (!top8.length) {
    document.getElementById('listaCategorias').innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">Nenhum dado</p>`
    return
  }

  const maxRef = Math.max(...top8.map(([, v]) => v), ...top8.map(([k]) => ant[k] || 0), 1)

  // Cabeçalho e linhas compartilham UM único grid (não um grid por linha),
  // senão cada linha calcula suas colunas de forma independente e valores
  // mais largos (ex.: "R$ 2.174,10") desalinham as colunas entre linhas.
  const colunas = '1fr 92px minmax(72px,120px) 58px 84px'

  const cabecalho = `
    <span style="min-width:0;font-size:12px;color:var(--text-muted);font-weight:500;padding-bottom:8px;border-bottom:1px solid var(--border)">Categoria</span>
    <span style="min-width:0;font-size:12px;color:var(--text-muted);font-weight:500;text-align:right;padding-bottom:8px;border-bottom:1px solid var(--border)">Atual</span>
    <span style="min-width:0;font-size:12px;color:var(--text-muted);font-weight:500;text-align:center;padding-bottom:8px;border-bottom:1px solid var(--border)">vs Mês Anterior</span>
    <span style="min-width:0;font-size:12px;color:var(--text-muted);font-weight:500;text-align:center;padding-bottom:8px;border-bottom:1px solid var(--border)">Variação</span>
    <span style="min-width:0;font-size:12px;color:var(--text-muted);font-weight:500;text-align:right;padding-bottom:8px;border-bottom:1px solid var(--border)">Anterior</span>
  `

  const linhas = top8.map(([cat, valAtual], i) => {
    const valAnt = ant[cat]
    const cor    = corCat(cat)
    const pAtual = (valAtual / maxRef * 100).toFixed(1)
    const pAnt   = valAnt ? (valAnt / maxRef * 100).toFixed(1) : 0
    const borda  = i < top8.length - 1 ? 'border-bottom:1px solid var(--border)' : ''

    let badge
    if (!valAnt) {
      badge = `<span style="min-width:0;font-size:11px;color:var(--text-muted);text-align:center;padding:9px 0;${borda}">novo</span>`
    } else {
      const diff = (valAtual - valAnt) / valAnt * 100
      badge = diff <= 0
        ? `<span style="min-width:0;font-size:11px;font-weight:600;color:var(--green);text-align:center;padding:9px 0;${borda}">↓ ${Math.abs(diff).toFixed(0)}%</span>`
        : `<span style="min-width:0;font-size:11px;font-weight:600;color:var(--red);text-align:center;padding:9px 0;${borda}">↑ ${diff.toFixed(0)}%</span>`
    }

    return `
      <span style="min-width:0;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;align-self:center;padding:9px 0;${borda}" title="${cat}">${cat}</span>
      <span style="min-width:0;font-size:13px;font-weight:600;white-space:nowrap;text-align:right;align-self:center;padding:9px 0;${borda}">${formatBRL(valAtual)}</span>
      <div style="min-width:0;align-self:center;padding:9px 0;${borda}">
        <div style="position:relative;height:6px;border-radius:3px;background:var(--border);overflow:hidden">
          ${pAnt > 0 ? `<div style="position:absolute;left:0;top:0;height:100%;width:${pAnt}%;background:#d1d5db"></div>` : ''}
          <div style="position:absolute;left:0;top:0;height:100%;width:${pAtual}%;background:${cor}"></div>
        </div>
      </div>
      ${badge}
      <span style="min-width:0;font-size:12px;color:var(--text-muted);text-align:right;white-space:nowrap;align-self:center;padding:9px 0;${borda}">${valAnt ? formatBRL(valAnt) : '—'}</span>
    `
  }).join('')

  document.getElementById('listaCategorias').innerHTML = `
    <div style="display:grid;grid-template-columns:${colunas};gap:0 12px">
      ${cabecalho}
      ${linhas}
    </div>
  `
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
