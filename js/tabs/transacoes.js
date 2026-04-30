// ============================================================
// SFP — Aba: Lançamentos
// ============================================================
import { getLancamentos, getContas, getCategorias, deletarLancamento, deletarTransferencia } from '../services/supabase.js'
import { formatBRL, badgeBanco } from '../services/formatters.js'
import { abrirNovoLancamento, abrirEditarLancamento } from '../forms/lancamento.js'

// ── Helpers de data ────────────────────────────────────────────
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function today()           { return toISO(new Date()) }
function offsetDays(n)     { const d=new Date(); d.setDate(d.getDate()+n); return toISO(d) }
function firstOfMonth(off) { const d=new Date(); d.setMonth(d.getMonth()+off); d.setDate(1); return toISO(d) }
function lastOfMonth(off)  { const d=new Date(); d.setMonth(d.getMonth()+off+1); d.setDate(0); return toISO(d) }
function firstOfYear(off)  { return `${new Date().getFullYear()+off}-01-01` }
function lastOfYear(off)   { return `${new Date().getFullYear()+off}-12-31` }

function fmtRange(s, e) {
  if (!s) return 'Todo período'
  const fmt = iso => new Date(iso+'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'short' })
  return (e && e !== s) ? `${fmt(s)} – ${fmt(e)}` : fmt(s)
}

const QUICK = [
  { id:'tudo',     label:'Todo período',    start:()=>null,             end:()=>null            },
  { id:'30d',      label:'Últimos 30 dias', start:()=>offsetDays(-30),  end:today               },
  { id:'90d',      label:'Últimos 90 dias', start:()=>offsetDays(-90),  end:today               },
  { id:'este-mes', label:'Este mês',        start:()=>firstOfMonth(0),  end:()=>lastOfMonth(0)  },
  { id:'mes-pass', label:'Mês passado',     start:()=>firstOfMonth(-1), end:()=>lastOfMonth(-1) },
  { id:'6m',       label:'Últimos 6 meses', start:()=>firstOfMonth(-6), end:today               },
  { id:'este-ano', label:'Este ano',        start:()=>firstOfYear(0),   end:()=>lastOfYear(0)   },
  { id:'ano-pass', label:'Ano passado',     start:()=>firstOfYear(-1),  end:()=>lastOfYear(-1)  },
]

// ── State ──────────────────────────────────────────────────────
let dataInicio     = firstOfMonth(0)
let dataFim        = lastOfMonth(0)
let periodoLabel   = 'Este mês'
let filtroBanco    = ''
let filtroTipo     = ''
let filtroCateg          = ''
let filtroSubcat         = ''
let sortCol              = 'data'
let sortDir              = 'desc'
let lancamentosFiltrados = []
let contasList     = []
let categoriasList = []
let tabContainer   = null

// Modo de filtro de data
let filterMode        = 'data'        // 'data' | 'competencia'
let competenciaFiltro = ''            // aplicado quando filterMode='competencia'

// Popover state
let popEl          = null
let popMode        = 'data'           // modo temporário dentro do popover
let popTempStart   = firstOfMonth(0)
let popTempEnd     = lastOfMonth(0)
let popActiveQ     = 'este-mes'
let popCal1Y       = 0
let popCal1M       = 0
let popCal2Y       = 0
let popCal2M       = 0
let popCalYear     = new Date().getFullYear()
let popTempCompet  = firstOfMonth(0)  // competência selecionada no picker
let outsideHandler = null

// ── Render principal ───────────────────────────────────────────
export async function render(container) {
  tabContainer = container
  dataInicio   = firstOfMonth(0)
  dataFim      = lastOfMonth(0)
  periodoLabel = 'Este mês'
  filtroBanco  = ''
  filtroTipo   = ''
  filtroCateg  = ''
  filtroSubcat = ''
  sortCol           = 'data'
  sortDir           = 'desc'
  filterMode        = 'data'
  competenciaFiltro = ''
  popMode           = 'data'
  popTempStart      = dataInicio
  popTempCompet     = firstOfMonth(0)
  popCalYear        = new Date().getFullYear()
  popTempEnd   = dataFim
  popActiveQ   = 'este-mes'
  initCalMonths()

  ;[contasList, categoriasList] = await Promise.all([getContas(), getCategorias()])

  container.innerHTML = buildShell()
  initPopover()
  bindEvents(container)
  await carregarTabela(container)

  window.addEventListener('sfp:lancamento-salvo', () => carregarTabela(container))
}

// ── Shell ──────────────────────────────────────────────────────
function buildShell() {
  const contaOpts = [
    '<option value="">Todas Contas</option>',
    ...contasList.map(c => `<option value="${c.id}">${c.nome}</option>`)
  ].join('')

  const categOpts = [
    '<option value="">Categorias</option>',
    ...categoriasList.map(c => `<option value="${c.id}">${c.nome}</option>`)
  ].join('')

  const subcatOpts = buildSubcatOptions()

  return `
    <div class="kpi-grid" id="resumoCards" style="margin-bottom:20px">
      <div class="card"><div class="card-title">Total</div><div class="card-value">—</div></div>
      <div class="card"><div class="card-title">Despesas</div><div class="card-value">—</div></div>
      <div class="card"><div class="card-title">Receitas</div><div class="card-value">—</div></div>
      <div class="card"><div class="card-title">Saldo</div><div class="card-value">—</div></div>
    </div>

    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:2px">Lançamentos</div>
          <span class="text-sm text-muted" id="contadorLabel"></span>
        </div>
        <button class="btn btn-primary" id="btnNovo">+ Novo Lançamento</button>
      </div>

      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:20px">
        <button class="filter-pill" id="btnPeriodo" style="border-radius:var(--radius-sm);color:var(--text);font-weight:500;cursor:pointer">
          ${periodoLabel} ▾
        </button>
        <div class="filter-pill" style="border-radius:var(--radius-sm)">
          <select id="selConta">${contaOpts}</select>
        </div>
        <div class="filter-pill" style="border-radius:var(--radius-sm)">
          <select id="selTipo">
            <option value="">Todas Transações</option>
            <option value="1">Entradas</option>
            <option value="2">Saídas</option>
            <option value="3">Transferências</option>
            <option value="4">Controle</option>
          </select>
        </div>
        <div class="filter-pill" style="border-radius:var(--radius-sm)">
          <select id="selCategoria">${categOpts}</select>
        </div>
        <div class="filter-pill" style="border-radius:var(--radius-sm)">
          <select id="selSubcat">${subcatOpts}</select>
        </div>
      </div>

      <div class="table-wrapper" id="tableWrapper">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `
}

// ── Events ─────────────────────────────────────────────────────
function bindEvents(container) {
  container.querySelector('#btnNovo').addEventListener('click', abrirNovoLancamento)
  container.querySelector('#btnPeriodo').addEventListener('click', e => {
    e.stopPropagation()
    popEl.style.display === 'none' ? showPopover() : hidePopover()
  })
  container.querySelector('#selConta').addEventListener('change', e => {
    filtroBanco = e.target.value; carregarTabela(container)
  })
  container.querySelector('#selTipo').addEventListener('change', e => {
    filtroTipo = e.target.value; carregarTabela(container)
  })
  container.querySelector('#selCategoria').addEventListener('change', e => {
    filtroCateg  = e.target.value
    filtroSubcat = ''
    container.querySelector('#selSubcat').innerHTML = buildSubcatOptions()
    carregarTabela(container)
  })
  container.querySelector('#selSubcat').addEventListener('change', e => {
    filtroSubcat = e.target.value; carregarTabela(container)
  })
}

// ── Popover ────────────────────────────────────────────────────
function initCalMonths() {
  const now  = new Date()
  popCal2Y   = now.getFullYear()
  popCal2M   = now.getMonth() + 1
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  popCal1Y   = prev.getFullYear()
  popCal1M   = prev.getMonth() + 1
}

function navigateCalToRange(start, end) {
  const ref = end || start
  if (!ref) { initCalMonths(); return }
  const ed   = new Date(ref + 'T00:00:00')
  popCal2Y   = ed.getFullYear()
  popCal2M   = ed.getMonth() + 1
  const prev = new Date(ed.getFullYear(), ed.getMonth() - 1, 1)
  popCal1Y   = prev.getFullYear()
  popCal1M   = prev.getMonth() + 1
}

function applyQuick(id) {
  const q = QUICK.find(x => x.id === id)
  if (!q) return
  popActiveQ   = id
  popTempStart = q.start ? q.start() : null
  popTempEnd   = q.end   ? q.end()   : null
  navigateCalToRange(popTempStart, popTempEnd)
}

function advanceCals(dir) {
  const step = (y, m, n) => {
    let nm = m + n, ny = y
    if (nm > 12) { nm -= 12; ny++ }
    if (nm < 1)  { nm += 12; ny-- }
    return [ny, nm]
  }
  ;[popCal1Y, popCal1M] = step(popCal1Y, popCal1M, dir)
  ;[popCal2Y, popCal2M] = step(popCal2Y, popCal2M, dir)
}

function initPopover() {
  const existing = document.getElementById('sfpPeriodPop')
  if (existing) { popEl = existing; return }

  popEl = document.createElement('div')
  popEl.id        = 'sfpPeriodPop'
  popEl.className = 'period-popover'
  popEl.style.display = 'none'
  document.body.appendChild(popEl)

  outsideHandler = e => {
    if (popEl.style.display === 'none') return
    if (popEl.contains(e.target)) return
    const btn = document.getElementById('btnPeriodo')
    if (btn && btn.contains(e.target)) return
    hidePopover()
  }
  document.addEventListener('mousedown', outsideHandler)
}

function showPopover() {
  renderPopover()
  popEl.style.display = 'block'

  const btn  = document.getElementById('btnPeriodo')
  const rect = btn.getBoundingClientRect()
  const pw   = 740
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - pw - 8))
  popEl.style.top  = `${rect.bottom + window.scrollY + 6}px`
  popEl.style.left = `${left}px`
}

