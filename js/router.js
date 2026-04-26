// ============================================================
// SFP — Router
// Gerencia a troca de abas e carrega o módulo correspondente
// ============================================================

const TABS = {
  'visao-geral':   () => import('./tabs/visao-geral.js'),
  'transacoes':    () => import('./tabs/transacoes.js'),
  'parcelamentos': () => import('./tabs/parcelamentos.js'),
  'assinaturas':   () => import('./tabs/assinaturas.js'),
  'categorias':    () => import('./tabs/categorias.js'),
  'cartoes':       () => import('./tabs/cartoes.js'),
}

// Cache dos módulos já carregados
const loaded = new Set()

export function initRouter() {
  const navTabs = document.getElementById('navTabs')

  navTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.nav-tab')
    if (!btn) return
    const tab = btn.dataset.tab
    navigateTo(tab)
  })

  // Carrega a aba inicial
  navigateTo('visao-geral')
}

export async function navigateTo(tabName) {
  // Atualiza botões
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName)
  })

  // Atualiza seções
  document.querySelectorAll('.tab-content').forEach(sec => {
    sec.classList.toggle('active', sec.id === `tab-${tabName}`)
  })

  // Carrega o módulo se ainda não foi carregado
  if (!loaded.has(tabName) && TABS[tabName]) {
    const section = document.getElementById(`tab-${tabName}`)
    section.innerHTML = `<div class="loading"><div class="spinner"></div> Carregando...</div>`

    try {
      const mod = await TABS[tabName]()
      await mod.render(section)
      loaded.add(tabName)
    } catch (err) {
      section.innerHTML = `<div class="loading">Erro ao carregar aba: ${err.message}</div>`
      console.error(err)
    }
  }
}
