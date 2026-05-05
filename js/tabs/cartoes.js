// ============================================================
// SFP — Aba: Cartões
// ============================================================

import { supabase } from '../config.js'
import { formatBRL, formatCompetencia, competenciaAtual, addMeses, badgeBanco } from '../services/formatters.js'
import { invalidarCache } from '../forms/lancamento.js'

const COR_BANCO = {
  'SAFRA':  '#1e3a5f',
  'NUBANK': '#7c3aed',
  'XP':     '#64748b',
  'WISE':   '#16a34a',
}
const corBanco = nome => COR_BANCO[nome?.toUpperCase()] ?? '#6b7280'

let competencia = competenciaAtual()
let chartFatura = null

export async function render(container) {
  container.innerHTML = renderShell()
  bindEventos(container)
  await carregarDados(container)
  window.addEventListener('sfp:lancamento-salvo', () => carregarDados(container))
}

function renderShell() {
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="period-btn" id="btnAnterior">&#8249;</button>
        <span class="period-label" id="periodLabel">${formatCompetencia(competencia)}</span>
        <button class="period-btn" id="btnProximo">&#8250;</button>
      </div>
    </div>
    <div id="conteudo">
      <div class="loading"><div class="spinner"></div></div>
    </div>
  `
}

function bindEventos(container) {
  container.querySelector('#btnAnterior').addEventListener('click', async () => {
    competencia = addMeses(competencia, -1)
    container.querySelector('#periodLabel').textContent = formatCompetencia(competencia)
    await carregarDados(container)
  })
  container.querySelector('#btnProximo').addEventListener('click', async () => {
    competencia = addMeses(competencia, 1)
    container.querySelector('#periodLabel').textContent = formatCompetencia(competencia)
    await carregarDados(container)
  })
}

async function carregarDados(container) {
  const conteudo = container.querySelector('#conteudo')
  conteudo.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
  chartFatura?.destroy()
  chartFatura = null

  try {
    const dados = await buscarDados()
    renderConteudo(conteudo, dados)
  } catch (err) {
    console.error(err)
    conteudo.innerHTML = `<p style="color:var(--red);text-align:center;padding:32px;font-size:14px">Erro ao carregar cartões.</p>`
  }
}

async function buscarDados() {
  const meses = []
  for (let i = 5; i >= 0; i--) meses.push(addMeses(competencia, -i))

  // Contas com crédito
  const { data: contas, error: errContas } = await supabase
    .from('contas')
    .select('id, nome, has_credit, dia_fechamento, dias_ate_vencimento')
    .eq('has_credit', true)
    .order('nome')
  if (errContas) throw errContas
  if (!contas?.length) return { contas: [], meses, faturaPorContaMes: {}, faturas: [] }

  const contaIds = contas.map(c => c.id)

  // Lançamentos dos últimos 6 meses (para os cards e gráfico)
  const { data: lancamentos, error: errLanc } = await supabase
    .from('lancamentos')
    .select('valor, id_conta, competencia, metodos(id, nome, id_tipo)')
    .in('id_conta', contaIds)
    .gte('competencia', meses[0])
    .lte('competencia', meses[meses.length - 1])
  if (errLanc) throw errLanc

  // Agrega fatura por conta × competência
  const faturaPorContaMes = {}
  for (const l of lancamentos ?? []) {
    const nome = l.metodos?.nome
    if (nome !== 'CRÉDITO' && nome !== 'REEMBOLSO CARTÃO') continue
    const key = `${l.id_conta}:${l.competencia}`
    if (!faturaPorContaMes[key]) faturaPorContaMes[key] = 0
    const valor = Math.abs(l.valor)
    if (nome === 'CRÉDITO')          faturaPorContaMes[key] += valor
    if (nome === 'REEMBOLSO CARTÃO') faturaPorContaMes[key] -= valor
  }

  // Todas as faturas (para a listagem)
  const { data: faturaRows, error: errFat } = await supabase
    .from('faturas')
    .select('id, competencia, status, data_pagamento, id_conta')
    .in('id_conta', contaIds)
    .order('competencia', { ascending: false })
  if (errFat) throw errFat

  // Valores das faturas via lançamentos vinculados
  const fatIds = (faturaRows ?? []).map(f => f.id)
  let totalPorFatura = {}

  if (fatIds.length) {
    const { data: lancFat, error: errLF } = await supabase
      .from('lancamentos')
      .select('id_fatura, valor, metodos(id, nome)')
      .in('id_fatura', fatIds)
    if (errLF) throw errLF

    for (const l of lancFat ?? []) {
      if (!totalPorFatura[l.id_fatura]) totalPorFatura[l.id_fatura] = 0
      const nome  = l.metodos?.nome
      const valor = Math.abs(l.valor)
      if (nome === 'CRÉDITO')          totalPorFatura[l.id_fatura] += valor
      if (nome === 'REEMBOLSO CARTÃO') totalPorFatura[l.id_fatura] -= valor
    }
  }

  // Enriquece faturas com conta + valor calculado
  const contaMap = Object.fromEntries(contas.map(c => [c.id, c]))
  const faturas  = (faturaRows ?? []).map(f => ({
    ...f,
    conta: contaMap[f.id_conta],
    total: Math.max(0, totalPorFatura[f.id] ?? 0),
  })).sort((a, b) => {
    if (a.competencia !== b.competencia) return b.competencia.localeCompare(a.competencia)
    return (a.conta?.nome ?? '').localeCompare(b.conta?.nome ?? '', 'pt-BR')
  })

  return { contas, meses, faturaPorContaMes, faturas }
}

function faturaContaMes(faturaPorContaMes, idConta, mes) {
  return Math.max(0, faturaPorContaMes[`${idConta}:${mes}`] ?? 0)
}

function renderConteudo(conteudo, { contas, meses, faturaPorContaMes, faturas }) {
  if (!contas.length) {
    conteudo.innerHTML = `<p style="color:var(--text-muted);text-align:center;padding:48px;font-size:14px">Nenhum cartão de crédito cadastrado.</p>`
    return
  }

  const totalFaturaAtual = contas.reduce(
    (s, c) => s + faturaContaMes(faturaPorContaMes, c.id, competencia), 0
  )

  const labels = meses.map(m =>
    new Date(m + 'T00:00:00')
      .toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      .replace(/^\w/, c => c.toUpperCase())
  )

  conteudo.innerHTML = `

    <!-- Total fatura -->
    <div class="card" style="margin-bottom:24px;text-align:center;padding:36px 28px">
      <div style="font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">
        Fatura Total — ${formatCompetencia(competencia)}
      </div>
      <div style="font-size:48px;font-weight:700;color:var(--amber);line-height:1">
        ${formatBRL(totalFaturaAtual)}
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:8px">
        ${contas.length} cartão${contas.length !== 1 ? 'ões' : ''} no total
      </div>
    </div>

    <!-- Meus Cartões -->
    <div style="margin-bottom:24px">
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:16px">Meus Cartões</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:14px">
        ${contas.map(c => buildCartaoCard(c, faturaContaMes(faturaPorContaMes, c.id, competencia))).join('')}
      </div>
    </div>

    <!-- Histórico (gráfico) -->
    <div class="card" style="margin-bottom:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div class="card-title">Histórico de Faturas</div>
        <span style="font-size:12px;color:var(--text-muted)">Últimos 6 meses</span>
      </div>
      <div style="height:240px;position:relative">
        <canvas id="chartFatura"></canvas>
      </div>
    </div>

    <!-- Listagem de todas as faturas -->
    <div class="card">
      <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:20px">
        Todas as Faturas
        <span style="font-size:13px;font-weight:400;color:var(--text-muted);margin-left:8px">${faturas.length} registro${faturas.length !== 1 ? 's' : ''}</span>
      </div>
      ${renderListaFaturas(faturas)}
    </div>
  `

  conteudo.querySelector('#listaFaturas')?.addEventListener('click', e => {
    const row = e.target.closest('[data-fatura-id]')
    if (!row) return
    const fatura = faturas.find(f => f.id === Number(row.dataset.faturaId))
    if (fatura) abrirFatura(fatura)
  })

  conteudo.addEventListener('click', e => {
    const btn = e.target.closest('.btn-config-cartao')
    if (!btn) return
    const conta = contas.find(c => c.id === Number(btn.dataset.contaId))
    if (conta) abrirConfigCartao(conta, () => carregarDados(conteudo.parentElement))
  })

  // Gráfico de barras por banco × mês
  chartFatura = new Chart(document.getElementById('chartFatura'), {
    type: 'bar',
    data: {
      labels,
      datasets: contas.map(c => ({
        label: c.nome,
        data:  meses.map(m => faturaContaMes(faturaPorContaMes, c.id, m)),
        backgroundColor: corBanco(c.nome) + 'cc',
        borderColor:     corBanco(c.nome),
        borderWidth: 1,
        borderRadius: 5,
        borderSkipped: false,
      }))
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

function renderListaFaturas(faturas) {
  if (!faturas.length) {
    return `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:32px 0">Nenhuma fatura encontrada.</p>`
  }

  const cabecalho = `
    <div style="display:grid;grid-template-columns:auto 1fr auto auto;gap:16px;align-items:center;padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:4px">
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Cartão</span>
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px">Competência</span>
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;text-align:right">Valor</span>
      <span style="font-size:12px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.4px;text-align:center">Status</span>
    </div>
  `

  const linhas = faturas.map((f, i) => {
    const isPaga = f.status === 'PAGA'
    const badge  = isPaga
      ? `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#15803d">Paga</span>`
      : `<span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fffbeb;color:var(--amber)">Em aberto</span>`

    return `
      <div data-fatura-id="${f.id}" style="display:grid;grid-template-columns:auto 1fr auto auto;gap:16px;align-items:center;padding:11px 0;cursor:pointer;${i < faturas.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
        ${badgeBanco(f.conta?.nome)}
        <span style="font-size:13px;font-weight:500;color:var(--text)">${formatCompetencia(f.competencia)}</span>
        <span style="font-size:14px;font-weight:700;color:var(--amber);text-align:right;white-space:nowrap">${formatBRL(f.total)}</span>
        <div style="text-align:center">${badge}</div>
      </div>
    `
  }).join('')

  return `<div id="listaFaturas">${cabecalho}${linhas}</div>`
}