function hidePopover() {
  if (popEl) popEl.style.display = 'none'
}

function renderPopover() {
  const modeToggle = `
    <div style="display:flex;gap:4px;margin-bottom:14px;background:var(--bg);border-radius:var(--radius-sm);padding:3px;width:fit-content">
      <button class="pop-mode-btn${popMode === 'data' ? ' active' : ''}" data-mode="data">Por data</button>
      <button class="pop-mode-btn${popMode === 'competencia' ? ' active' : ''}" data-mode="competencia">Por competência</button>
    </div>
  `

  const rightPanel = popMode === 'competencia'
    ? buildCompetenciaPicker()
    : buildDataRangePanel()

  const quickHTML = popMode === 'competencia'
    ? buildQuickCompetencia()
    : QUICK.map(q => `
        <div class="pop-quick-item${q.id === popActiveQ ? ' active' : ''}" data-quick="${q.id}">${q.label}</div>
      `).join('')

  const footerLabel = popMode === 'competencia'
    ? fmtCompetencia(popTempCompet)
    : (() => { const q = QUICK.find(x => x.id === popActiveQ); return (q && popActiveQ !== 'custom') ? q.label : fmtRange(popTempStart, popTempEnd) })()

  popEl.innerHTML = `
    <div class="pop-inner">
      <div class="pop-quick">${quickHTML}</div>
      <div class="pop-cals">
        ${modeToggle}
        ${rightPanel}
      </div>
    </div>
    <div class="pop-footer">
      <span class="pop-footer-label"><strong>${footerLabel}</strong></span>
      <div style="display:flex;gap:8px">
        <button class="btn btn-outline" id="popCancelar">Cancelar</button>
        <button class="btn btn-primary" id="popAplicar">Aplicar</button>
      </div>
    </div>
  `

  // Mode toggle
  popEl.querySelectorAll('.pop-mode-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation()
      popMode = btn.dataset.mode
      renderPopover()
    })
  })

  // Quick options
  popEl.querySelectorAll('.pop-quick-item').forEach(el => {
    el.addEventListener('click', () => {
      if (popMode === 'competencia') {
        popTempCompet = el.dataset.compet
        renderPopover()
      } else {
        applyQuick(el.dataset.quick)
        renderPopover()
      }
    })
  })

  if (popMode === 'data') {
    // Calendar day clicks
    popEl.querySelectorAll('.cal-day:not(.cal-day--out)').forEach(el => {
      el.addEventListener('click', () => {
        const iso = el.dataset.iso
        if (!popTempStart || (popTempStart && popTempEnd)) {
          popTempStart = iso; popTempEnd = null
        } else {
          if (iso >= popTempStart) { popTempEnd = iso }
          else { popTempEnd = popTempStart; popTempStart = iso }
        }
        popActiveQ = 'custom'
        renderPopover()
      })
    })
    popEl.querySelector('#popNavL').addEventListener('click', e => {
      e.stopPropagation(); advanceCals(-1); renderPopover()
    })
    popEl.querySelector('#popNavR').addEventListener('click', e => {
      e.stopPropagation(); advanceCals(1); renderPopover()
    })
  } else {
    // Competência year nav
    popEl.querySelector('#compNavL').addEventListener('click', e => {
      e.stopPropagation(); popCalYear--; renderPopover()
    })
    popEl.querySelector('#compNavR').addEventListener('click', e => {
      e.stopPropagation(); popCalYear++; renderPopover()
    })
    // Month buttons
    popEl.querySelectorAll('.month-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        popTempCompet = btn.dataset.compet
        renderPopover()
      })
    })
  }

  // Footer
  popEl.querySelector('#popCancelar').addEventListener('click', hidePopover)
  popEl.querySelector('#popAplicar').addEventListener('click', () => {
    filterMode = popMode
    if (popMode === 'competencia') {
      competenciaFiltro = popTempCompet
      periodoLabel      = fmtCompetencia(competenciaFiltro)
    } else {
      dataInicio   = popTempStart
      dataFim      = popTempEnd
      const qApply = QUICK.find(x => x.id === popActiveQ)
      periodoLabel = (qApply && popActiveQ !== 'custom') ? qApply.label : fmtRange(dataInicio, dataFim)
    }
    const btn = document.getElementById('btnPeriodo')
    if (btn) btn.textContent = `${periodoLabel} ▾`
    hidePopover()
    carregarTabela(tabContainer)
  })
}

