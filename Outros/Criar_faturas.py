"""
SFP — Script de criação de faturas
Lê os lançamentos de crédito, cria as faturas e vincula os lançamentos.
"""

import urllib.request
import urllib.error
import json

# ============================================================
# CONFIGURAÇÃO
# ============================================================
SUPABASE_URL = "https://sxrhpulnkbbaeavwxtky.supabase.co"
SUPABASE_KEY = "sb_publishable_z4CdnvNCblsYBbYq13Jo1Q_6MSqPzUk"

ID_METODO_CREDITO = 3  # CRÉDITO

# ============================================================
# HELPERS
# ============================================================
def supabase_get(endpoint, params=""):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{params}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Accept": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def supabase_post(endpoint, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=representation"
        },
        method="POST"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"  ❌ ERRO POST: {e.read().decode()}")
        return None

def supabase_patch(endpoint, filtro, data):
    url = f"{SUPABASE_URL}/rest/v1/{endpoint}?{filtro}"
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
            "Prefer": "return=minimal"
        },
        method="PATCH"
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return True
    except urllib.error.HTTPError as e:
        print(f"  ❌ ERRO PATCH: {e.read().decode()}")
        return False

# ============================================================
# BUSCA LANÇAMENTOS DE CRÉDITO
# ============================================================
print("\n🔍 Buscando lançamentos de crédito...")
lancamentos = supabase_get(
    "lancamentos",
    f"id_metodo=eq.{ID_METODO_CREDITO}&select=id_lancamento,id_conta,competencia&limit=1000"
)
print(f"✅ {len(lancamentos)} lançamentos de crédito encontrados\n")

# ============================================================
# AGRUPA POR CONTA + COMPETÊNCIA
# ============================================================
grupos = {}
for l in lancamentos:
    chave = (l["id_conta"], l["competencia"])
    if chave not in grupos:
        grupos[chave] = []
    grupos[chave].append(l["id_lancamento"])

print(f"📋 {len(grupos)} faturas a criar:\n")
for (id_conta, comp), ids in sorted(grupos.items()):
    print(f"  Conta {id_conta} — {comp[:7]} — {len(ids)} lançamentos")

# ============================================================
# CRIA FATURAS E VINCULA LANÇAMENTOS
# ============================================================
print("\n⚙️  Criando faturas e vinculando lançamentos...\n")

faturas_criadas = 0
lancamentos_vinculados = 0

for (id_conta, competencia), ids_lancamentos in sorted(grupos.items()):

    # Verifica se fatura já existe
    existente = supabase_get(
        "faturas",
        f"id_conta=eq.{id_conta}&competencia=eq.{competencia}"
    )

    if existente:
        fatura_id = existente[0]["id"]
        print(f"  ⏭️  Fatura já existe — conta {id_conta} {competencia[:7]} (id: {fatura_id})")
    else:
        # Cria fatura
        nova = supabase_post("faturas", {
            "id_conta":    id_conta,
            "competencia": competencia,
            "status":      "ABERTA"
        })
        if not nova:
            print(f"  ❌ Falha ao criar fatura — conta {id_conta} {competencia[:7]}")
            continue
        fatura_id = nova[0]["id"]
        faturas_criadas += 1
        print(f"  ✅ Fatura criada — conta {id_conta} {competencia[:7]} (id: {fatura_id})")

    # Vincula lançamentos à fatura
    for id_lanc in ids_lancamentos:
        ok = supabase_patch(
            "lancamentos",
            f"id_lancamento=eq.{id_lanc}",
            {"id_fatura": fatura_id}
        )
        if ok:
            lancamentos_vinculados += 1

# ============================================================
# RESUMO
# ============================================================
print(f"\n{'='*50}")
print(f"✅ Faturas criadas:            {faturas_criadas}")
print(f"✅ Lançamentos vinculados:     {lancamentos_vinculados}")
print(f"{'='*50}\n")
print("Concluído!")