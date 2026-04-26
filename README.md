# SFP — Sistema Financeiro Pessoal

Aplicação web para controle financeiro pessoal, com dados armazenados no Supabase.

## Funcionalidades

- **Visão Geral** — resumo mensal de receitas, despesas, faturas e investimentos
- **Transações** — lançamentos com filtros por competência, banco, tipo e categoria
- **Parcelamentos** — controle de compras parceladas
- **Assinaturas** — gestão de assinaturas recorrentes
- **Categorias** — organização por categoria e subcategoria
- **Cartões** — acompanhamento de faturas por cartão

## Tecnologias

- HTML5 / CSS3 / JavaScript (ES Modules)
- [Supabase](https://supabase.com) — banco de dados e autenticação
- [Chart.js](https://www.chartjs.org) — gráficos
- [Google Fonts — Sora](https://fonts.google.com/specimen/Sora) — tipografia

## Configuração

Edite `js/config.js` com suas credenciais do Supabase:

```js
export const SUPABASE_URL = "https://<seu-projeto>.supabase.co"
export const SUPABASE_KEY = "<sua-chave-publica>"
```

## Execução local

Por usar ES Modules, o app precisa ser servido via servidor HTTP local:

```bash
npx serve .
# ou
python -m http.server 8080
```