function buildDataRangePanel() {
  const s = popTempStart, e = popTempEnd
  return `
    <div class="pop-cals-label">Ou selecione um período personalizado</div>
    <div style="display:flex;align-items:center;gap:8px">
      <button class="period-btn" id="popNavL">&#8249;</button>
      <div style="display:flex;gap:0;flex:1">
        <div style="flex:1">${buildCalGrid(popCal1Y, popCal1M, s, e)}</div>
        <div style="width:1px;background:var(--border);margin:0 16px;flex-shrink:0"></div>
        <div style="flex:1">${buildCalGrid(popCal2Y, popCal2M, s, e)}</div>
      </div>
      <button class="period-btn" id="popNavR">&#8250;</button>
    </div>
  `
}

function buildCompetenciaPicker() {
  const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const grid = MONTHS.map((m, i) => {
    const compet = `${popCalYear}-${String(i + 1).padStart(2, '0')}-01`
    const active = compet === popTempCompet
    return `<button class="month-btn${active ? ' active' : ''}" data-compet="${compet}">${m}</button>`
  }).join('')

  return `
    <div class="pop-cals-label">Selecione o mês de competência</div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <button class="period-btn" id="compNavL">&#8249;</button>
      <span style="font-size:14px;font-weight:600;color:var(--text)">${popCalYear}</span>
      <button class="period-btn" id="compNavR">&#8250;</button>
    </div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${grid}</div>
  `
}

