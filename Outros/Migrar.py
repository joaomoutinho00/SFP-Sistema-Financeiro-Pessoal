"""
SFP — Script de migração v3 (final)
Lê a aba LANCAMENTOS-AJUSTADO e insere no Supabase.

Mapeamento de métodos:
  ENTRADA  + CONTA        → 1  (CONTA)
  SAÍDA    + PIX          → 2  (PIX)
  SAÍDA    + CRÉDITO      → 3  (CRÉDITO) ou 8 (REEMBOLSO CARTÃO) se cat = REEMBOLSO - CARTÃO
  CONTROLE + FATURA       → 4  (FATURA)
  TRANSF   + ENTRADA      → 5  (ENTRADA)
  TRANSF   + SAÍDA        → 6  (SAÍDA)
  INVEST   + APORTE       → 9  (APORTE)
  INVEST   + RETIRADA     → 10 (RETIRADA)
  INVEST   + RENDIMENTO   → 11 (RENDIMENTO)
"""

import openpyxl
from datetime import datetime, date, timedelta
import urllib.request
import urllib.error
import json

# ============================================================
# CONFIGURAÇÃO
# ============================================================
SUPABASE_URL = "https://sxrhpulnkbbaeavwxtky.supabase.co"
SUPABASE_KEY = "sb_publishable_z4CdnvNCblsYBbYq13Jo1Q_6MSqPzUk"
PLANILHA     = "Controle Financeiro 2026 - BASE.xlsm"
ABA          = "LANCAMENTOS-AJUSTADO"

# ============================================================
# MAPEAMENTOS
# ============================================================
def mapear_metodo(tipo, metodo, categoria):
    tipo      = str(tipo      or '').strip().upper()
    metodo    = str(metodo    or '').strip().upper()
    categoria = str(categoria or '').strip().upper()

    if tipo == 'ENTRADA':
        return 1  # CONTA

    elif tipo == 'SAÍDA':
        if metodo == 'PIX':                       return 2
        if metodo in ('CRÉDITO', 'CREDITO'):
            if categoria == 'REEMBOLSO - CARTÃO': return 8
            return 3
        if metodo == 'FATURA':                    return 4
        return 2  # fallback

    elif tipo == 'CONTROLE':
        if metodo == 'FATURA':                    return 4
        return 4  # fallback

    elif tipo in ('TRANSFERÊNCIA', 'TRANSF'):
        if metodo == 'ENTRADA':                   return 5
        if metodo == 'SAÍDA':                     return 6
        return 5  # fallback

    elif tipo == 'INVESTIMENTO':
        if metodo == 'APORTE':                    return 9
        if metodo == 'RETIRADA':                  return 10
        if metodo == 'RENDIMENTO':                return 11
        return 9  # fallback

    elif tipo == 'RENDIMENTO':
        return 11

    return 1  # fallback geral

CATEGORIAS = {
    'A RECEBER':           1,
    'ALIMENTAÇÃO FORA':    2,
    'ASSINATURAS':         3,
    'CASA':                4,
    'COMPRAS':             5,
    'CUIDADO PESSOAL':     6,
    'DATE':                7,
    'ESPORTES':            8,
    'EXTRA':               9,
    'IMPOSTOS':            10,
    'INVESTIMENTOS':       11,
    'METROPOLITANO':       12,
    'NOITE':               13,
    'OUTROS':              14,
    'POD':                 15,
    'PRESENTES/DOAÇÕES':   16,
    'REEMBOLSO':           17,
    'SALÁRIO':             18,
    'TRANSF':              20,
    'TRANSPORTE':          21,
    'VIAGENS':             22,
    'VÍDEO GAME':          23,
    'CONHECIMENTO':        24,
    'REEMBOLSO - CARTÃO':  25,
    'PAG. FATURA':         26,
    'AJUSTE':              27,  
}

SUBCATEGORIAS = {
    'A RECEBER':          1,
    'ALMOÇO DU':          2,
    'DELIVERY':           3,
    'AVULSOS/BESTEIRAS':  4,
    'RESTAURANTE':        5,
    'STREAMING':          6,
    'APPS':               7,
    'ANUIDADE CARTÃO':    8,
    'LUZ':                9,
    'INTERNET':           10,
    'CONDOMINIO':         11,
    'MERCADO':            12,
    'MANUTENÇÃO':         13,
    'COMPRAS CASA':       14,
    'IPTU':               15,
    'ROUPAS':             16,
    'CAMISAS DE TIME':    17,
    'BESTEIRAS':          18,
    'CORTE DE CABELO':    19,
    'SAUNA':              20,
    'FARMÁCIA':           21,
    'DATE':               22,
    'TENIS':              23,
    'FUTEBOL':            24,
    'ACADEMIA':           25,
    'OUTROS':             26,
    'PENSÃO':             27,
    'PRESENTE':           28,
    'BENEFICIOS':         29,
    'RENDIMENTOS C/C':    30,
    'IMPOSTOS':           31,
    'DIA DE JOGO':        33,
    'AUXILIO':            34,
    'SÓCIO TORCEDOR':     35,
    'METRO CHOPP':        36,
    'INGRESSO':           37,
    'BEBIDA':             38,
    'TRABALHO':           39,
    'QUINTETO':           40,
    'HATERS':             41,
    'EMBALOS':            42,
    'NÃO SEI':            43,
    'POD':                44,
    'PRESENTES':          45,
    'DOAÇÕES':            46,
    'REEMBOLSO':          47,
    'SALÁRIO CLT':        48,
    'SALÁRIO COOP':       49,
    'SALÁRIO DORTMUND':   50,
    'TRANSF - ENTRADA':   51,
    'GASOLINA':           53,
    'IPVA':               54,
    'SEGURO':             55,
    'ESTACIONAMENTO':     57,
    'UBER':               58,
    'PASSAGEM':           59,
    'HOSPEDAGEM':         60,
    'ALIMENTAÇÃO':        61,
    'INGRESSOS':          62,
    'COMPRAS':            63,
    'SEGURO VIAGEM':      64,
    'EAFC POINTS':        65,
    'JOGOS E ITENS':      66,
    'APORTE':             67,
    'AJUSTE':             68,
    'RETIRADA':           69,
    'RENDIMENTO':         70,
    'TRANSF':             71,
    'REEMBOLSO - CARTÃO': 72,
    'PAG. FATURA':        73,
    'CURSO':              74,
    'PALESTRA':           75,
    'MULTA':              76,
    'PEDAGIOS/TAXAS':     77,
    'LIVROS':             79,
    'LAVAÇÃO':            82,
}

