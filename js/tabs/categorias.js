// ============================================================
// SFP — Aba: Categorias
// ============================================================

import { supabase } from '../config.js'
import { formatBRL, formatCompetencia, competenciaAtual, addMeses } from '../services/formatters.js'

const COR_CAT = {
  'ALIMENTAÇÃO FORA':  '#f97316',
  'NOITE':             '#8b5cf6',
  'TRANSPORTE':        '#3b82f6',
  'ESPORTES':          '#10b981',
  'ASSINATURAS':       '#e11d48',
  'CASA':              '#f59e0b',
  'COMPRAS':           '#ec4899',
  'DATE':              '#f472b6',
  'VÍDEO GAME':        '#84cc16',
  'CUIDADO PESSOAL':   '#14b8a6',
  'METROPOLITANO':     '#16a34a',
  'POD':               '#1a1a1a',
  'VIAGENS':           '#0ea5e9',
  'CONHECIMENTO':      '#6366f1',
  'PRESENTES/DOAÇÕES': '#fb7185',
  'EXTRA':             '#a3e635',
  'OUTROS':            '#6b7280',
}

const corCat = nome => COR_CAT[nome?.toUpperCase()] ?? '#6b7280'

let competencia  = competenciaAtual()
let chartDonut   = null
let _container   = null
const expandidos = new Set()

const $ = id => _container.querySelector(`#${id}`)

export async function render(container) {
  _container = container
  container.innerHTML = renderShell()
  bindPeriodo()
  bindCategorias()
  await carregarDados()
}

function renderShell() {
  return `
    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:32px">
        <div style="flex:1">
          <div id="totalValor" style="font-size:36px;font-weight:700;letter-spacing:-1.5px;color:var(--text)">—</div>
          <div id="totalLabel" style="font-size:14px;color:var(--text-muted);margin-top:6px">carregando...</div>
        </div>
        <div style="position:relative;width:160px;height:160px;flex-shrink:0">
          <canvas id="chartDonut"></canvas>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="period-btn" id="btnAnterior">&#8249;</button>
          <span id="periodLabel" style="font-size:13px;font-weight:600;color:var(--text);min-width:160px;text-align:center;white-space:nowrap">${formatCompetencia(competencia)}</span>
          <button class="period-btn" id="btnProximo">&#8250;</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-title" style="margin-bottom:16px">CATEGORIAS</div>
      <div id="listaCategorias">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </div>
    </div>
  `
}

function bindPeriodo() {
  $('btnAnterior').addEventListener('click', async () => {
    competencia = addMeses(competencia, -1)
    $('periodLabel').textContent = formatCompetencia(competencia)
    await carregarDados()
  })
  $('btnProximo').addEventListener('click', async () => {
    competencia = addMeses(competencia, 1)
    $('periodLabel').textContent = formatCompetencia(competencia)
    await carregarDados()
  })
}

function bindCategorias() {
  $('listaCategorias').addEventListener('click', e => {
    const header = e.target.closest('.cat-header')
    if (!header) return
    const catDiv = header.parentElement
    const panel  = catDiv.querySelector('.subcats-panel')
    if (!panel || !panel.innerHTML.trim()) return

    const cat   = catDiv.dataset.cat
    const arrow = header.querySelector('.cat-arrow')

    if (expandidos.has(cat)) {
      expandidos.delete(cat)
      panel.style.display = 'none'
      if (arrow) arrow.textContent = '˅'
    } else {
      expandidos.add(cat)
      panel.style.display = 'block'
      if (arrow) arrow.textContent = '˄'
    }
  })
}