function buildQuickCompetencia() {
  const opts = [
    { label: 'Este mês',    compet: firstOfMonth(0)  },
    { label: 'Mês passado', compet: firstOfMonth(-1) },
  ]
  return opts.map(o => `
    <div class="pop-quick-item${o.compet === popTempCompet ? ' active' : ''}" data-compet="${o.compet}">
      ${o.label}
    </div>
  `).join('')
}

function fmtCompetencia(iso) {
  if (!iso) return 'Competência'
  return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

function buildCalGrid(year, month, selStart, selEnd) {
  const firstDay = new Date(year, month - 1, 1)
  const lastDay  = new Date(year, month, 0)
  const startDow = firstDay.getDay()

  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
  const monthTitle = firstDay.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())

  const cells = []

  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month - 1, i - startDow + 1)
    cells.push({ iso: toISO(d), day: d.getDate(), outside: true })
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push({ iso: toISO(new Date(year, month - 1, d)), day: d, outside: false })
  }
  const rem = cells.length % 7
  if (rem > 0) {
    for (let d = 1; d <= 7 - rem; d++) {
      cells.push({ iso: toISO(new Date(year, month, d)), day: d, outside: true })
    }
  }

  const thRow = DAY_NAMES.map(d => `<th class="cal-th">${d}</th>`).join('')
  const rows  = []

  for (let r = 0; r < cells.length / 7; r++) {
    const tds = cells.slice(r * 7, r * 7 + 7).map(cell => {
      if (cell.outside) return `<td class="cal-day cal-day--out">${cell.day}</td>`

      let cls = 'cal-day'
      if (selStart || selEnd) {
        const lo = (selStart && selEnd && selStart <= selEnd) ? selStart : (selEnd || selStart)
        const hi = (selStart && selEnd && selStart <= selEnd) ? selEnd   : (selStart || selEnd)
        if (cell.iso === selStart || cell.iso === selEnd) cls += ' cal-day--sel'
        else if (lo && hi && cell.iso > lo && cell.iso < hi) cls += ' cal-day--range'
      }

      return `<td class="${cls}" data-iso="${cell.iso}">${cell.day}</td>`
    }).join('')
    rows.push(`<tr>${tds}</tr>`)
  }

  return `
    <div style="text-align:center;font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">
      ${monthTitle}
    </div>
    <table class="cal-table">
      <thead><tr>${thRow}</tr></thead>
      <tbody>${rows.join('')}</tbody>
    </table>
  `
}

