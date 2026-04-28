// ============================================================
// SFP — Form: Novo Lançamento
// ============================================================

import { supabase } from '../config.js'
import { proximoIdLancamento, proximoIdParcela, proximoIdTransf } from '../services/supabase.js'

const TIPOS = [
  { id: 1, slug: 'entrada',  label: 'Entrada'       },
  { id: 2, slug: 'saida',    label: 'Saída'         },
  { id: 3, slug: 'transf',   label: 'Transferência' },
  { id: 4, slug: 'controle', label: 'Controle'      },
  { id: 5, slug: 'invest',   label: 'Investimento'  },
]

const CORES_CONTA = {
  'SAFRA':  { bg: '#1e3a5f', fg: '#ffffff' },
  'NUBANK': { bg: '#7c3aed', fg: '#ffffff' },
  'XP':     { bg: '#e2e8f0', fg: '#1a1a1a' },
  'WISE':   { bg: '#16a34a', fg: '#ffffff' },
}

// ── Helpers de UI ─────────────────────────────────────────────
function aplicarCorConta(sel, contas) {
  const conta = contas.find(c => c.id == sel.value)
  const cor   = CORES_CONTA[conta?.nome?.toUpperCase()]
  sel.style.background = cor?.bg ?? ''
  sel.style.color      = cor?.fg ?? ''
}

function formatarCompetencia(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  const s = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function primeiroDiaMes(dataStr) {
  const d = new Date(dataStr + 'T12:00:00')
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0]
}

function buildSubcatOptions(catId, categorias, selectedSubId) {
  const cat  = categorias.find(c => c.id == catId)
  const subs = cat?.subcategorias ?? []
  if (!catId || !subs.length) return `<option value="">— selecione a categoria —</option>`
  return `<option value="">Selecionar...</option>` +
    subs.map(s => `<option value="${s.id}" ${s.id == selectedSubId ? 'selected' : ''}>${s.nome}</option>`).join('')
}

function buildContaOptions(contas, idMetodoSel, idMetodoCred, idMetodoPix, selectedContaId) {
  let lista = contas
  if (idMetodoSel && idMetodoSel == idMetodoCred) lista = contas.filter(c => c.has_credit)
  else if (idMetodoSel && idMetodoSel == idMetodoPix) lista = contas.filter(c => !c.is_investimento)
  return `<option value="">Selecionar...</option>` +
    lista.map(c => `<option value="${c.id}" ${c.id == selectedContaId ? 'selected' : ''}>${c.nome}</option>`).join('')
}

// ── Cache ─────────────────────────────────────────────────────
let _cache      = null
let _drawerInit = false

async function carregarCache() {
  if (_cache) return _cache
  const [r1, r2, r3] = await Promise.all([
    supabase.from('metodos').select('id, nome, id_tipo').order('id'),
    supabase.from('contas').select('id, nome, is_investimento, has_credit').order('nome'),
    supabase.from('categorias').select('id, nome, id_tipo, subcategorias(id, nome)').order('nome'),
  ])
  _cache = {
    metodos:    r1.data ?? [],
    contas:     r2.data ?? [],
    categorias: (r3.data ?? []).map(c => ({
      ...c,
      subcategorias: (c.subcategorias ?? []).sort((a, b) => a.nome.localeCompare(b.nome)),
    })),
  }
  return _cache
}

function initDrawer() {
  if (_drawerInit) return
  _drawerInit = true
  const fechar = () => {
    document.getElementById('overlay').classList.remove('active')
    document.getElementById('drawer').classList.remove('active')
  }
  document.getElementById('overlay').addEventListener('click', fechar)
  document.getElementById('drawerClose').addEventListener('click', fechar)
}

