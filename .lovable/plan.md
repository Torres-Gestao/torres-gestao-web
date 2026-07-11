
# Plano — Pagamento Online Multi‑Loja (Mercado Pago + extensível)

## Visão geral

Cada dona de loja cadastra as próprias credenciais do Mercado Pago no painel on‑premise. Essas credenciais ficam salvas no Supabase, vinculadas ao `loja_id`. Quando o cliente final finaliza o pedido, o **backend on‑premise** cria uma preferência de pagamento no Mercado Pago **usando o token da loja daquele pedido** — assim o dinheiro cai direto na conta da lojista, sem passar por você.

O front (vitrine no GitHub Pages) só chama o seu on‑premise; nunca fala com o Mercado Pago direto e nunca vê o token da loja.

**Sobre a sua pergunta (Cielo, Stone, etc.):** sim, esse desenho já nasce preparado. A tabela de credenciais é polimórfica (`provider` + `credentials JSONB`) e o código do checkout usa um "adaptador" por provider. No futuro basta adicionar `provider = 'stone'` com um novo adaptador — sem quebrar o que já existe. Detalhes técnicos ao final.

## Fluxo do cliente final

```text
Vitrine (GitHub Pages)
   │  1. Cliente monta carrinho e clica "Finalizar Pedido"
   ▼
On-premise API  ──2. Salva pedido no Supabase (status_pgto='pendente')
   │            ──3. Lê credenciais da loja (Supabase)
   │            ──4. Cria "preferência" no Mercado Pago (métodos: PIX/cartão conforme loja)
   ▼
Retorna { init_point } → Vitrine redireciona cliente para o checkout do Mercado Pago
                        │
                        ▼
                Cliente paga (PIX ou cartão) na conta da lojista
                        │
                        ▼
      Mercado Pago → Webhook → On-premise → Supabase
                     (atualiza status_pgto: aprovado / recusado / estornado)
                        │
                        ▼
      Realtime → Tela de Acompanhamento do pedido atualiza sozinha
```

Para lojas que também aceitam "pagar na entrega", mantemos essa opção ao lado do pagamento online — o cliente escolhe qual usar no checkout.

## Fluxo da dona da loja (onboarding de pagamento)

No painel on‑premise, aba **"Pagamentos"** da loja:

1. Escolhe o provedor (V1: só Mercado Pago; futuramente Stone/Cielo aparecem no dropdown).
2. **Opção recomendada:** clica "Conectar Mercado Pago" → OAuth do MP → devolve `access_token` + `refresh_token` já vinculados à conta dela. Zero risco de a lojista colar token errado.
3. **Opção alternativa (mais rápida de implementar):** ela cola o `Access Token` de produção que pega no painel do MP dela.
4. Marca quais métodos aceita (PIX, crédito, débito) e se quer manter "pagar na entrega".

## Mudanças no Supabase

Novas tabelas / colunas (você roda o SQL no Editor):

- `loja_pagamento_config` — 1‑para‑1 com `lojas`: `provider`, `credentials JSONB` (criptografado no app), `metodos_aceitos[]`, `ativo`, `oauth_refresh_token`.
- `pedidos`: adicionar `status_pgto` (`pendente|aprovado|recusado|estornado|nao_aplicavel`), `metodo_pgto` (`pix|cartao|dinheiro|na_entrega`), `provider_payment_id`, `provider_preference_id`, `valor_total`.
- `pagamento_eventos` — log de tudo que chega no webhook (auditoria + debugging).
- RLS: `loja_pagamento_config` **nunca** exposto ao `anon` — só service role (usado pelo on‑premise).

## Mudanças no frontend (Vitrine)

- `Checkout.tsx`: novo passo "Como quer pagar?" com as opções que a loja habilitou. Se escolher online, POST para `POST {ONPREMISE_URL}/pedidos` e redirect para `init_point` retornado. Se escolher "na entrega", mantém o fluxo atual.
- `AcompanhamentoPedido.tsx`: mostrar bloco de status de pagamento (com timeline própria) e, se `status_pgto='pendente'` e for PIX, exibir botão "Ver QR Code" que reabre o `init_point`.
- Variável `VITE_ONPREMISE_API_URL` no `.env` e no GitHub Actions.

## Mudanças no on‑premise (você implementa)

Vou deixar documentado com contratos claros; **você implementa no seu backend on‑premise** (não escrevo código on‑premise aqui). São 4 endpoints:

1. `POST /api/pedidos` — cria pedido + preferência no MP, devolve `init_point`.
2. `POST /api/webhooks/mercadopago` — recebe notificação, valida assinatura, atualiza `status_pgto`.
3. `GET /api/lojas/:id/pagamento` e `PUT /api/lojas/:id/pagamento` — painel da lojista.
4. `GET /api/oauth/mercadopago/callback` — se optar por OAuth.

Entrego um `docs/on-premise-api-contract.md` com request/response de cada um, exemplos de payload do MP, como validar o webhook (`x-signature`), e um script `.sql` das migrações.

## Escopo da V1 (o que vou construir agora)

1. Migrações SQL (`supabase/migrations/002_pagamentos.sql`).
2. Ajustes no `Checkout.tsx` (seleção de método + chamada ao on‑premise + redirect).
3. Ajustes no `AcompanhamentoPedido.tsx` (bloco de status de pagamento + Realtime na coluna nova).
4. `src/lib/api.ts` — cliente HTTP tipado pra falar com o on‑premise.
5. `src/types/db.ts` — atualizar tipos.
6. `docs/on-premise-api-contract.md` — contrato dos 4 endpoints pro seu backend.
7. `docs/mercadopago-setup.md` — passo a passo pra lojista conectar a conta dela.

## Fora do escopo da V1 (fica pronto pra depois)

- Adaptadores Stone / Cielo / Pagar.me (arquitetura já suporta, só plugar).
- OAuth do Mercado Pago (V1 usa access token colado; OAuth em V1.5).
- Cobrança de fee do white label (só faz sentido no Modelo A / split).
- Reembolso automático pelo painel.

---

## Detalhes técnicos

### Arquitetura extensível de providers
```ts
// on-premise (referência)
interface PaymentProvider {
  createPreference(pedido, config): Promise<{ init_point, provider_id }>
  parseWebhook(req): Promise<{ provider_id, status }>
}
const providers = { mercadopago: new MPAdapter(), stone: new StoneAdapter(), ... }
```
No dia que quiser Stone, você só implementa `StoneAdapter` e adiciona `'stone'` no enum do banco. Zero mudança no front.

### Segurança das credenciais
- `loja_pagamento_config.credentials` guardado como JSONB, mas **criptografado no on‑premise** com uma chave mestre (env `PAYMENT_ENCRYPTION_KEY`). Supabase nunca vê o token em claro.
- RLS bloqueia leitura por `anon` e `authenticated` — só `service_role` (usado exclusivamente pelo seu on‑premise) lê.
- Webhook do MP validado via header `x-signature` + `x-request-id` (HMAC SHA256).

### Idempotência
Webhook do MP pode chegar múltiplas vezes. Toda escrita em `pedidos.status_pgto` checa `pagamento_eventos.provider_event_id` — se já processado, ignora.

### Por que não Lovable Cloud
Você já tem Supabase próprio e prefere manter. Perfeito — mantemos 100% no seu Supabase + seu on‑premise. Nenhuma edge function na Lovable Cloud é necessária.

---

Se aprovar, começo pelas migrações SQL + contrato da API on‑premise (pra você já ir codando o backend em paralelo), e depois plugo o front.
