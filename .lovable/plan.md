
# Home Marketplace — v1 (sem login)

Escopo enxuto: só a home vira marketplace. Login/perfil fica pra depois.

Confirmado: `lojas.horarios_funcionamento jsonb` já existe (preenchido pelo PDV on-premise). Vamos usar.

## Comportamento

```text
┌─────────────────────────────────────────┐
│  Cardápio Digital                       │
│                                         │
│  🔍 [ buscar loja por nome... ]         │
│  📍 Usar minha localização              │
│                                         │
│  Lojas perto de você                    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │logo│ │logo│ │logo│ │logo│            │
│  │Nome│ │Nome│ │Nome│ │Nome│            │
│  │1.2k│ │Fech│ │2.8k│ │0.6k│            │
│  └────┘ └────┘ └────┘ └────┘            │
│                                         │
│  ▸ Somente retirada  (colapsável)       │
└─────────────────────────────────────────┘
```

- Grid de cards: logo + nome + badge "Aberto/Fechado" + distância (se geo ativa).
- **Busca fuzzy** por nome: normaliza input e nome (`NFD` + remove diacríticos + tira não-alfanumérico + lowercase). "pizzaria do joão" casa com slug `pizzaria-do-joao` sem exigir traços.
- Enter com 1 match exato → navega direto pra `/{slug}`.
- **Geolocation opt-in**: botão pede `navigator.geolocation.getCurrentPosition`. Aceito → salva `{lat,lng}` em `localStorage["cliente_geo"]` e reusa nas próximas visitas.
- **Filtro por raio**: pra cada loja com `frete_ativo` + coords, calcula haversine e mantém onde `distancia_km ≤ raio_max_km` (maior `km_max` das faixas). Loja sem `frete_ativo` ou sem coords cai em "Somente retirada".
- **Sem geolocation**: mostra todas as ativas com aviso "ative a localização pra ver quem entrega no seu endereço".
- Clique no card → `navigate("/" + slug)`.

## Os dois cuidados

### 1. Mesma função de distância que o checkout ✅
Reusar `haversineKm` de `src/lib/mapbox.ts`. Zero duplicação.

### 2. Status aberto/fechado usando `horarios_funcionamento` ✅
Criar `src/lib/loja-status.ts` com `isLojaAberta(loja): boolean`:

- Lê `loja.horarios_funcionamento` (formato do PDV: `{ "dom":{"abre":"10:00","fecha":"21:45"}, "seg":{...}, ..., "tz"?: "America/Sao_Paulo" }`).
- Descobre o dia da semana **no timezone** correto (default `America/Sao_Paulo` se `tz` ausente) e checa se `now.HH:mm` está entre `abre` e `fecha`. Suporta janela que atravessa meia-noite (ex.: `fecha < abre`).
- Suporta múltiplas janelas por dia (array `[{abre,fecha}, ...]`) além do formato objeto único — pra não quebrar quando o PDV evoluir.
- **Fallback**: se `horarios_funcionamento` for `null`/vazio ou dia sem entrada → cai em `loja.loja_aberta`.
- Substituir os usos hoje diretos de `loja.loja_aberta` por `isLojaAberta(loja)` em: `LojaHeader.tsx`, `Carrinho.tsx`, e nos cards da home.

## Banco (migration 005)

View pública pra home fazer 1 request só (sem expor tokens/credenciais):

```sql
create or replace view public.lojas_publicas as
select
  l.id, l.slug, l.nome, l.logo_url, l.cor_primaria, l.cor_secundaria,
  l.loja_aberta, l.horarios_funcionamento,
  l.latitude, l.longitude, l.frete_ativo,
  coalesce(max(f.km_max), 0) as raio_max_km
from public.lojas l
left join public.loja_frete_faixas f on f.loja_id = l.id
group by l.id;

grant select on public.lojas_publicas to anon, authenticated;
```

Nada de `mapbox_public_token` nem `endereco` da loja na view — home não precisa.

## Arquivos

- `supabase/migrations_005_home_marketplace.sql` — view `lojas_publicas` + grant.
- `src/types/db.ts` — adicionar `HorariosFuncionamento` e `LojaPublica`.
- `src/lib/normalize.ts` — `normalizarBusca(s)`.
- `src/lib/geo.ts` — `useGeoloc()` (localStorage + estados idle/loading/ok/denied).
- `src/lib/loja-status.ts` — `isLojaAberta(loja)` com fallback.
- `src/hooks/useLojasPublicas.ts` — React Query da view.
- `src/components/marketplace/LojaCard.tsx`
- `src/components/marketplace/BuscaLojas.tsx`
- `src/pages/Home.tsx` — reescrita (grid + busca + geo + seção "somente retirada"). Mantém a identidade roxa/amarela num header slim; o resto é fundo neutro pra dar destaque aos cards.
- `src/components/loja/LojaHeader.tsx` — trocar `loja.loja_aberta` por `isLojaAberta(loja)`.
- `src/pages/Carrinho.tsx` — mesma troca no botão "loja fechada".

## Fora de escopo (fica pra depois)
- Login/cadastro do cliente.
- Perfil global (endereço reutilizado entre lojas).
- Histórico de pedidos.
- Destaques / ordenação por popularidade.
