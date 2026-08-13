# Meta Pixel por loja (opção B) + eventos de e-commerce

Cada lojista tem o próprio Pixel. O código carrega dinamicamente só quando o cliente entra naquela loja — nada fica fixo no `index.html`.

## Banco — migration 010

```sql
alter table public.lojas
  add column if not exists meta_pixel_id text;
```

- `lojas_publicas` (view usada no marketplace/loja) é recriada incluindo `meta_pixel_id`, mantendo o `grant select ... to anon`.
- `resolve_tenant` também passa a devolver a coluna, para funcionar em domínio próprio.
- Sem RLS nova: o Pixel ID é público por natureza (aparece no HTML de qualquer site).

## Fluxo

```text
Cliente entra em /pizzaria (ou dominio-proprio.com)
        │
        ▼
LojaShell carrega a loja  ──►  initMetaPixel(loja.meta_pixel_id)
        │                       injeta fbevents.js 1x + fbq('init', id)
        ▼
PageView → ViewContent → AddToCart → InitiateCheckout → Purchase
```

Loja sem `meta_pixel_id`: nada é injetado, zero requisição ao Facebook.

## Eventos rastreados

| Evento | Onde dispara | Dados |
|---|---|---|
| `PageView` | entrada na loja e em cada troca de rota | — |
| `ViewContent` | abrir o modal de um produto | id, nome, valor, BRL |
| `AddToCart` | adicionar ao carrinho | id, nome, quantidade, valor |
| `InitiateCheckout` | abrir a tela de checkout com carrinho | num_items, valor total |
| `Purchase` | pedido gravado com sucesso | `total_general`, id do pedido, itens |

`Purchase` usa o total final (produtos + frete − desconto), o mesmo valor cobrado — para o Meta otimizar por receita real. Dispara uma única vez por pedido (guarda o id do pedido em `sessionStorage`), inclusive quando o cliente volta para a tela de acompanhamento ou retorna do gateway de pagamento.

## Arquivos

**`src/lib/meta-pixel.ts`** (novo)
- `initMetaPixel(pixelId)` — injeta o snippet oficial uma vez, inicializa e manda o primeiro `PageView`. Ignora chamadas repetidas e troca de loja já inicializada.
- `track(evento, params)` — wrapper seguro: se o Pixel não estiver ativo, não faz nada; tudo em `try/catch`.
- `trackPurchaseOnce(pedidoId, params)` — deduplicação por pedido.
- Tipagem de `window.fbq` sem `any` solto.

**`src/components/loja/LojaShell.tsx`**
- `useEffect` chamando `initMetaPixel(loja.meta_pixel_id)` quando a loja resolve.
- `PageView` a cada mudança de rota dentro da loja.

**`src/components/loja/ProdutoModal.tsx`** — `ViewContent` ao abrir; `AddToCart` ao adicionar.

**`src/pages/Checkout.tsx`** — `InitiateCheckout` ao montar com carrinho; `Purchase` após o insert do pedido (antes do redirect ao gateway, para não perder o evento quando o cliente sai do site).

**`src/types/db.ts`** — `meta_pixel_id: string | null` em `Loja`.

## Detalhes técnicos

- Nenhum evento bloqueia ou atrasa o pedido: tudo isolado em `try/catch`, falha em silêncio.
- Bloqueadores de anúncio derrubam o `fbevents.js` sem quebrar a página (o `fbq` fica em fila e é descartado).
- Sem `<noscript><img>` no `<head>` (inválido em HTML5) — o fallback de imagem não é usado, já que a injeção é 100% dinâmica por loja.
- O rastreamento UTM/referrer já existente (`useTracking`) continua funcionando em paralelo, gravando `pedidos.origem`.

## Fora de escopo

- Conversions API (rastreamento server-side) — exigiria token por loja no backend.
- Google Analytics / TikTok Pixel.
- Campo de edição do Pixel ID no PDV (a coluna é preenchida direto no banco/PDV on-premise por enquanto).
