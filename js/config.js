// ============================================================
// SFP — Configuração do Supabase
// ============================================================

export const SUPABASE_URL = "https://sxrhpulnkbbaeavwxtky.supabase.co"
export const SUPABASE_KEY = "sb_publishable_z4CdnvNCblsYBbYq13Jo1Q_6MSqPzUk"

// Cliente Supabase via CDN (carregado no app.js)
export let supabase = null

export function initSupabase(client) {
  supabase = client
}
