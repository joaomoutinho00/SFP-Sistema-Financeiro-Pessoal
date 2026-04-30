// ============================================================
// SFP — Aba: Cartões
// ============================================================

import { supabase } from '../config.js'
import { formatBRL, badgeBanco } from '../services/formatters.js'

export async function render(container) {
  container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  try {
    const contas = await calcSaldoContas()
    renderSaldoContas(container, contas)
  } catch (err) {
    console.error(err)
    container.innerHTML = `<p style="color:var(--red);text-align:center;padding:32px;font-size:14px">Erro ao carregar saldo das contas.</p>`
  }
}

async function calcSaldoContas() {
  const hoje = new Date().toISOString().split('T')[0]

  const [{ data: contas, error: errContas }, { data: lancamentos, error: errLanc }] = await Promise.all([
    supabase.from('contas').select('id, nome, saldo_inicial, is_investimento').order('nome'),
    supabase.from('lancamentos')
      .select('id_lancamento, id_conta, valor, data, metodos(id, nome, afeta_saldo, id_tipo)')
      .lte('data', hoje),
  ])

  if (errContas) throw errContas
  if (errLanc)   throw errLanc

  for (const conta of contas) {
    let saldo    = conta.saldo_inicial ?? 0
    const lances = lancamentos.filter(l => l.id_conta === conta.id)

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

function renderSaldoContas(container, contas) {
  const normais = contas.filter(c => !c.is_investimento)
  const invest  = contas.filter(c => c.is_investimento)
  const totalNormal = normais.reduce((s, c) => s + (c.saldo_calculado ?? 0), 0)
  const totalInvest = invest.reduce((s, c) => s + (c.saldo_calculado ?? 0), 0)

  const linhasConta = (lista, corValor) => lista.map((c, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 0;${i < lista.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
      ${badgeBanco(c.nome)}
      <span style="font-size:15px;font-weight:700;color:${(c.saldo_calculado ?? 0) >= 0 ? corValor : 'var(--red)'}">
        ${formatBRL(c.saldo_calculado ?? 0)}
      </span>
    </div>
  `).join('')

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start">

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div class="card-title">Saldo Atual</div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px">Total</div>
            <div style="font-size:20px;font-weight:700;color:${totalNormal >= 0 ? 'var(--green)' : 'var(--red)'}">
              ${formatBRL(totalNormal)}
            </div>
          </div>
        </div>
        ${normais.length ? linhasConta(normais, 'var(--green)') : `<p style="color:var(--text-muted);font-size:14px;text-align:center;padding:16px 0">Nenhuma conta</p>`}
      </div>

      ${invest.length ? `
      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
          <div class="card-title">Investimentos</div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted);font-weight:500;text-transform:uppercase;letter-spacing:0.5px">Total</div>
            <div style="font-size:20px;font-weight:700;color:var(--blue)">${formatBRL(totalInvest)}</div>
          </div>
        </div>
        ${linhasConta(invest, 'var(--blue)')}
      </div>
      ` : ''}

    </div>
  `
}
