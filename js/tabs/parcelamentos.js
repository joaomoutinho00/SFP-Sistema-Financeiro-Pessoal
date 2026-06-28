// ============================================================
// SFP — Aba: Parcelamentos
// ============================================================

import { supabase } from '../config.js'
import { formatBRL, formatData, badgeBanco } from '../services/formatters.js'

let filtroStatus = 'andamento' // 'andamento' | 'finalizado'

export async function render(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`
  try {
    const grupos = await buscarParcelamentos()
    renderTela(container, grupos)
  } catch (err) {
    console.error(err)
    container.innerHTML = `<p style="color:var(--red);text-align:center;padding:32px;font-size:14px">Erro ao carregar parcelamentos.</p>`
  }
}

async function buscarParcelamentos() {
  const hoje = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('lancamentos')
    .select(`
      id_lancamento, id_parcela, data, descricao, valor, qtd_parcelas, parcela_atual,
      contas       ( id, nome ),
      categorias   ( id, nome, id_tipo ),
      subcategorias!lancamentos_id_subcategoria_fkey( id, nome )
    `)
    .not('id_parcela', 'is', null)
    .order('data', { ascending: true })

  if (error) throw error

  // Agrupa por id_parcela
  const mapa = {}
  for (const l of data ?? []) {
    if (!mapa[l.id_parcela]) mapa[l.id_parcela] = []
    mapa[l.id_parcela].push(l)
  }

  return Object.values(mapa).map(parcelas => {
    const ref       = parcelas[0]
    const qtdTotal  = ref.qtd_parcelas ?? parcelas.length
    const valorParc = Math.abs(ref.valor)
    const pagas     = parcelas.filter(p => p.data <= hoje)
    const restantes = parcelas.filter(p => p.data > hoje)
    const valorPago = pagas.reduce((s, p) => s + Math.abs(p.valor), 0)
    const valorRest = restantes.reduce((s, p) => s + Math.abs(p.valor), 0)
    const pct       = qtdTotal > 0 ? Math.round(pagas.length / qtdTotal * 100) : 0
    const ultimaParc = parcelas.find(p => p.parcela_atual === qtdTotal)
    const status    = (restantes.length > 0 || !ultimaParc) ? 'andamento' : 'finalizado'

    return {
      id_parcela: ref.id_parcela,
      descricao:  ref.descricao,
      conta:      ref.contas?.nome,
      categoria:  ref.categorias?.nome,
      qtdTotal,
      qtdPagas:   pagas.length,
      valorParc,
      valorPago,
      valorRest,
      valorTotal: valorPago + valorRest,
      pct,
      status,
      proxData:   restantes.length > 0 ? restantes[0].data : null,
      ultimaPaga: pagas.length > 0 ? pagas[pagas.length - 1].data : null,
    }
  }).sort((a, b) => {
    if (a.status !== b.status) return a.status === 'andamento' ? -1 : 1
    if (a.proxData && b.proxData) return a.proxData.localeCompare(b.proxData)
    return 0
  })
}

function renderTela(container, grupos) {
  const emAndamento = grupos.filter(g => g.status === 'andamento')

  const totalAndamento   = emAndamento.length
  const valorTotalGlobal = emAndamento.reduce((s, g) => s + g.valorTotal, 0)
  const valorPagoGlobal  = emAndamento.reduce((s, g) => s + g.valorPago,  0)
  const valorRestGlobal  = emAndamento.reduce((s, g) => s + g.valorRest,  0)
  const pctGlobal        = valorTotalGlobal > 0
    ? Math.round(valorPagoGlobal / valorTotalGlobal * 100)
    : 0

  const lista = filtroStatus === 'andamento'
    ? emAndamento
    : grupos.filter(g => g.status === 'finalizado')

  const btnBase = 'padding:7px 18px;border:none;font-family:\'Sora\',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:all var(--transition);'
  const btnOn   = btnBase + 'background:var(--text);color:#fff;'
  const btnOff  = btnBase + 'background:var(--card);color:var(--text-muted);'

  container.innerHTML = `

    <!-- Bloco de resumo -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-title" style="margin-bottom:20px">Visão Geral dos Parcelamentos</div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px">
        <div style="text-align:center;padding:4px 0">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Em andamento</div>
          <div style="font-size:32px;font-weight:700;color:var(--text);line-height:1">${totalAndamento}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">parcelamento${totalAndamento !== 1 ? 's' : ''}</div>
        </div>
        <div style="text-align:center;padding:4px 0;border-left:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Valor Total</div>
          <div style="font-size:22px;font-weight:700;color:var(--text);line-height:1">${formatBRL(valorTotalGlobal)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">comprometido</div>
        </div>
        <div style="text-align:center;padding:4px 0;border-left:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Já Pago</div>
          <div style="font-size:22px;font-weight:700;color:var(--green);line-height:1">${formatBRL(valorPagoGlobal)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${pctGlobal}% do total</div>
        </div>
        <div style="text-align:center;padding:4px 0;border-left:1px solid var(--border)">
          <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Restante</div>
          <div style="font-size:22px;font-weight:700;color:var(--red);line-height:1">${formatBRL(valorRestGlobal)}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:4px">a pagar</div>
        </div>
      </div>

      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:12px;font-weight:500;color:var(--text-muted)">Progresso geral</span>
          <span style="font-size:12px;font-weight:700;color:var(--blue)">${pctGlobal}% pago</span>
        </div>
        <div style="height:10px;background:var(--border);border-radius:5px;overflow:hidden">
          <div style="height:100%;width:${pctGlobal}%;background:linear-gradient(90deg,var(--blue),#60a5fa);border-radius:5px;transition:width 0.6s ease"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:5px">
          <span style="font-size:11px;color:var(--text-muted)">0%</span>
          <span style="font-size:11px;color:var(--text-muted)">100%</span>
        </div>
      </div>
    </div>

    <!-- Lista com filtro -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text);margin-bottom:2px">Parcelamentos</div>
          <span style="font-size:13px;color:var(--text-muted)">${lista.length} ${filtroStatus === 'andamento' ? 'em andamento' : `finalizado${lista.length !== 1 ? 's' : ''}`}</span>
        </div>
        <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
          <button id="btnAndamento" style="${filtroStatus === 'andamento' ? btnOn : btnOff}">Em andamento</button>
          <button id="btnFinalizado" style="border-left:1px solid var(--border);${filtroStatus === 'finalizado' ? btnOn : btnOff}">Finalizados</button>
        </div>
      </div>

      <div id="listaParcelamentos">
        ${lista.length
          ? lista.map((g, i) => buildRow(g, i < lista.length - 1)).join('')
          : `<p style="text-align:center;padding:48px 0;color:var(--text-muted);font-size:14px">
               Nenhum parcelamento ${filtroStatus === 'andamento' ? 'em andamento' : 'finalizado'}.
             </p>`
        }
      </div>
    </div>
  `

  container.querySelector('#btnAndamento').addEventListener('click', () => {
    if (filtroStatus === 'andamento') return
    filtroStatus = 'andamento'
    renderTela(container, grupos)
  })
  container.querySelector('#btnFinalizado').addEventListener('click', () => {
    if (filtroStatus === 'finalizado') return
    filtroStatus = 'finalizado'
    renderTela(container, grupos)
  })
}

function buildRow(g, comBorda) {
  const isAndamento = g.status === 'andamento'
  const corBarra    = isAndamento ? 'var(--blue)' : 'var(--green)'

  return `
    <div style="padding:16px 0;${comBorda ? 'border-bottom:1px solid var(--border)' : ''}">

      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:var(--text);margin-bottom:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
            ${g.descricao || '—'}
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
            ${g.categoria ? `<span class="badge badge-cat" style="font-size:11px">${g.categoria}</span>` : ''}
            ${badgeBanco(g.conta)}
          </div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:700;color:var(--text)">${formatBRL(g.valorParc)}<span style="font-size:11px;font-weight:400;color:var(--text-muted)">/parc.</span></div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${g.qtdPagas} de ${g.qtdTotal} paga${g.qtdPagas !== 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${g.pct}%;background:${corBarra};border-radius:3px"></div>
        </div>
        <span style="font-size:11px;font-weight:700;color:${corBarra};flex-shrink:0;min-width:32px;text-align:right">${g.pct}%</span>
      </div>

      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <span style="font-size:12px;color:var(--text-muted)">Pago: <strong style="color:var(--green)">${formatBRL(g.valorPago)}</strong></span>
        ${isAndamento
          ? `<span style="font-size:12px;color:var(--text-muted)">Restante: <strong style="color:var(--red)">${formatBRL(g.valorRest)}</strong></span>`
          : ''}
        <span style="font-size:12px;color:var(--text-muted)">Total: <strong style="color:var(--text)">${formatBRL(g.valorTotal)}</strong></span>
        ${isAndamento && g.proxData
          ? `<span style="font-size:12px;color:var(--text-muted)">Próxima: <strong style="color:var(--text)">${formatData(g.proxData)}</strong></span>`
          : ''}
        ${!isAndamento && g.ultimaPaga
          ? `<span style="font-size:12px;color:var(--text-muted)">Quitado em: <strong style="color:var(--text)">${formatData(g.ultimaPaga)}</strong></span>`
          : ''}
      </div>

    </div>
  `
}