// ── Subcategorias ──────────────────────────────────────────────
function buildSubcatOptions() {
  const lista = filtroCateg
    ? (categoriasList.find(c => String(c.id) === filtroCateg)?.subcategorias ?? [])
    : categoriasList.flatMap(c => c.subcategorias ?? [])

  return [
    '<option value="">Subcategorias</option>',
    ...lista.map(s => `<option value="${s.id}"${String(s.id) === filtroSubcat ? ' selected' : ''}>${s.nome}</option>`)
  ].join('')
}

// ── Cards de resumo ────────────────────────────────────────────
function renderCards(container, lancamentos) {
  const grid = container.querySelector('#resumoCards')
  if (!grid) return

  const despesas = lancamentos
    .filter(l => l.metodos?.id_tipo === 2)
    .reduce((s, l) => s + Math.abs(l.valor), 0)
  const receitas = lancamentos
    .filter(l => l.metodos?.id_tipo === 1)
    .reduce((s, l) => s + Math.abs(l.valor), 0)
  const saldo    = receitas - despesas
  const total    = lancamentos.length

  grid.innerHTML = `
    <div class="card">
      <div class="card-title">Total</div>
      <div class="card-value">${total}</div>
      <div class="card-delta" style="color:var(--text-muted)">lançamento${total !== 1 ? 's' : ''}</div>
    </div>
    <div class="card">
      <div class="card-title">Despesas</div>
      <div class="card-value" style="color:var(--red)">${formatBRL(despesas)}</div>
    </div>
    <div class="card">
      <div class="card-title">Receitas</div>
      <div class="card-value" style="color:var(--green)">${formatBRL(receitas)}</div>
    </div>
    <div class="card">
      <div class="card-title">Saldo</div>
      <div class="card-value" style="color:${saldo >= 0 ? 'var(--green)' : 'var(--red)'}">${formatBRL(saldo)}</div>
      <div class="card-delta ${saldo >= 0 ? 'positive' : 'negative'}">${saldo >= 0 ? '▲' : '▼'} ${saldo >= 0 ? 'positivo' : 'negativo'}</div>
    </div>
  `
}

