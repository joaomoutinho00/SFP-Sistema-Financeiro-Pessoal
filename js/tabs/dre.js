// ============================================================
// SFP — Aba: DRE (Demonstração de Resultado)
// ============================================================

import { getDRE } from '../services/supabase.js'
import { formatBRL } from '../services/formatters.js'

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

let ano        = new Date().getFullYear()
let expandidos = new Set()
let _container = null
let _dados     = null

const $ = id => _container.querySelector(`#${id}`)

export async function render(container) {
  _container = container
  container.innerHTML = renderShell()
  bindControles()
  await carregarDados()
}

function renderShell() {
  return `
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px">
        <div class="card-title" style="margin:0">DRE — DEMONSTRAÇÃO DE RESULTADO</div>
        <div style="display:flex;align-items:center;gap:16px">
          <button id="btnToggle" class="pop-mode-btn">Expandir todas</button>
          <div style="display:flex;align-items:center;gap:8px">
            <button class="period-btn" id="btnAnterior">&#8249;</button>
            <span id="anoLabel" style="font-size:14px;font-weight:700;color:var(--text);min-width:60px;text-align:center">${ano}</span>
            <button class="period-btn" id="btnProximo">&#8250;</button>
          </div>
        </div>
      </div>
      <div id="dreConteudo">
        <div class="loading"><div class="spinner"></div> Carregando...</div>
      </div>
    </div>
  `
}

function bindControles() {
  $('btnAnterior').addEventListener('click', async () => {
    ano--
    $('anoLabel').textContent = ano
    expandidos.clear()
    await carregarDados()
  })

  $('btnProximo').addEventListener('click', async () => {
    ano++
    $('anoLabel').textContent = ano
    expandidos.clear()
    await carregarDados()
  })

  $('btnToggle').addEventListener('click', () => {
    const total = contarCategorias()
    if (expandidos.size < total) {
      expandirTodas()
    } else {
      expandidos.clear()
    }
    renderConteudo()
    atualizarBtnToggle()
  })

  $('dreConteudo').addEventListener('click', e => {
    const row = e.target.closest('.dre-cat-row')
    if (!row || row.dataset.hasSub !== 'true') return
    const key = row.dataset.key
    if (expandidos.has(key)) {
      expandidos.delete(key)
    } else {
      expandidos.add(key)
    }
    renderConteudo()
    atualizarBtnToggle()
  })
}

async function carregarDados() {
  const el = $('dreConteudo')
  el.innerHTML = `<div class="loading"><div class="spinner"></div> Carregando...</div>`
  try {
    _dados = await getDRE(ano)
    renderConteudo()
    atualizarBtnToggle()
  } catch (err) {
    console.error('[dre] carregarDados erro:', err)
    el.innerHTML = `<p style="color:var(--red);font-size:14px;padding:16px 0">Erro ao carregar dados do DRE.</p>`
  }
}

function renderConteudo() {
  if (!_dados) return
  const el = $('dreConteudo')
  const { receitas, despesas, investimentos, totaisMes } = _dados

  if (!receitas.length && !despesas.length && !investimentos.length) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:24px 0">Nenhum dado para ${ano}</p>`
    return
  }

  const totalR   = soma(totaisMes.receitas)
  const totalD   = soma(totaisMes.despesas)
  const totalI   = soma(totaisMes.investimentos)
  const totalRes = soma(totaisMes.resultado)

  el.innerHTML = `
    <div style="overflow-x:auto">
      <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:960px">
        ${renderCabecalho()}
        <tbody>
          ${renderSecao('RECEITAS',      receitas,      totaisMes.receitas,      totalR, 'r', '#22c55e')}
          ${renderSecao('DESPESAS',      despesas,      totaisMes.despesas,      totalD, 'd', '#ef4444')}
          ${renderSecao('INVESTIMENTOS', investimentos, totaisMes.investimentos, totalI, 'i', '#3b82f6')}
          ${renderLinhaResultado(totaisMes.resultado, totalRes)}
        </tbody>
      </table>
    </div>
  `
}

function renderCabecalho() {
  const ths = MESES.map(m => `<th style="${thS('right')}">${m}</th>`).join('')
  return `
    <thead>
      <tr style="border-bottom:2px solid var(--border)">
        <th style="${thS('left')};min-width:180px;width:200px">Categoria</th>
        ${ths}
        <th style="${thS('right')};font-weight:700">Total</th>
      </tr>
    </thead>
  `
}

