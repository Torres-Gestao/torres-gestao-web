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
- Referrer do mesmo hostname é descartado (é navegação interna, não origem).
- `landing_page` guarda o caminho de entrada (`/pizzaria-do-joao`), útil pra saber qual link da campanha converteu.
- Nada de pixel de terceiro (Meta/Google Ads) nesta etapa — só coleta first-party no nosso banco.

### Truncamento: por valor, nunca no JSON montado

O alerta procede. O corte é aplicado **em cada string individual, antes** de montar o objeto:

```ts
const safe = (v: string | null) =>
  v ? v.slice(0, 255) : undefined;   // nunca corta o JSON serializado
```

Cortar o JSON já serializado produziria `{"utm_source":"instagr` — JSON inválido, `INSERT` recusado pela coluna `jsonb`, venda perdida. Isso não vai acontecer: o objeto é montado com valores já curtos e enviado como objeto JS (o supabase-js serializa), sem nenhuma manipulação de string no JSON final.

### O pedido nunca cai por causa do tracking

Três camadas de proteção, porque a venda vale mais que o dado de marketing:

1. `useTracking` inteiro dentro de `try/catch` — `sessionStorage` bloqueado (modo privado, iframe, cota cheia) não quebra o boot.
2. `getTracking()` dentro de `try/catch` com `JSON.parse` protegido — sessão corrompida devolve `null`, não lança.
3. No `Checkout`, o `origem` é montado num `try/catch` isolado: qualquer erro na coleta → `origem = null` e o pedido segue normal. O tracking jamais entra no caminho crítico do `insert`.

Além disso: só as 5 chaves UTM conhecidas + `referrer` + `landing_page` + `captured_at` são gravadas (allowlist). Parâmetros arbitrários da URL são ignorados, então não há como inflar o payload nem injetar estrutura inesperada.


## Fora de escopo

- Dashboard/relatório de origem no PDV (o dado fica disponível em `pedidos.origem` pra você consultar).
- Integração com Meta Pixel / Google Analytics.
- Atribuição cross-device ou persistência além da sessão (`localStorage`/cookie).