// ── Tabela ─────────────────────────────────────────────────────
async function carregarTabela(container) {
  const wrapper = container.querySelector('#tableWrapper')
  wrapper.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  try {
    let lancamentos = await getLancamentos({
      competencia:  filterMode === 'competencia' ? (competenciaFiltro || undefined) : undefined,
      dataInicio:   filterMode === 'data'        ? (dataInicio || undefined)        : undefined,
      dataFim:      filterMode === 'data'        ? (dataFim    || undefined)        : undefined,
      banco:        filtroBanco || undefined,
      tipo:         filtroTipo  || undefined,
      categoria:    filtroCateg || undefined,
      subcategoria: filtroSubcat || undefined,
    })

    lancamentosFiltrados = lancamentos
    renderTabela(container)
  } catch (err) {
    console.error(err)
    wrapper.innerHTML = `<p style="padding:32px;color:var(--red);font-size:14px">Erro ao carregar lançamentos.</p>`
  }
}

function sortedLancamentos() {
  return [...lancamentosFiltrados].sort((a, b) => {
    let va, vb
    switch (sortCol) {
      case 'data':     va = a.data ?? '';            vb = b.data ?? '';            break
      case 'banco':    va = a.contas?.nome ?? '';    vb = b.contas?.nome ?? '';    break
      case 'descricao':va = a.descricao ?? '';       vb = b.descricao ?? '';       break
      case 'valor':    va = Math.abs(a.valor ?? 0);  vb = Math.abs(b.valor ?? 0);  break
      default:         va = ''; vb = ''
    }
    const cmp = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb
    return sortDir === 'asc' ? cmp : -cmp
  })
}

function thSortable(col, label, align = '') {
  const active = sortCol === col
  const icon   = active ? (sortDir === 'asc' ? '↑' : '↓') : '↕'
  return `<th class="th-sort${active ? ' th-sort--active' : ''}${align ? ' ' + align : ''}" data-sort="${col}">
    ${label} <span class="sort-icon">${icon}</span>
  </th>`
}

function renderTabela(container) {
  const lancamentos = sortedLancamentos()

  renderCards(container, lancamentos)

  const wrapper  = container.querySelector('#tableWrapper')
  const contador = container.querySelector('#contadorLabel')
  const n = lancamentosFiltrados.length
  contador.textContent = `${n} lançamento${n !== 1 ? 's' : ''}`

  if (!n) {
    wrapper.innerHTML = `
      <p style="text-align:center;padding:56px 0;color:var(--text-muted);font-size:14px">
        Nenhum lançamento encontrado.
      </p>`
    return
  }

  wrapper.innerHTML = `
    <table>
      <thead>
        <tr>
          ${thSortable('data',     'Data')}
          <th>Método</th>
          ${thSortable('banco',    'Banco')}
          ${thSortable('descricao','Descrição')}
          ${thSortable('valor',    'Valor', 'text-right')}
          <th style="width:68px"></th>
        </tr>
      </thead>
      <tbody>${lancamentos.map(buildRow).join('')}</tbody>
    </table>
  `

  wrapper.querySelectorAll('.th-sort').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        sortCol = col
        sortDir = col === 'data' ? 'desc' : 'asc'
      }
      renderTabela(container)
    })
  })

  wrapper.querySelector('tbody').addEventListener('click', e => {
    const btn  = e.target.closest('[data-action]')
    if (!btn) return
    const id   = btn.closest('tr').dataset.id
    const lanc = lancamentosFiltrados.find(l => l.id_lancamento === id)
    if (!lanc) return
    if (btn.dataset.action === 'edit')   abrirEditarLancamento(lanc)
    if (btn.dataset.action === 'delete') mostrarConfirmDelete(lanc)
  })
}