async function abrirFatura(fatura) {
  const isPaga = fatura.status === 'PAGA'
  const badge  = isPaga
    ? `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#dcfce7;color:#15803d">Paga</span>`
    : `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:600;background:#fffbeb;color:var(--amber)">Em aberto</span>`

  const el = document.createElement('div')
  el.className = 'confirm-overlay'
  el.innerHTML = `
    <div class="confirm-modal" style="max-width:720px;width:100%;max-height:80vh;display:flex;flex-direction:column">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px;flex-shrink:0">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            ${badgeBanco(fatura.conta?.nome)}
            <span style="font-size:15px;font-weight:700;color:var(--text)">${formatCompetencia(fatura.competencia)}</span>
            ${badge}
          </div>
          <div style="font-size:22px;font-weight:700;color:var(--amber)">${formatBRL(fatura.total)}</div>
        </div>
        <button class="btn btn-outline" id="fecharFaturaModal" style="flex-shrink:0">Fechar</button>
      </div>
      <div id="faturaLancs" style="overflow-y:auto;flex:1;padding-right:16px">
        <div class="loading"><div class="spinner"></div></div>
      </div>
    </div>
  `
  document.body.appendChild(el)
  document.body.style.overflow = 'hidden'
  const fechar = () => { el.remove(); document.body.style.overflow = '' }
  el.querySelector('#fecharFaturaModal').addEventListener('click', fechar)
  el.addEventListener('click', e => { if (e.target === el) fechar() })

  try {
    const { data, error } = await supabase
      .from('lancamentos')
      .select('id_lancamento, data, descricao, valor, metodos(nome), categorias(nome), subcategorias(nome)')
      .eq('id_fatura', fatura.id)
      .order('data', { ascending: false })
    if (error) throw error

    const div = el.querySelector('#faturaLancs')
    if (!data?.length) {
      div.innerHTML = `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:32px 0">Nenhum lançamento nesta fatura.</p>`
      return
    }

    div.innerHTML = data.map((l, i) => {
      const dataStr = l.data
        ? new Date(l.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        : '—'
      const sub     = [l.categorias?.nome, l.subcategorias?.nome].filter(Boolean).join(' · ')
      const metodo  = l.metodos?.nome ?? ''
      const isReemb = metodo === 'REEMBOLSO CARTÃO'
      const valorCor = isReemb ? 'var(--green)' : 'var(--amber)'
      const valorStr = isReemb ? `+${formatBRL(Math.abs(l.valor))}` : `−${formatBRL(Math.abs(l.valor))}`

      return `
        <div style="display:grid;grid-template-columns:36px 1fr auto;gap:12px;align-items:center;padding:10px 0;${i < data.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
          <span style="font-size:12px;color:var(--text-muted);white-space:nowrap">${dataStr}</span>
          <div>
            <div style="font-size:13px;font-weight:500;color:var(--text)">${l.descricao || '—'}</div>
            ${sub ? `<div style="font-size:11px;color:var(--text-muted);margin-top:1px">${sub}</div>` : ''}
          </div>
          <span style="font-size:13px;font-weight:700;color:${valorCor};white-space:nowrap">${valorStr}</span>
        </div>
      `
    }).join('')
  } catch (err) {
    el.querySelector('#faturaLancs').innerHTML = `<p style="color:var(--red);font-size:13px;padding:16px 0">Erro ao carregar: ${err.message}</p>`
  }
}

async function abrirConfigCartao(conta, onSalvo) {
  const cor = corBanco(conta.nome)
  const el  = document.createElement('div')
  el.className = 'confirm-overlay'
  el.innerHTML = `
    <div class="confirm-modal" style="max-width:400px;width:100%">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <div style="width:36px;height:36px;border-radius:8px;background:${cor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700">
          ${conta.nome?.slice(0, 2).toUpperCase()}
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--text)">${conta.nome}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px;margin-bottom:20px">
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px">
            Dia de fechamento <span style="font-weight:400;font-size:11px">(31 = último dia do mês)</span>
          </label>
          <input id="cfgDiaFech" type="number" min="1" max="31" class="form-input" placeholder="Ex: 31" value="${conta.dia_fechamento ?? ''}">
        </div>
        <div>
          <label style="font-size:12px;font-weight:600;color:var(--text-muted);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.4px">
            Dias até o vencimento
          </label>
          <input id="cfgDiasVenc" type="number" min="1" max="40" class="form-input" placeholder="Ex: 7" value="${conta.dias_ate_vencimento ?? ''}">
        </div>
      </div>
      <div id="cfgErro" style="color:var(--red);font-size:12px;margin-bottom:10px;display:none"></div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-outline" id="cfgCancelar">Cancelar</button>
        <button class="btn btn-primary" id="cfgSalvar">Salvar</button>
      </div>
    </div>
  `
  document.body.appendChild(el)
  document.body.style.overflow = 'hidden'
  const fechar = () => { el.remove(); document.body.style.overflow = '' }

  el.querySelector('#cfgCancelar').addEventListener('click', fechar)
  el.addEventListener('click', e => { if (e.target === el) fechar() })

  el.querySelector('#cfgSalvar').addEventListener('click', async () => {
    const diaFech  = parseInt(el.querySelector('#cfgDiaFech').value)  || null
    const diasVenc = parseInt(el.querySelector('#cfgDiasVenc').value) || null
    const erroEl   = el.querySelector('#cfgErro')
    if (diaFech && (diaFech < 1 || diaFech > 31)) {
      erroEl.textContent = 'Dia de fechamento deve ser entre 1 e 31.'
      erroEl.style.display = 'block'
      return
    }
    const btn = el.querySelector('#cfgSalvar')
    btn.disabled = true; btn.textContent = 'Salvando...'
    const { error } = await supabase.from('contas')
      .update({ dia_fechamento: diaFech, dias_ate_vencimento: diasVenc })
      .eq('id', conta.id)
    if (error) {
      erroEl.textContent = 'Erro ao salvar: ' + error.message
      erroEl.style.display = 'block'
      btn.disabled = false; btn.textContent = 'Salvar'
      return
    }
    invalidarCache()
    fechar()
    onSalvo?.()
  })
}

function calcDatasCartao(conta) {
  if (!conta.dia_fechamento) return null
  const [ano, mes] = competencia.split('-').map(Number)
  const lastDay    = new Date(ano, mes, 0).getDate()
  const diaFech    = conta.dia_fechamento === 31 ? lastDay : Math.min(conta.dia_fechamento, lastDay)
  const fechamento = `${String(diaFech).padStart(2, '0')}/${String(mes).padStart(2, '0')}`

  let vencimento = null
  if (conta.dias_ate_vencimento) {
    const dataFech = new Date(ano, mes - 1, diaFech)
    dataFech.setDate(dataFech.getDate() + conta.dias_ate_vencimento)
    vencimento = dataFech.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  }
  return { fechamento, vencimento }
}

function buildCartaoCard(conta, faturaAtual) {
  const cor   = corBanco(conta.nome)
  const datas = calcDatasCartao(conta)
  return `
    <div class="card" style="padding:20px;border-top:3px solid ${cor}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
        <div style="width:48px;height:48px;border-radius:10px;background:${cor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;letter-spacing:0.5px;flex-shrink:0">
          ${conta.nome?.slice(0, 2).toUpperCase() ?? '??'}
        </div>
        <div style="text-align:right">
          <div style="font-size:11px;color:var(--text-muted);font-weight:500;margin-bottom:2px">Fatura</div>
          <div style="font-size:18px;font-weight:700;color:var(--amber)">${formatBRL(faturaAtual)}</div>
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;justify-content:space-between">
        <div>
          <div style="font-size:13px;font-weight:600;color:var(--text)">${conta.nome}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${formatCompetencia(competencia)}</div>
          ${datas ? `
            <div style="margin-top:8px;display:flex;gap:12px">
              <div>
                <div style="font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.4px">Fecha</div>
                <div style="font-size:12px;font-weight:600;color:var(--text)">${datas.fechamento}</div>
              </div>
              ${datas.vencimento ? `
              <div>
                <div style="font-size:10px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.4px">Vence</div>
                <div style="font-size:12px;font-weight:600;color:var(--red)">${datas.vencimento}</div>
              </div>` : ''}
            </div>` : ''}
        </div>
        <button class="btn-config-cartao" data-conta-id="${conta.id}" data-dia-fech="${conta.dia_fechamento ?? ''}" data-dias-venc="${conta.dias_ate_vencimento ?? ''}" title="Configurar fechamento" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:16px;padding:4px;line-height:1">⚙</button>
      </div>
    </div>
  `
}