CONTAS = {'SAFRA': 1, 'NUBANK': 2, 'XP': 3, 'WISE': 4}

# ============================================================
# HELPERS
# ============================================================
def excel_date(n):
    if not n: return None
    if isinstance(n, (datetime, date)):
        return n.date() if isinstance(n, datetime) else n
    try:    return (datetime(1899, 12, 30) + timedelta(days=int(n))).date()
    except: return None

def primeiro_dia_mes(d):
    if not d: return None
    return date(d.year, d.month, 1)

def supabase_upsert(endpoint, data, on_conflict):
    url     = f"{SUPABASE_URL}/rest/v1/{endpoint}"
    payload = json.dumps(data).encode('utf-8')
    req     = urllib.request.Request(
        url, data=payload,
        headers={
            'Content-Type':  'application/json',
            'apikey':        SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
            'Prefer':        'resolution=merge-duplicates,return=minimal',
            'on-conflict':   on_conflict,
        },
        method='POST'
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return True, resp.status
    except urllib.error.HTTPError as e:
        return False, e.read().decode()

# ============================================================
# LEITURA
# ============================================================
print(f'\n📂 Abrindo: {PLANILHA} — aba: {ABA}')
wb   = openpyxl.load_workbook(PLANILHA, read_only=True, data_only=True)
ws   = wb[ABA]
rows = [r for r in ws.iter_rows(min_row=3, values_only=True) if r[1]]
print(f'✅ {len(rows)} linhas encontradas\n')

# ============================================================
# MIGRAÇÃO
# ============================================================
ok = erros = 0
avisos = []

for r in rows:
    id_lanc    = str(r[1])
    data_raw   = r[2]
    tipo_raw   = r[3]
    metodo_raw = r[4]
    banco_raw  = r[5]
    descricao  = r[6]
    valor      = r[7]
    cat_raw    = r[8]
    subcat_raw = r[9]
    qtd_parc   = r[10]
    parc_atual = r[11]
    comp_raw   = r[12]
    id_transf  = r[13]
    id_parcela = r[14]

    banco_key = str(banco_raw or '').strip().upper()
    cat_key   = str(cat_raw   or '').strip().upper()

    data_d      = excel_date(data_raw)
    competencia = primeiro_dia_mes(excel_date(comp_raw))
    id_metodo   = mapear_metodo(tipo_raw, metodo_raw, cat_raw)
    id_conta    = CONTAS.get(banco_key)

    if not id_conta:
        avisos.append(f'  ⚠️  {id_lanc} — banco desconhecido: {banco_raw!r}')
        continue

    id_cat = CATEGORIAS.get(cat_key)
    if not id_cat:
        avisos.append(f'  ⚠️  {id_lanc} — categoria desconhecida: {cat_raw!r} → OUTROS')
        id_cat = 14

    id_subcat = SUBCATEGORIAS.get(str(subcat_raw or '').strip().upper())

    try:    valor_abs = abs(float(valor or 0))
    except: valor_abs = 0

    lancamento = {
        'id_lancamento':   id_lanc,
        'data':            data_d.isoformat()      if data_d      else None,
        'id_metodo':       id_metodo,
        'id_conta':        id_conta,
        'descricao':       str(descricao)          if descricao   else '',
        'valor':           valor_abs,
        'id_categoria':    id_cat,
        'id_subcategoria': id_subcat,
        'qtd_parcelas':    int(qtd_parc)           if qtd_parc    else None,
        'parcela_atual':   int(parc_atual)         if parc_atual  else None,
        'id_parcela':      str(id_parcela)         if id_parcela  else None,
        'id_transf':       str(id_transf)          if id_transf   else None,
        'competencia':     competencia.isoformat() if competencia else None,
        'id_fatura':       None,
    }

    success, result = supabase_upsert('lancamentos', lancamento, 'id_lancamento')
    if success:
        ok += 1
        print(f'  ✅ {id_lanc} — {str(descricao)[:40]}')
    else:
        erros += 1
        print(f'  ❌ {id_lanc} — {str(result)[:120]}')

wb.close()

print(f'\n{"="*50}')
print(f'✅ Inseridos: {ok}')
print(f'❌ Erros:     {erros}')
print(f'{"="*50}\n')

if avisos:
    print('⚠️  Avisos:')
    for a in avisos: print(a)

print('\nRode agora: python criar_faturas.py')