function buildRow(l) {
  const idTipo  = l.metodos?.id_tipo
  const metodo  = (idTipo === 1 || idTipo === 3) ? '' : (l.metodos?.nome ?? '')
  const dataStr = l.data
    ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' })
    : '—'
  const sub = buildSub(l)

  return `
    <tr data-id="${l.id_lancamento}">
      <td style="color:var(--text-muted);font-size:13px;white-space:nowrap">${dataStr}</td>
      <td style="font-size:12px;color:var(--text-light);white-space:nowrap;font-weight:500">${metodo}</td>
      <td style="white-space:nowrap">${badgeBanco(l.contas?.nome)}</td>
      <td>
        <div class="desc-info">
          <span class="desc-name">${l.descricao || '—'}</span>
          ${sub ? `<span class="desc-sub">${sub}</span>` : ''}
        </div>
      </td>
      <td class="text-right" style="white-space:nowrap">
        <span class="${classeValor(idTipo)}">${formatValor(idTipo, l.valor)}</span>
      </td>
      <td class="row-actions-cell">
        <div class="row-actions">
          <button class="btn-row-action" data-action="edit" title="Editar">✎</button>
          <button class="btn-row-action btn-row-delete" data-action="delete" title="Excluir">✕</button>
        </div>
      </td>
    </tr>
  `
}

function mostrarConfirmDelete(lanc) {
  const isTransf = !!lanc.id_transf
  const nome     = lanc.descricao || 'este lançamento'
  const msg      = isTransf
    ? `Esta é uma transferência. <strong>Ambos os registros</strong> serão excluídos permanentemente.`
    : `Tem certeza que deseja excluir <strong>"${nome}"</strong>? Esta ação não pode ser desfeita.`

  const el = document.createElement('div')
  el.className = 'confirm-overlay'
  el.innerHTML = `
    <div class="confirm-modal">
      <div class="confirm-modal-title">Excluir lançamento</div>
      <div class="confirm-modal-body">${msg}</div>
      <div class="confirm-modal-actions">
        <button class="btn btn-outline" id="confCancelar">Cancelar</button>
        <button class="btn-danger" id="confOk">Excluir</button>
      </div>
    </div>
  `
  document.body.appendChild(el)

  el.querySelector('#confCancelar').addEventListener('click', () => el.remove())
  el.querySelector('#confOk').addEventListener('click', async () => {
    const btn = el.querySelector('#confOk')
    btn.disabled    = true
    btn.textContent = 'Excluindo...'
    try {
      if (isTransf) await deletarTransferencia(lanc.id_transf)
      else          await deletarLancamento(lanc.id_lancamento)
      el.remove()
      carregarTabela(tabContainer)
    } catch (err) {
      console.error(err)
      const bodyEl = el.querySelector('.confirm-modal-body')
      bodyEl.innerHTML += `<br><span style="color:var(--red);font-size:12px">Erro: ${err.message}</span>`
      btn.disabled    = false
      btn.textContent = 'Excluir'
    }
  })
}

function buildSub(l) {
  const p = []
  if (l.categorias?.nome)    p.push(l.categorias.nome)
  if (l.subcategorias?.nome) p.push(l.subcategorias.nome)
  if (l.qtd_parcelas && l.parcela_atual) p.push(`${l.parcela_atual}/${l.qtd_parcelas}`)
  return p.join(' · ')
}

function classeValor(idTipo) {
  if (idTipo === 1) return 'valor-entrada'
  if (idTipo === 2) return 'valor-saida'
  if (idTipo === 4) return 'valor-fatura'
  return 'valor-neutro'
}

function formatValor(idTipo, valor) {
  const v = formatBRL(Math.abs(valor))
  if (idTipo === 1) return `+${v}`
  if (idTipo === 2) return `-${v}`
  if (idTipo === 4) return `-${v}`
  return v
}
