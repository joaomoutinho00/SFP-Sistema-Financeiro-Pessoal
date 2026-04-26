// ============================================================
// SFP — Formatadores
// Funções utilitárias de formatação de dados
// ============================================================

// Formata valor em BRL
export function formatBRL(valor) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

// Formata data para exibição
export function formatData(dataStr) {
  if (!dataStr) return '—'
  const d = new Date(dataStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// Formata competência para exibição (ex: "2026-04-01" → "Abril de 2026")
export function formatCompetencia(dataStr) {
  if (!dataStr) return '—'
  const d = new Date(dataStr + 'T00:00:00')
  return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^\w/, c => c.toUpperCase())
}

// Retorna competência como string (primeiro dia do mês)
export function competenciaStr(ano, mes) {
  return `${ano}-${String(mes).padStart(2, '0')}-01`
}

// Navega meses
export function addMeses(dataStr, n) {
  const d = new Date(dataStr + 'T00:00:00')
  d.setMonth(d.getMonth() + n)
  return competenciaStr(d.getFullYear(), d.getMonth() + 1)
}

// Competência atual
export function competenciaAtual() {
  const hoje = new Date()
  return competenciaStr(hoje.getFullYear(), hoje.getMonth() + 1)
}

// Iniciais de uma string (para avatar)
export function iniciais(texto) {
  if (!texto) return '?'
  const palavras = texto.trim().split(/\s+/)
  if (palavras.length === 1) return palavras[0].substring(0, 2).toUpperCase()
  return (palavras[0][0] + palavras[1][0]).toUpperCase()
}

// Badge de banco
export function badgeBanco(nome) {
  const classes = {
    'SAFRA':  'badge-safra',
    'NUBANK': 'badge-nubank',
    'XP':     'badge-xp',
    'WISE':   'badge-wise',
  }
  const cls = classes[nome?.toUpperCase()] || 'badge-cat'
  return `<span class="badge ${cls}">${nome}</span>`
}

// Classe de cor do valor
export function classeValor(idTipo) {
  if (idTipo === 1) return 'valor-entrada'
  if (idTipo === 2) return 'valor-saida'
  return 'valor-transf'
}

// Sinal do valor (+/-)
export function sinaisValor(idTipo, valor) {
  const formatado = formatBRL(Math.abs(valor))
  if (idTipo === 1) return `+${formatado}`
  if (idTipo === 2) return `-${formatado}`
  return formatado
}