function renderSecao(titulo, linhas, mesesTotal, total, prefixo, cor) {
  if (!linhas.length) return ''

  const catRows   = linhas.map(cat => renderLinhaCategoria(cat, prefixo, cor)).join('')
  const totalCols = mesesTotal.map(v =>
    `<td style="${tdS('right')};font-weight:600;color:${cor}">${fmtV(v)}</td>`
  ).join('')
  const tituloMin = titulo.charAt(0) + titulo.slice(1).toLowerCase()

  return `
    <tr style="border-top:1px solid var(--border)">
      <td colspan="14" style="padding:10px 8px 4px;font-size:11px;font-weight:700;letter-spacing:.6px;color:${cor}">${titulo}</td>
    </tr>
    ${catRows}
    <tr style="border-top:1px solid var(--border);border-bottom:2px solid var(--border)">
      <td style="${tdS('left')};font-weight:700;color:${cor}">Total ${tituloMin}</td>
      ${totalCols}
      <td style="${tdS('right')};font-weight:700;color:${cor}">${fmtV(total)}</td>
    </tr>
  `
}

function renderLinhaCategoria(cat, prefixo, cor) {
  const key    = `${prefixo}:${cat.nome}`
  const isExp  = expandidos.has(key)
  const hasSub = cat.subcats.length > 0
  const arrow  = hasSub ? (isExp ? '▾' : '▸') : ''

  const mCols = cat.meses.map(v => `<td style="${tdS('right')}">${fmtV(v)}</td>`).join('')

  const catRow = `<tr class="dre-cat-row"
      data-key="${escA(key)}"
      data-has-sub="${hasSub}"
      style="border-bottom:1px solid var(--border);cursor:${hasSub ? 'pointer' : 'default'}">
    <td style="${tdS('left')};font-weight:500">
      <span style="display:inline-block;width:14px;color:${cor};font-size:10px">${arrow}</span>
      ${cat.nome}
    </td>
    ${mCols}
    <td style="${tdS('right')};font-weight:600">${fmtV(cat.total)}</td>
  </tr>`

  if (!hasSub || !isExp) return catRow

  const subRows = cat.subcats.map((sub, i) => {
    const isLast = i === cat.subcats.length - 1
    const sCols  = sub.meses.map(v =>
      `<td style="${tdS('right')};color:var(--text-muted);font-size:11px">${fmtV(v)}</td>`
    ).join('')
    return `<tr style="background:var(--bg);${!isLast ? 'border-bottom:1px solid var(--border)' : ''}">
      <td style="${tdS('left')};padding-left:28px;color:var(--text-muted);font-size:11px">
        <span style="opacity:.35;margin-right:4px">└</span>${sub.nome}
      </td>
      ${sCols}
      <td style="${tdS('right')};font-weight:600;color:var(--text-muted);font-size:11px">${fmtV(sub.total)}</td>
    </tr>`
  }).join('')

  return catRow + subRows
}

function renderLinhaResultado(meses, total) {
  const corTotal = total > 0 ? '#22c55e' : total < 0 ? '#ef4444' : 'var(--text-muted)'
  const cols = meses.map(v => {
    const c = v > 0 ? '#22c55e' : v < 0 ? '#ef4444' : 'var(--text-muted)'
    return `<td style="${tdS('right')};font-weight:700;color:${c}">${fmtVSinal(v)}</td>`
  }).join('')
  return `
    <tr style="border-top:2px solid var(--border)">
      <td style="${tdS('left')};font-weight:700;font-size:13px;letter-spacing:.3px">RESULTADO</td>
      ${cols}
      <td style="${tdS('right')};font-weight:700;font-size:13px;color:${corTotal}">${fmtVSinal(total)}</td>
    </tr>
  `
}

// ---- helpers ----

function soma(arr) { return arr.reduce((a, b) => a + b, 0) }

function contarCategorias() {
  if (!_dados) return 0
  return _dados.receitas.length + _dados.despesas.length + _dados.investimentos.length
}

function expandirTodas() {
  if (!_dados) return
  _dados.receitas.forEach(c      => expandidos.add(`r:${c.nome}`))
  _dados.despesas.forEach(c      => expandidos.add(`d:${c.nome}`))
  _dados.investimentos.forEach(c => expandidos.add(`i:${c.nome}`))
}

function atualizarBtnToggle() {
  const btn = $('btnToggle')
  if (!btn) return
  const total = contarCategorias()
  btn.textContent = (total > 0 && expandidos.size >= total) ? 'Recolher todas' : 'Expandir todas'
}

function fmtV(v) {
  if (v === 0) return '—'
  return formatBRL(Math.abs(v))
}

function fmtVSinal(v) {
  if (v === 0) return '—'
  return formatBRL(v)
}

function thS(align) {
  return `padding:8px 10px;text-align:${align};font-size:11px;font-weight:600;color:var(--text-muted);white-space:nowrap`
}

function tdS(align) {
  return `padding:8px 10px;text-align:${align};color:var(--text);white-space:nowrap`
}

function escA(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
