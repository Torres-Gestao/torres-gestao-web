## Objetivo

1. Coletar **CPF e email** do cliente no checkout (obrigatórios apenas quando o pagamento for online — Asaas exige).
2. Corrigir o fluxo: quando o método for **online**, o cliente **paga antes** de ir para a tela de acompanhamento.

---

## 1) Banco (SQL — rodar no Supabase)

```sql
alter table public.clientes
  add column if not exists email text,
  add column if not exists cpf  text;

alter table public.pedidos
  add column if not exists cliente_email text,
  add column if not exists cliente_cpf   text;
```

Arquivo: `supabase/migrations_003_cliente_pagador.sql`. Sem mudança de RLS.

---

## 2) Frontend — Checkout: novos campos

Em `src/pages/Checkout.tsx`, na seção "Seus dados":

- Novo campo **Email** (input `type="email"`).
- Novo campo **CPF** com máscara `000.000.000-00`.

**Regra:** só obrigatórios quando `metodo ∈ {pix, cartao_credito, cartao_debito}`. Para `na_entrega`/`dinheiro`: opcionais (se preenchidos, salvamos mesmo assim).

**Validação** (novo arquivo `src/lib/validators.ts`):
- `formatCpf(v)` — máscara.
- `isValidCpf(v)` — 11 dígitos + dígito verificador.
- `isValidEmail(v)` — regex simples.

**Persistência:**
- `upsertCliente` grava `email` e `cpf` (atualiza sempre que vier preenchido).
- Payload do `insert` em `pedidos` inclui `cliente_email` e `cliente_cpf`.

---

## 3) Frontend — Novo fluxo: pagar ANTES de acompanhar

Fluxo atual (confuso): insere pedido → vai pra `/pedido/:id` → botão "Pagar agora" aparece só depois do poller.

Fluxo novo para método **online**:

```text
[Checkout — clique em "Ir para o pagamento"]
        │
        ▼
[Insert do pedido no Supabase (status_pgto=pendente)]
        │
        ▼
[Tela "Aguardando pagamento" — overlay dentro do próprio Checkout]
   • Spinner + "Estamos gerando seu pagamento seguro..."
   • Polling a cada 2s em pedidos(id) buscando init_point
        │
        ├─ init_point chegou (≤ 60s):
        │     window.location.href = init_point  → Asaas cuida do resto
        │
        └─ timeout 60s sem init_point:
              Mensagem de erro + 2 botões:
                • "Tentar de novo"  → re-inicia o polling
                • "Ver meu pedido"  → navega para /pedido/:id (fallback)
```

Após pagar no Asaas, o `return_url` (`#/:slug/pedido/:id`) traz o cliente para a tela de acompanhamento — já com o pagamento processado ou "em_processo" até o webhook.

Para **`na_entrega`/`dinheiro`**: comportamento atual preservado — vai direto para `/pedido/:id`.

**Mudanças concretas em `Checkout.tsx`:**
- Estados novos: `aguardandoPagamento`, `tentativaPolling`.
- Após `insert` OK com método online: **não navega**; entra em modo de espera e faz `supabase.from("pedidos").select("init_point,status_pgto").eq("id", id)` a cada 2s.
- Ao encontrar `init_point`: `window.location.href = init_point`.
- Timeout 60s: mostra fallback com "Tentar de novo" / "Ver meu pedido".
- Overlay renderizado no próprio componente (não é rota nova).

---

## 4) Frontend — Acompanhamento (ajuste pequeno)

`src/pages/AcompanhamentoPedido.tsx`: como o pagamento agora acontece antes, o botão "Pagar agora" vira **fallback** para quem fechou a aba do Asaas. Só ajuste de copy:

- Quando `status_pgto=pendente` e `init_point` existir → título "Você não concluiu o pagamento" + botão "Retomar pagamento".

Sem toast/confete extra na chegada (o Asaas já mostra a mensagem de sucesso).

---

## 5) Contrato on-premise

Sem mudança de API. Só documentar em `docs/api-onpremise-pagamentos.md` que o poller Asaas deve consumir os novos campos:

- `pedidos.cliente_email` → `customer.email`
- `pedidos.cliente_cpf`   → `customer.cpfCnpj`
- `pedidos.cliente_nome`  → `customer.name`
- `pedidos.cliente_telefone` → `customer.mobilePhone`

---

## Arquivos que serão editados/criados

- `supabase/migrations_003_cliente_pagador.sql` (novo)
- `src/lib/validators.ts` (novo)
- `src/types/db.ts` — adiciona `email`, `cpf` em `Cliente`; `cliente_email`, `cliente_cpf` em `Pedido`
- `src/pages/Checkout.tsx` — campos novos + overlay "aguardando pagamento" + polling
- `src/pages/AcompanhamentoPedido.tsx` — copy do fallback
- `docs/api-onpremise-pagamentos.md` — seção "Campos consumidos pelo poller Asaas"