async function carregarDados() {
  try {
    const { data: lancamentos, error } = await supabase
      .from('lancamentos')
      .select('*, metodos(*), categorias(*), subcategorias(*)')
      .eq('competencia', competencia)

    if (error) throw error

    const filtrados = lancamentos.filter(l =>
      l.metodos?.id_tipo === 2 && l.categorias?.id_tipo !== 4
    )

    const catMap = {}
    for (const l of filtrados) {
      const cat = l.categorias?.nome || 'OUTROS'
      if (!catMap[cat]) catMap[cat] = { total: 0, count: 0, subcats: {} }
      catMap[cat].total += Math.abs(l.valor)
      catMap[cat].count++

      const sub = l.subcategorias?.nome
      if (sub) {
        if (!catMap[cat].subcats[sub]) catMap[cat].subcats[sub] = { total: 0, count: 0 }
        catMap[cat].subcats[sub].total += Math.abs(l.valor)
        catMap[cat].subcats[sub].count++
      }
    }

    const cats       = Object.entries(catMap).sort((a, b) => b[1].total - a[1].total)
    const totalGeral = cats.reduce((s, [, v]) => s + v.total, 0)

    renderResumo(totalGeral)
    renderDonut(cats)
    renderCategorias(cats)
  } catch (err) {
    console.error('[categorias] carregarDados erro:', err)
    const el = $('listaCategorias')
    if (el) el.innerHTML = `<p style="color:var(--red);font-size:14px;padding:16px 0">Erro ao carregar dados.</p>`
  }
}

function renderResumo(total) {
  $('totalValor').textContent = formatBRL(total)
  $('totalLabel').textContent = `gasto em ${formatCompetencia(competencia)}`
}

function renderDonut(cats) {
  chartDonut?.destroy()
  chartDonut = null

  if (!cats.length) return

  chartDonut = new Chart($('chartDonut'), {
    type: 'doughnut',
    data: {
      labels: cats.map(([k]) => k),
      datasets: [{
        data:            cats.map(([, v]) => v.total),
        backgroundColor: cats.map(([k]) => corCat(k)),
        borderWidth:  2,
        borderColor:  '#ffffff',
        hoverOffset:  4,
      }]
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${formatBRL(ctx.parsed)}`
          }
        }
      }
    }
  })
}

function renderCategorias(cats) {
  const el = $('listaCategorias')

  if (!cats.length) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">Nenhum dado para este período</p>`
    return
  }

  const maxVal = cats[0][1].total

  el.innerHTML = cats.map(([cat, data], i) => {
    const cor    = corCat(cat)
    const pct    = (data.total / maxVal * 100).toFixed(1)
    const isExp  = expandidos.has(cat)
    const temSub = Object.keys(data.subcats).length > 0
    const border = i < cats.length - 1 || isExp ? 'border-bottom:1px solid var(--border)' : ''

    return `
      <div data-cat="${cat.replace(/"/g, '&quot;')}">
        <div class="cat-header" style="display:grid;grid-template-columns:auto 1fr auto minmax(80px,180px) 20px;align-items:center;gap:12px;padding:12px 0;cursor:${temSub ? 'pointer' : 'default'};${border}">
          <span style="display:inline-flex;align-items:center;justify-content:center;height:20px;padding:0 8px;border-radius:20px;background:${cor};color:#fff;font-size:11px;font-weight:700;white-space:nowrap">
            ${data.count}
          </span>
          <span style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${cat}</span>
          <span style="font-size:13px;font-weight:600;color:var(--text);white-space:nowrap">${formatBRL(data.total)}</span>
          <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${cor};border-radius:3px;transition:width 0.4s ease"></div>
          </div>
          <span class="cat-arrow" style="font-size:12px;color:var(--text-muted);text-align:center;line-height:1;user-select:none">
            ${temSub ? (isExp ? '˄' : '˅') : ''}
          </span>
        </div>
        <div class="subcats-panel" style="display:${isExp ? 'block' : 'none'}">
          ${temSub ? renderSubcats(data.subcats, data.total, cor) : ''}
        </div>
      </div>
    `
  }).join('')
}

function renderSubcats(subcats, catTotal, cor) {
  const entries = Object.entries(subcats).sort((a, b) => b[1].total - a[1].total)

  return entries.map(([sub, data], i) => {
    const pct    = (data.total / catTotal * 100).toFixed(1)
    const isLast = i === entries.length - 1
    return `
      <div style="display:grid;grid-template-columns:3px auto 1fr auto minmax(80px,180px);align-items:center;gap:12px;padding:8px 0 8px 40px;${!isLast ? 'border-bottom:1px solid var(--border)' : ''}">
        <div style="width:3px;height:20px;background:${cor};border-radius:2px;opacity:0.4"></div>
        <span style="font-size:11px;color:var(--text-muted);font-weight:500;white-space:nowrap">${data.count}×</span>
        <span style="font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</span>
        <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap">${formatBRL(data.total)}</span>
        <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px;opacity:0.55;transition:width 0.4s ease"></div>
        </div>
      </div>
    `
  }).join('')
}
