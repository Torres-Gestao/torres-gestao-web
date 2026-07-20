# Plano — Frete automático com Mapbox (v2)

## Arquitetura

Sem chamar o on-premise no fluxo do cliente. Config no Supabase; cálculo e mapa no browser.

- **Token público Mapbox** (`pk.*`) por loja, salvo no Supabase. Defesa = URL allowlist no dashboard Mapbox (token público é feito pra viver no browser).
- **Coordenadas da loja**: `lojas.latitude/longitude`.
- **Faixas de frete**: nova tabela `loja_frete_faixas` (km_min, km_max, valor).
- **Distância**: haversine no cliente. Mapbox usado para geocoding + mapa interativo.

```text
CEP/rua/número → ViaCEP preenche → Mapbox Geocoding → lat/lng
                                       │
                                       ├─ achou: pin no mapa (arrastável)
                                       └─ NÃO achou: abre mapa em modo manual
                                                     (cliente arrasta o pin)
                                       │
                                       ▼
                       Haversine(loja, cliente) = km
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
      km dentro de faixa         km > maior faixa         (geocoding falhou
      → mostra frete             → "fora de área"          e cliente não fixou pin)
        habilita botão             bloqueia botão          → botão fica em
                                                            "confirmar no mapa"
```

## 1) Banco (`supabase/migrations_004_frete.sql`)

- `ALTER TABLE public.lojas`
  - `endereco jsonb`, `latitude numeric(10,7)`, `longitude numeric(10,7)`
  - `mapbox_public_token text`
  - `frete_ativo boolean default false`
- `CREATE TABLE public.loja_frete_faixas` (id, loja_id, km_min, km_max, valor, ordem)
- GRANTs: `SELECT` p/ `anon` e `authenticated`; `ALL` p/ `service_role`. RLS: leitura pública, escrita só `service_role`.

## 2) Frontend

### a) Tipos (`src/types/db.ts`)
Adiciona campos novos em `Loja` + novo tipo `FreteFaixa` + entrada em `Database.Tables`.

### b) `src/lib/mapbox.ts` (novo)
- `geocodeEndereco(token, {cep,rua,numero,cidade,uf}) → {lat,lng} | null`
- `reverseGeocode(token, lat, lng) → endereço formatado` (usado quando cliente arrasta pin)
- `haversineKm(a, b)`

### c) `src/hooks/useFreteFaixas.ts` (novo)
Carrega faixas da loja + `calcularFrete(km)` retornando:
- `{ status: "ok", valor, km, faixa }`
- `{ status: "fora_area", km, maiorFaixa }` — só quando `km > maior km_max`

### d) `src/components/loja/MapaConfirmacao.tsx` (novo)
Componente com `mapbox-gl` (biblioteca já pública, usa `pk.*`):
- Recebe `{ lat, lng, token, onChange(lat,lng) }`.
- Renderiza mapa centralizado no ponto, com marcador **arrastável**.
- Ao arrastar/soltar → chama `onChange` com novas coords.
- Reverse-geocode opcional pra mostrar endereço formatado abaixo do mapa ("Confirme se este é o local exato da entrega").
- Botão "Usar este local".

### e) `src/pages/Checkout.tsx`

**Máquina de estados do frete** (state único `freteState`):

| Estado | Trigger | UI | Botão Finalizar |
|---|---|---|---|
| `idle` | modalidade = retirada, ou dados incompletos | — | habilitado (frete = 0) |
| `calculando` | após ViaCEP + número preenchido, ou pin movido | spinner + "Calculando frete…" | **desabilitado** — label "Calculando frete…" |
| `ok` | geocoding OK e km em faixa | mostra "Frete (X,X km) R$ Y,YY" + mapa colapsável com pin | habilitado |
| `fora_area` | km > maior faixa | aviso "A loja não entrega neste endereço (X km)" | **desabilitado** |
| `precisa_confirmar` | geocoding retornou null | abre `MapaConfirmacao` centrado no CEP (ou cidade) pedindo "Arraste o pin até seu endereço" | **desabilitado** — label "Confirme no mapa" |

**Regras chave:**
- Trigger de cálculo: debounce ~500ms após blur do número **OU** movimento do pin.
- Distinção clara entre **falha de geocoding** (fallback pro mapa manual, nunca bloqueia como fora de área) e **fora de área** (só quando `km > maior km_max`).
- Botão "Finalizar" nunca fica habilitado durante `calculando`, `fora_area` ou `precisa_confirmar` (evita envio com frete 0).
- Retirada = ignora tudo, frete 0, botão livre.
- Se `loja.frete_ativo === false` ou faltar token/lat/lng da loja → modo legado (frete 0, sem mapa, sem bloqueio).

**Payload do pedido:**
- `taxa_entrega = valor da faixa` (0 em retirada).
- `total_general = subtotal + taxa_entrega` — **calculado no front, autoritativo**.
- Salva `latitude`/`longitude` do cliente no `endereco` (jsonb) para futuras entregas.

## 3) Alinhamento com on-premise / Asaas — evitar cobrança dupla

Hoje o `createPreference` do Asaas usa `total_general` (ou, se ausente, `sum(itens) + taxa_entrega`). Como o front agora **sempre** grava `total_general` já incluindo o frete:

- **Regra clara**: on-premise deve usar `total_general` como valor final **sem somar `taxa_entrega` de novo**.
- `taxa_entrega` no pedido é **informativo** (aparece na nota/comprovante), não parcela adicional.
- Documentar em `docs/api-onpremise-pagamentos.md` seção **"Cálculo do valor da cobrança"**: pseudocódigo mostrando `valor = pedido.total_general` — nunca `total_general + taxa_entrega`.
- Adicionar checklist de migração pra você conferir o poller Asaas antes de ligar o frete em produção.

## 4) Acompanhamento

`AcompanhamentoPedido.tsx`: mostrar linha "Frete: R$ Y,YY" no resumo (se `taxa_entrega > 0`), pra ficar transparente pro cliente.

## Dependências novas
- `mapbox-gl` + `@types/mapbox-gl` (para o mapa com pin arrastável).

## Detalhes técnicos

- **Custo Mapbox**: Geocoding + Maps loads têm 50k–100k/mês grátis. Cada checkout gasta ~1 geocode + ~1 map load. Confortável.
- **Token por loja**: cada loja paga o próprio consumo. Se quiser token único da plataforma depois, vira só fallback via `import.meta.env`.
- **Segurança do `pk.*`**: público por design — não vai em `add_secret`, vai na tabela; proteção real é a allowlist de domínios no Mapbox.
- **Sem Lovable Cloud / sem edge function**.
- **Compatibilidade**: pedidos existentes seguem funcionando; `taxa_entrega` já existe no schema.

## Fora do escopo
- Tela admin no front pra editar faixas/token (on-premise cuida).
- Autocomplete "digite e sugere" (podemos adicionar depois; ViaCEP + geocode + mapa já cobrem o essencial).
- Cálculo por rota real (mantido haversine conforme sua decisão anterior).

## Arquivos que serão editados/criados
- `supabase/migrations_004_frete.sql` (novo)
- `src/types/db.ts`
- `src/lib/mapbox.ts` (novo)
- `src/hooks/useFreteFaixas.ts` (novo)
- `src/components/loja/MapaConfirmacao.tsx` (novo)
- `src/pages/Checkout.tsx`
- `src/pages/AcompanhamentoPedido.tsx`
- `docs/api-onpremise-pagamentos.md` (seção nova sobre `total_general`)
- `package.json` (dep `mapbox-gl`)
