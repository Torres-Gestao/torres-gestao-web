-- ============================================================================
-- Migration 002 — Pagamentos integrados (Mercado Pago v1, extensível a outros)
-- Rodar no SQL Editor do Supabase. Idempotente onde possível.
-- ============================================================================

-- 1) ENUMs -------------------------------------------------------------------
do $$ begin
  create type public.payment_provider as enum
    ('mercadopago','stone','cielo','pagarme','asaas');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.metodo_pagamento as enum
    ('pix','cartao_credito','cartao_debito','dinheiro','na_entrega');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_pagamento as enum
    ('nao_aplicavel','pendente','em_processo','aprovado','recusado','estornado','cancelado');
exception when duplicate_object then null; end $$;

-- 2) Config de pagamento POR LOJA -------------------------------------------
-- Guarda credenciais criptografadas pelo backend on-premise. NUNCA exposto ao front.
create table if not exists public.loja_pagamento_config (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  provider public.payment_provider not null default 'mercadopago',
  -- credenciais: o on-premise grava JSON criptografado (ex: {access_token_enc, public_key})
  credenciais jsonb,
  -- flags públicas (o que aparece no checkout)
  metodos_aceitos public.metodo_pagamento[] not null default '{}'::public.metodo_pagamento[],
  aceita_na_entrega boolean not null default true,
  ativo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (loja_id, provider)
);

grant select, insert, update, delete on public.loja_pagamento_config to authenticated;
grant all on public.loja_pagamento_config to service_role;

alter table public.loja_pagamento_config enable row level security;

drop policy if exists "pag_cfg service full" on public.loja_pagamento_config;
create policy "pag_cfg service full" on public.loja_pagamento_config
  for all to service_role using (true) with check (true);

-- (Não criamos policy para anon: credenciais NUNCA saem do server.)

-- 3) View pública SEM credenciais -------------------------------------------
-- É essa view que o storefront lê para saber quais métodos oferecer.
create or replace view public.loja_pagamento_publico as
  select loja_id, provider, metodos_aceitos, aceita_na_entrega, ativo
  from public.loja_pagamento_config
  where ativo = true;

grant select on public.loja_pagamento_publico to anon, authenticated;

-- 4) Colunas de pagamento na tabela pedidos ---------------------------------
alter table public.pedidos
  add column if not exists metodo_pgto public.metodo_pagamento,
  add column if not exists status_pgto public.status_pagamento not null default 'nao_aplicavel',
  add column if not exists provider public.payment_provider,
  add column if not exists provider_preference_id text,
  add column if not exists provider_payment_id text,
  add column if not exists valor_pago numeric(10,2),
  add column if not exists pago_em timestamptz;

create index if not exists idx_pedidos_provider_pref
  on public.pedidos (provider_preference_id);
create index if not exists idx_pedidos_provider_pay
  on public.pedidos (provider_payment_id);

-- 5) Auditoria de eventos do gateway ----------------------------------------
create table if not exists public.pagamento_eventos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references public.pedidos(id) on delete cascade,
  provider public.payment_provider not null,
  event_type text not null,            -- ex: 'payment.updated'
  provider_payment_id text,
  status_pagamento public.status_pagamento,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

grant select on public.pagamento_eventos to authenticated;
grant all on public.pagamento_eventos to service_role;

alter table public.pagamento_eventos enable row level security;
drop policy if exists "pag_evt service full" on public.pagamento_eventos;
create policy "pag_evt service full" on public.pagamento_eventos
  for all to service_role using (true) with check (true);
