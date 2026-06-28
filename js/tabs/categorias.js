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
  'SALÁRIO':           '#a3e635',
  'EXTRA':             '#2563eb',
  'OUTROS':            '#6b7280',
}

const corCat = nome => COR_CAT[nome?.toUpperCase()] ?? '#6b7280'

let competencia          = competenciaAtual()
let chartDonut           = null
let _container           = null
let tipoAtivo            = 2   // 1 = Entradas, 2 = Saídas
let lancamentosFiltrados = []
const expandidos    = new Set()
const expandidosSub = new Set()

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
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <button class="period-btn" id="btnAnterior">&#8249;</button>
            <span id="periodLabel" style="font-size:13px;font-weight:600;color:var(--text);min-width:160px;text-align:center;white-space:nowrap">${formatCompetencia(competencia)}</span>
            <button class="period-btn" id="btnProximo">&#8250;</button>
          </div>
          <div style="display:flex;gap:4px;background:var(--bg);border-radius:var(--radius-sm);padding:3px">
            <button id="btnTipoSaida"  class="pop-mode-btn active" data-tipo="2">Saídas</button>
            <button id="btnTipoEntrada" class="pop-mode-btn"       data-tipo="1">Entradas</button>
          </div>
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
  $('btnTipoSaida').addEventListener('click', async () => {
    if (tipoAtivo === 2) return
    tipoAtivo = 2
    expandidos.clear()
    $('btnTipoSaida').classList.add('active')
    $('btnTipoEntrada').classList.remove('active')
    await carregarDados()
  })
  $('btnTipoEntrada').addEventListener('click', async () => {
    if (tipoAtivo === 1) return
    tipoAtivo = 1
    expandidos.clear()
    $('btnTipoEntrada').classList.add('active')
    $('btnTipoSaida').classList.remove('active')
    await carregarDados()
  })
}

function bindCategorias() {
  $('listaCategorias').addEventListener('click', e => {
    // Clique em subcategoria → expande lançamentos
    const subcatRow = e.target.closest('.subcat-row')
    if (subcatRow) {
      const wrap  = subcatRow.parentElement
      const cat   = wrap.dataset.cat
      const sub   = wrap.dataset.sub
      const key   = `${cat}||${sub}`
      const panel = wrap.querySelector('.lancs-panel')
      const arrow = subcatRow.querySelector('.subcat-arrow')
      if (!panel) return

      if (expandidosSub.has(key)) {
        expandidosSub.delete(key)
        panel.style.display = 'none'
        if (arrow) arrow.textContent = '˅'
      } else {
        expandidosSub.add(key)
        panel.innerHTML = renderLancamentosSubcat(cat, sub)
        panel.style.display = 'block'
        if (arrow) arrow.textContent = '˄'
      }
      return
    }

    // Clique em categoria → expande subcategorias
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
      .select('*, metodos(*), categorias(*), subcategorias!lancamentos_id_subcategoria_fkey(*)')
      .eq('competencia', competencia)

    if (error) throw error

    lancamentosFiltrados = lancamentos.filter(l =>
      l.metodos?.id_tipo === tipoAtivo && l.categorias?.id_tipo !== 4
    )
    expandidosSub.clear()

    const catMap = {}
    for (const l of lancamentosFiltrados) {
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
  $('totalLabel').textContent = `${tipoAtivo === 2 ? 'gasto' : 'recebido'} em ${formatCompetencia(competencia)}`
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
          ${temSub ? renderSubcats(data.subcats, data.total, cor, cat) : ''}
        </div>
      </div>
    `
  }).join('')
}

function renderSubcats(subcats, catTotal, cor, catNome) {
  const entries = Object.entries(subcats).sort((a, b) => b[1].total - a[1].total)

  return entries.map(([sub, data], i) => {
    const pct    = (data.total / catTotal * 100).toFixed(1)
    const isLast = i === entries.length - 1
    const key    = `${catNome}||${sub}`
    const isExp  = expandidosSub.has(key)

    return `
      <div data-cat="${catNome.replace(/"/g,'&quot;')}" data-sub="${sub.replace(/"/g,'&quot;')}">
        <div class="subcat-row" style="display:grid;grid-template-columns:3px auto 1fr auto minmax(80px,180px) 20px;align-items:center;gap:12px;padding:8px 0 8px 40px;cursor:pointer;${!isLast || isExp ? 'border-bottom:1px solid var(--border)' : ''}">
          <div style="width:3px;height:20px;background:${cor};border-radius:2px;opacity:0.4"></div>
          <span style="font-size:11px;color:var(--text-muted);font-weight:500;white-space:nowrap">${data.count}×</span>
          <span style="font-size:13px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</span>
          <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap">${formatBRL(data.total)}</span>
          <div style="height:4px;background:var(--border);border-radius:2px;overflow:hidden">
            <div style="height:100%;width:${pct}%;background:${cor};border-radius:2px;opacity:0.55;transition:width 0.4s ease"></div>
          </div>
          <span class="subcat-arrow" style="font-size:12px;color:var(--text-muted);text-align:center;line-height:1;user-select:none">˅</span>
        </div>
        <div class="lancs-panel" style="display:none"></div>
      </div>
    `
  }).join('')
}

function renderLancamentosSubcat(catNome, subNome) {
  const lancs = lancamentosFiltrados
    .filter(l => (l.categorias?.nome || 'OUTROS') === catNome && l.subcategorias?.nome === subNome)
    .sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''))

  if (!lancs.length) return `<p style="color:var(--text-muted);font-size:12px;padding:8px 0 8px 56px">Nenhum lançamento.</p>`

  return lancs.map((l, i) => {
    const dataStr = l.data
      ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      : '—'
    return `
      <div style="display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:center;padding:7px 0 7px 56px;${i < lancs.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        <span style="font-size:11px;color:var(--text-muted);white-space:nowrap">${dataStr}</span>
        <span style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.descricao || '—'}</span>
        <span style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap">${formatBRL(Math.abs(l.valor))}</span>
      </div>
    `
  }).join('')
}
