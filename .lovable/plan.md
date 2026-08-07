# Rastreamento de origem (UTM + referrer) no checkout

Capturar de onde o cliente veio (campanha paga ou tráfego orgânico) e gravar isso junto com o pedido.

## Como funciona

```text
Cliente acessa /pizzaria?utm_source=instagram&utm_medium=stories
        │
        ▼
useTracking() no boot  ──►  sessionStorage["torres_gestao_tracking"]
        │                    { utm_source, utm_medium, utm_campaign,
        │                      utm_term, utm_content, referrer,
        │                      landing_page, captured_at }
        ▼
Checkout lê a sessão  ──►  pedidos.origem (jsonb)
```

- Grava **na primeira** visita da sessão e não sobrescreve depois (a primeira origem é a que vale). Exceção: se chegar uma nova visita **com UTM** e a sessão só tiver referrer, atualiza — campanha paga tem prioridade sobre orgânico.
- `sessionStorage` = o rastreio morre quando o cliente fecha a aba, como pedido.
- Acesso direto (sem UTM e sem referrer) grava `origem: null` no pedido.

## Banco — migration 007

`supabase/migrations_007_origem_pedido.sql`:

```sql
alter table public.pedidos
  add column if not exists origem jsonb;
```

Sem RLS nova: `pedidos` já permite INSERT pelo anônimo e o SELECT continua só via `get_pedido()`.

## Arquivos

**`src/hooks/useTracking.ts`** (novo)
- `TrackingData` — tipo com as 5 UTMs + `referrer` + `landing_page` + `captured_at`.
- `useTracking()` — `useEffect` no boot: lê `URLSearchParams` da URL atual, lê `document.referrer` (ignorando referrer do próprio host, que é navegação interna) e persiste segundo a regra acima.
- `getTracking(): TrackingData | null` — leitura pura, exportada pra ser usada fora de componente (no checkout).

**`src/App.tsx`**
- Invoca `useTracking()` no topo, dentro do `CarrinhoProvider`, antes das `Routes`. Roda em qualquer rota — marketplace ou loja.

**`src/pages/Checkout.tsx`**
- Antes do `insert` em `pedidos`, chama `getTracking()`.
- Adiciona `origem` ao `payload`. `null` quando não há UTM nem referrer externo.

**`src/types/db.ts`**
- `origem: TrackingData | null` na interface `Pedido`.

## Detalhes técnicos

- Só as chaves com valor são gravadas — nada de `utm_source: null` poluindo o JSON.
- Valores truncados em 255 chars para evitar payload inflado por URL maliciosa.
- Referrer do mesmo hostname é descartado (é navegação interna, não origem).
- `landing_page` guarda o caminho de entrada (`/pizzaria-do-joao`), útil pra saber qual link da campanha converteu.
- Nada de pixel de terceiro (Meta/Google Ads) nesta etapa — só coleta first-party no nosso banco.

## Fora de escopo

- Dashboard/relatório de origem no PDV (o dado fica disponível em `pedidos.origem` pra você consultar).
- Integração com Meta Pixel / Google Analytics.
- Atribuição cross-device ou persistência além da sessão (`localStorage`/cookie).
