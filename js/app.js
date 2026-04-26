// ============================================================
// SFP — App principal
// Inicializa o Supabase, o router e a aba inicial
// ============================================================

import { initSupabase } from './config.js'
import { initRouter }   from './router.js'

// Carrega o SDK do Supabase via CDN
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')

import { SUPABASE_URL, SUPABASE_KEY } from './config.js'
const client = createClient(SUPABASE_URL, SUPABASE_KEY)
initSupabase(client)

// Inicializa o roteador de abas
initRouter()