// ── Export principal ──────────────────────────────────────────
export async function abrirNovoLancamento() {
  initDrawer()

  const overlay = document.getElementById('overlay')
  const drawer  = document.getElementById('drawer')
  const body    = document.getElementById('drawerBody')

  overlay.classList.add('active')
  drawer.classList.add('active')
  body.innerHTML = `<div class="loading"><div class="spinner"></div></div>`

  const { metodos, contas, categorias } = await carregarCache()

  // IDs de métodos
  const idMetodoCred        = metodos.find(m => m.nome === 'CRÉDITO')?.id
  const idMetodoPix         = metodos.find(m => m.nome === 'PIX')?.id
  const idMetodoTransfSaida = metodos.find(m => m.id_tipo === 3 && m.nome === 'SAÍDA')?.id
  const idMetodoTransfEntr  = metodos.find(m => m.id_tipo === 3 && m.nome === 'ENTRADA')?.id
  const idMetodoFatura      = metodos.find(m => m.nome === 'FATURA')?.id
  const idMetodoReembolso   = metodos.find(m => m.nome === 'REEMBOLSO CARTÃO')?.id

  // IDs de categorias e subcategorias de controle (auto-seleção pois cada uma tem 1 sub)
  const _catPagFatura   = categorias.find(c => c.nome === 'PAG. FATURA'        && c.id_tipo === 4)
  const _catReembolsoC  = categorias.find(c => c.nome === 'REEMBOLSO - CARTÃO' && c.id_tipo === 4)
  const idCatPagFatura  = _catPagFatura?.id
  const idSubPagFatura  = _catPagFatura?.subcategorias?.[0]?.id ?? null
  const idCatReembolsoC = _catReembolsoC?.id

  const hoje  = new Date().toISOString().split('T')[0]
  let tipoSel = 1
  let parcSel = false
  let faturas     = []
  let idFaturaSel = null
  const vals  = { fData: hoje }

  // ── Helpers internos ────────────────────────────────────────

  // Fecha o drawer e notifica a app
  function fecharSalvo() {
    overlay.classList.remove('active')
    drawer.classList.remove('active')
    window.dispatchEvent(new CustomEvent('sfp:lancamento-salvo'))
  }

  // Vincula categoria → subcategoria (reutilizado em todos os tipos)
  function bindCategoria() {
    const fCatEl = document.getElementById('fCategoria')
    if (!fCatEl) return
    fCatEl.addEventListener('change', e => {
      const catId = e.target.value
      const fSub  = document.getElementById('fSubcategoria')
      const wrap  = document.getElementById('wrapSubcategoria')
      if (!fSub || !wrap) return
      const cat  = categorias.find(c => c.id == catId)
      const subs = cat?.subcategorias ?? []
      if (subs.length === 1) {
        fSub.innerHTML = buildSubcatOptions(catId, categorias, subs[0].id)
        fSub.value = String(subs[0].id)
      } else {
        fSub.innerHTML = buildSubcatOptions(catId, categorias, null)
      }
      wrap.style.display = (catId && subs.length > 1) ? '' : 'none'
    })
  }

  // Busca a fatura aberta para a conta+competência; cria se não existir
  async function resolverFatura(idConta, competencia) {
    const { data: fat } = await supabase
      .from('faturas')
      .select('id')
      .eq('id_conta', idConta)
      .eq('competencia', competencia)
      .eq('status', 'ABERTA')
      .maybeSingle()
    if (fat) return fat.id

    const { data: nova, error } = await supabase
      .from('faturas')
      .insert({ id_conta: idConta, competencia, status: 'ABERTA' })
      .select('id')
      .single()
    if (error) throw error
    return nova.id
  }

  // Busca faturas abertas de uma conta, com total calculado pelos lançamentos
  async function buscarFaturasAbertas(idConta) {
    const { data: fats, error: e1 } = await supabase
      .from('faturas')
      .select('id, competencia')
      .eq('id_conta', idConta)
      .eq('status', 'ABERTA')
      .order('competencia', { ascending: false })
    if (e1) throw e1
    if (!fats?.length) return []

    const ids = fats.map(f => f.id)
    const { data: lancs, error: e2 } = await supabase
      .from('lancamentos')
      .select('id_fatura, valor, id_metodo')
      .in('id_fatura', ids)
    if (e2) throw e2

    const totais = {}
    for (const l of lancs ?? []) {
      const delta = l.id_metodo === idMetodoReembolso ? -Math.abs(l.valor) : Math.abs(l.valor)
      totais[l.id_fatura] = (totais[l.id_fatura] ?? 0) + delta
    }
    return fats.map(f => ({ id: f.id, competencia: f.competencia, total: totais[f.id] ?? 0 }))
  }

  // ── State ────────────────────────────────────────────────────
  function lerValores() {
    for (const id of ['fData','fConta','fDescricao','fValor','fMetodo','fCategoria','fSubcategoria','fQtdParcelas','fParcelaAtual','fContaOrigem','fContaDestino']) {
      const el = document.getElementById(id)
      if (el) vals[id] = el.value
    }
    const fFat = document.getElementById('fFatura')
    if (fFat && fFat.value) idFaturaSel = parseInt(fFat.value)
  }

  // ── Render ───────────────────────────────────────────────────
  function render() {
    const ehEntrada  = tipoSel === 1
    const ehSaida    = tipoSel === 2
    const ehTransf   = tipoSel === 3
    const ehControle = tipoSel === 4
    const mets       = metodos.filter(m => m.id_tipo === tipoSel)
    const cats       = categorias.filter(c => c.id_tipo === tipoSel)

    if (!cats.find(c => c.id == vals.fCategoria)) {
      vals.fCategoria    = ''
      vals.fSubcategoria = ''
    }
    if (!mets.find(m => m.id == vals.fMetodo)) {
      vals.fMetodo = ''
    }

    const tipoBar = `
      <div class="tipo-bar">
        ${TIPOS.map(t => `
          <button type="button" class="type-btn${tipoSel === t.id ? ` active-${t.slug}` : ''}" data-tipo="${t.id}">
            ${t.label}
          </button>
        `).join('')}
      </div>
    `

    // ── CONTROLE ───────────────────────────────────────────────
    if (ehControle) {
      const ehFatura    = vals.fMetodo == idMetodoFatura
      const ehReembolso = vals.fMetodo == idMetodoReembolso
      const contasDisp  = (ehFatura || ehReembolso)
        ? contas.filter(c => c.has_credit)
        : contas.filter(c => !c.is_investimento)

      const catSel  = categorias.find(c => c.id == vals.fCategoria)
      const subsArr = catSel?.subcategorias ?? []
      if (subsArr.length === 1) vals.fSubcategoria = String(subsArr[0].id)
      const showSubcat = vals.fCategoria && subsArr.length > 1

      body.innerHTML = tipoBar + `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input id="fData" type="date" class="form-input" value="${vals.fData ?? hoje}">
          </div>
          <div class="form-group">
            <label class="form-label">Método</label>
            <select id="fMetodo" class="form-select">
              <option value="">Selecionar...</option>
              ${mets.map(m => `<option value="${m.id}" ${vals.fMetodo == m.id ? 'selected' : ''}>${m.nome}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Conta</label>
          <select id="fConta" class="form-select" ${!vals.fMetodo ? 'disabled' : ''}>
            ${!vals.fMetodo
              ? '<option value="">Selecione o método</option>'
              : `<option value="">Selecionar...</option>` +
                contasDisp.map(c => `<option value="${c.id}" ${c.id == vals.fConta ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>

        ${ehFatura && vals.fConta ? `
          ${faturas.length ? `
            <div class="form-group">
              <label class="form-label">Fatura</label>
              <select id="fFatura" class="form-select">
                <option value="">Selecionar...</option>
                ${faturas.map(f => `
                  <option value="${f.id}" ${f.id === idFaturaSel ? 'selected' : ''}>
                    ${formatarCompetencia(f.competencia)} — R$ ${f.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </option>
                `).join('')}
              </select>
            </div>
          ` : `
            <p style="color:var(--muted,#888);font-size:13px;text-align:center;padding:8px 0;margin:0">
              Nenhuma fatura aberta para esta conta.
            </p>
          `}
        ` : ''}

        ${ehReembolso ? `
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input id="fValor" type="number" class="form-input" placeholder="0.00" step="0.01" min="0" value="${vals.fValor ?? ''}">
          </div>
          <div class="form-group">
            <label class="form-label">Descrição</label>
            <input id="fDescricao" type="text" class="form-input" placeholder="Ex: Reembolso compra..." value="${vals.fDescricao ?? ''}">
          </div>
          ${renderCatSubcat(cats, showSubcat)}
        ` : ''}

        <button type="button" id="fSalvar" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;margin-top:8px">
          ${ehFatura && idFaturaSel ? 'Pagar Fatura' : 'Salvar Lançamento'}
        </button>
        <div id="fErro" style="color:var(--red);font-size:12px;margin-top:8px;display:none;text-align:center"></div>
      `
      bindForm()
      return
    }

    // ── OUTROS TIPOS ───────────────────────────────────────────
    const catSel   = categorias.find(c => c.id == vals.fCategoria)
    const subsArr  = catSel?.subcategorias ?? []
    if (subsArr.length === 1) vals.fSubcategoria = String(subsArr[0].id)
    const showSubcat = vals.fCategoria && subsArr.length > 1

    body.innerHTML = tipoBar + `

      ${ehEntrada ? `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input id="fData" type="date" class="form-input" value="${vals.fData ?? hoje}">
          </div>
          <div class="form-group">
            <label class="form-label">Conta</label>
            <select id="fConta" class="form-select">
              ${buildContaOptions(contas, null, idMetodoCred, idMetodoPix, vals.fConta)}
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Valor (R$)</label>
          <input id="fValor" type="number" class="form-input" placeholder="0.00" step="0.01" min="0" value="${vals.fValor ?? ''}">
        </div>
      ` : ehTransf ? `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input id="fData" type="date" class="form-input" value="${vals.fData ?? hoje}">
          </div>
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input id="fValor" type="number" class="form-input" placeholder="0.00" step="0.01" min="0" value="${vals.fValor ?? ''}">
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Conta Origem</label>
            <select id="fContaOrigem" class="form-select">
              <option value="">Selecionar...</option>
              ${contas.filter(c => !c.is_investimento)
                .map(c => `<option value="${c.id}" ${c.id == vals.fContaOrigem ? 'selected' : ''}>${c.nome}</option>`)
                .join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Conta Destino</label>
            <select id="fContaDestino" class="form-select">
              <option value="">Selecionar...</option>
              ${contas.filter(c => !c.is_investimento && c.id != vals.fContaOrigem)
                .map(c => `<option value="${c.id}" ${c.id == vals.fContaDestino ? 'selected' : ''}>${c.nome}</option>`)
                .join('')}
            </select>
          </div>
        </div>
      ` : `
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Data</label>
            <input id="fData" type="date" class="form-input" value="${vals.fData ?? hoje}">
          </div>
          <div class="form-group">
            <label class="form-label">Método</label>
            <select id="fMetodo" class="form-select">
              <option value="">Selecionar...</option>
              ${mets.map(m => `<option value="${m.id}" ${vals.fMetodo == m.id ? 'selected' : ''}>${m.nome}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row-2">
          <div class="form-group">
            <label class="form-label">Conta</label>
            <select id="fConta" class="form-select" ${!vals.fMetodo ? 'disabled' : ''}>
              ${!vals.fMetodo
                ? '<option value="">Selecione o método</option>'
                : buildContaOptions(contas, vals.fMetodo, idMetodoCred, idMetodoPix, vals.fConta)}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Valor (R$)</label>
            <input id="fValor" type="number" class="form-input" placeholder="0.00" step="0.01" min="0" value="${vals.fValor ?? ''}">
          </div>
        </div>
      `}

      <div class="form-group">
        <label class="form-label">Descrição</label>
        <input id="fDescricao" type="text" class="form-input" placeholder="Ex: Almoço, Salário..." value="${vals.fDescricao ?? ''}">
      </div>

      ${renderCatSubcat(cats, showSubcat)}

      ${ehSaida ? `
        <div style="display:grid;grid-template-columns:auto 1fr 1fr;gap:12px;align-items:end">
          <div class="form-group" style="margin-bottom:0">
            <label class="form-label">Parcelamento</label>
            <label class="toggle-wrap" style="cursor:pointer;user-select:none;height:42px;display:flex;align-items:center">
              <span class="toggle">
                <input type="checkbox" id="fParcToggle" ${parcSel ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </span>
            </label>
          </div>
          <div class="form-group" id="wrapQtd" style="margin-bottom:0;visibility:${parcSel ? 'visible' : 'hidden'}">
            <label class="form-label">Qtd. Parcelas</label>
            <input id="fQtdParcelas" type="number" class="form-input" min="1" max="60" placeholder="Ex: 12" value="${vals.fQtdParcelas ?? ''}" ${!parcSel ? 'tabindex="-1"' : ''}>
          </div>
          <div class="form-group" id="wrapParc" style="margin-bottom:0;visibility:${parcSel ? 'visible' : 'hidden'}">
            <label class="form-label">Parcela Atual</label>
            <input id="fParcelaAtual" type="number" class="form-input" min="1" max="60" placeholder="Ex: 1" value="${vals.fParcelaAtual ?? ''}" ${!parcSel ? 'tabindex="-1"' : ''}>
          </div>
        </div>
      ` : ''}

      <button type="button" id="fSalvar" class="btn btn-primary" style="width:100%;justify-content:center;padding:12px;margin-top:8px">
        Salvar Lançamento
      </button>
      <div id="fErro" style="color:var(--red);font-size:12px;margin-top:8px;display:none;text-align:center"></div>
    `

    bindForm()
  }

  // Bloco HTML reutilizável de categoria + subcategoria
  function renderCatSubcat(cats, showSubcat) {
    return `
      <div class="form-row-2">
        <div class="form-group">
          <label class="form-label">Categoria</label>
          <select id="fCategoria" class="form-select">
            <option value="">Selecionar...</option>
            ${cats.map(c => `<option value="${c.id}" ${vals.fCategoria == c.id ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" id="wrapSubcategoria" style="${showSubcat ? '' : 'display:none'}">
          <label class="form-label">Subcategoria</label>
          <select id="fSubcategoria" class="form-select">
            ${buildSubcatOptions(vals.fCategoria, categorias, vals.fSubcategoria)}
          </select>
        </div>
      </div>
    `
  }

  // ── Bind ─────────────────────────────────────────────────────
  function bindForm() {
    // Troca de tipo
    body.querySelectorAll('.type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        lerValores()
        const novoTipo = parseInt(btn.dataset.tipo)
        if (novoTipo !== tipoSel) { faturas = []; idFaturaSel = null }
        tipoSel = novoTipo
        if (tipoSel !== 2) parcSel = false
        render()
      })
    })

    // ── CONTROLE ──────────────────────────────────────────────
    if (tipoSel === 4) {
      document.getElementById('fMetodo')?.addEventListener('change', () => {
        lerValores()
        faturas = []
        idFaturaSel = null
        vals.fConta = ''
        render()
      })

      const fContaEl = document.getElementById('fConta')
      if (fContaEl) {
        aplicarCorConta(fContaEl, contas)
        fContaEl.addEventListener('change', async () => {
          lerValores()
          faturas = []
          idFaturaSel = null
          if (vals.fConta && vals.fMetodo == idMetodoFatura) {
            try { faturas = await buscarFaturasAbertas(parseInt(vals.fConta)) }
            catch (e) { console.error(e) }
          }
          render()
          const el = document.getElementById('fConta')
          if (el) aplicarCorConta(el, contas)
        })
      }

      document.getElementById('fFatura')?.addEventListener('change', e => {
        idFaturaSel = e.target.value ? parseInt(e.target.value) : null
        const btn = document.getElementById('fSalvar')
        if (btn) btn.textContent = idFaturaSel ? 'Pagar Fatura' : 'Salvar Lançamento'
      })

      bindCategoria()
      document.getElementById('fSalvar').addEventListener('click', salvar)
      return
    }

    // ── OUTROS TIPOS ──────────────────────────────────────────
    const fMetodoEl = document.getElementById('fMetodo')
    if (fMetodoEl) {
      fMetodoEl.addEventListener('change', e => {
        const idMet      = e.target.value
        const fConta     = document.getElementById('fConta')
        const contaAtual = fConta.value
        fConta.disabled  = !idMet
        fConta.innerHTML = buildContaOptions(contas, idMet, idMetodoCred, idMetodoPix, contaAtual)
        const contaSel = contas.find(c => c.id == contaAtual)
        if (contaSel) {
          if (idMet == idMetodoCred && !contaSel.has_credit)      fConta.value = ''
          if (idMet == idMetodoPix  &&  contaSel.is_investimento) fConta.value = ''
        }
        aplicarCorConta(fConta, contas)
      })
    }

    const fOrigem = document.getElementById('fContaOrigem')
    if (fOrigem) {
      fOrigem.addEventListener('change', () => {
        const origemId = fOrigem.value
        const fDestino = document.getElementById('fContaDestino')
        const selAtual = fDestino.value
        const lista    = contas.filter(c => !c.is_investimento && c.id != origemId)
        fDestino.innerHTML = `<option value="">Selecionar...</option>` +
          lista.map(c => `<option value="${c.id}" ${c.id == selAtual ? 'selected' : ''}>${c.nome}</option>`).join('')
        if (selAtual == origemId) fDestino.value = ''
        aplicarCorConta(fDestino, contas)
      })
    }

    bindCategoria()

    const togParc = document.getElementById('fParcToggle')
    if (togParc) {
      togParc.addEventListener('change', () => {
        parcSel = togParc.checked
        for (const id of ['wrapQtd', 'wrapParc']) {
          const el = document.getElementById(id)
          el.style.visibility = parcSel ? 'visible' : 'hidden'
          el.querySelector('input').tabIndex = parcSel ? 0 : -1
        }
      })
    }

    for (const id of ['fConta', 'fContaOrigem', 'fContaDestino']) {
      const el = document.getElementById(id)
      if (!el) continue
      aplicarCorConta(el, contas)
      el.addEventListener('change', () => aplicarCorConta(el, contas))
    }

    document.getElementById('fSalvar').addEventListener('click', salvar)
  }

  // ── Salvar ───────────────────────────────────────────────────
  async function salvar() {
    const erroEl = document.getElementById('fErro')
    erroEl.style.display = 'none'

    // ── CONTROLE + FATURA ────────────────────────────────────
    if (tipoSel === 4 && parseInt(document.getElementById('fMetodo')?.value) === idMetodoFatura) {
      const data    = document.getElementById('fData').value
      const idConta = parseInt(document.getElementById('fConta').value)

      const erros = []
      if (!data)        erros.push('Data')
      if (!idConta)     erros.push('Conta')
      if (!idFaturaSel) erros.push('Fatura')

      if (erros.length) {
        erroEl.textContent = 'Preencha: ' + erros.join(' · ')
        erroEl.style.display = 'block'
        return
      }

      const fatura = faturas.find(f => f.id === idFaturaSel)
      if (!fatura) {
        erroEl.textContent = 'Fatura não encontrada. Tente novamente.'
        erroEl.style.display = 'block'
        return
      }

      const btn = document.getElementById('fSalvar')
      btn.disabled    = true
      btn.textContent = 'Salvando...'

      try {
        const idLancamento = await proximoIdLancamento()

        const { error: errLanc } = await supabase.from('lancamentos').insert({
          id_lancamento:   idLancamento,
          data,
          id_metodo:       idMetodoFatura,
          id_conta:        idConta,
          descricao:       `Pagamento Fatura ${formatarCompetencia(fatura.competencia)}`,
          valor:           fatura.total,
          id_categoria:    idCatPagFatura,
          id_subcategoria: idSubPagFatura,
          qtd_parcelas:    null,
          parcela_atual:   null,
          id_parcela:      null,
          id_transf:       null,
          id_fatura:       fatura.id,
          competencia:     primeiroDiaMes(data),
        })
        if (errLanc) throw errLanc

        const { error: errFat } = await supabase.from('faturas')
          .update({ status: 'PAGA', data_pagamento: data, id_lancamento_pagamento: idLancamento })
          .eq('id', fatura.id)
        if (errFat) throw errFat

        fecharSalvo()
      } catch (err) {
        erroEl.textContent = 'Erro ao salvar: ' + err.message
        erroEl.style.display = 'block'
        btn.disabled    = false
        btn.textContent = 'Pagar Fatura'
      }
      return
    }

    // Leitura dos campos comuns (todos os tipos exceto CONTROLE+FATURA)
    const data        = document.getElementById('fData').value
    const descricao   = document.getElementById('fDescricao').value.trim()
    const valorRaw    = parseFloat(document.getElementById('fValor').value)
    const idCategoria = parseInt(document.getElementById('fCategoria').value)
    const idSubcat    = parseInt(document.getElementById('fSubcategoria').value) || null
    const cat         = categorias.find(c => c.id === idCategoria)
    const hasSubs     = (cat?.subcategorias ?? []).length > 0

    // ── TRANSFERÊNCIA ─────────────────────────────────────────
    if (tipoSel === 3) {
      const idContaOrigem  = parseInt(document.getElementById('fContaOrigem').value)
      const idContaDestino = parseInt(document.getElementById('fContaDestino').value)

      const erros = []
      if (!data)                              erros.push('Data')
      if (isNaN(valorRaw) || valorRaw <= 0)  erros.push('Valor (deve ser maior que zero)')
      if (!idContaOrigem)                    erros.push('Conta Origem')
      if (!idContaDestino)                   erros.push('Conta Destino')
      if (idContaOrigem === idContaDestino)  erros.push('Conta Origem e Destino não podem ser iguais')
      if (!descricao)                        erros.push('Descrição')
      if (isNaN(idCategoria))                erros.push('Categoria')
      if (hasSubs && !idSubcat)              erros.push('Subcategoria')

      if (erros.length) {
        erroEl.textContent = 'Preencha: ' + erros.join(' · ')
        erroEl.style.display = 'block'
        return
      }

      const btn = document.getElementById('fSalvar')
      btn.disabled    = true
      btn.textContent = 'Salvando...'

      try {
        const [idLanc1, idTransf] = await Promise.all([proximoIdLancamento(), proximoIdTransf()])
        const num2    = parseInt(idLanc1.replace('L', '')) + 1
        const idLanc2 = `L${String(num2).padStart(6, '0')}`
        const base    = {
          data,
          descricao,
          valor:           Math.abs(valorRaw),
          id_categoria:    idCategoria,
          id_subcategoria: idSubcat,
          qtd_parcelas:    null,
          parcela_atual:   null,
          id_parcela:      null,
          id_transf:       idTransf,
          id_fatura:       null,
          competencia:     primeiroDiaMes(data),
        }

        const { error } = await supabase.from('lancamentos').insert([
          { ...base, id_lancamento: idLanc1, id_metodo: idMetodoTransfSaida, id_conta: idContaOrigem  },
          { ...base, id_lancamento: idLanc2, id_metodo: idMetodoTransfEntr,  id_conta: idContaDestino },
        ])
        if (error) throw error

        fecharSalvo()
      } catch (err) {
        erroEl.textContent = 'Erro ao salvar: ' + err.message
        erroEl.style.display = 'block'
        btn.disabled    = false
        btn.textContent = 'Salvar Lançamento'
      }
      return
    }

    // ── DEMAIS TIPOS (Entrada, Saída, Controle+Reembolso, Invest) ─
    const idConta  = parseInt(document.getElementById('fConta').value)
    const idMetodo = tipoSel === 1 ? 1 : parseInt(document.getElementById('fMetodo').value)

    const comParc      = tipoSel === 2 && parcSel
    const qtdParcelas  = comParc ? parseInt(document.getElementById('fQtdParcelas').value) || null : null
    const parcelaAtual = comParc ? parseInt(document.getElementById('fParcelaAtual').value) || null : null

    const erros = []
    if (!data)                                erros.push('Data')
    if (tipoSel !== 1 && isNaN(idMetodo))     erros.push('Método')
    if (!idConta)                             erros.push('Conta')
    if (!descricao)                           erros.push('Descrição')
    if (isNaN(valorRaw) || valorRaw <= 0)     erros.push('Valor (deve ser maior que zero)')
    if (isNaN(idCategoria))                   erros.push('Categoria')
    if (hasSubs && !idSubcat)                 erros.push('Subcategoria')
    if (comParc && !qtdParcelas)              erros.push('Qtd. Parcelas')
    if (comParc && !parcelaAtual)             erros.push('Parcela Atual')

    if (erros.length) {
      erroEl.textContent = 'Preencha: ' + erros.join(' · ')
      erroEl.style.display = 'block'
      return
    }

    const btn = document.getElementById('fSalvar')
    btn.disabled    = true
    btn.textContent = 'Salvando...'

    try {
      const competencia = primeiroDiaMes(data)

      // CRÉDITO e REEMBOLSO CARTÃO vinculam-se à fatura aberta da conta/mês
      let idFatura = null
      if (idMetodo === idMetodoCred || idMetodo === idMetodoReembolso) {
        idFatura = await resolverFatura(idConta, competencia)
      }

      const [idLancamento, idParcela] = await Promise.all([
        proximoIdLancamento(),
        (qtdParcelas && qtdParcelas > 1) ? proximoIdParcela() : Promise.resolve(null),
      ])

      const { error } = await supabase.from('lancamentos').insert({
        id_lancamento:   idLancamento,
        data,
        id_metodo:       idMetodo,
        id_conta:        idConta,
        descricao,
        valor:           Math.abs(valorRaw),
        id_categoria:    idCategoria,
        id_subcategoria: idSubcat,
        qtd_parcelas:    qtdParcelas,
        parcela_atual:   parcelaAtual,
        id_parcela:      idParcela,
        id_transf:       null,
        competencia,
        id_fatura:       idFatura,
      })
      if (error) throw error

      fecharSalvo()
    } catch (err) {
      erroEl.textContent = 'Erro ao salvar: ' + err.message
      erroEl.style.display = 'block'
      btn.disabled    = false
      btn.textContent = 'Salvar Lançamento'
    }
  }

  render()
}
