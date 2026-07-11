-- ============================================================
-- 002 — Pagamento online multi-loja (Mercado Pago + extensível)
-- Rode este arquivo no SQL Editor do Supabase.
-- (Supabase é externo — não usamos a ferramenta de migration da Lovable)
-- ============================================================

-- ------------------------------------------------------------
-- 1) Enums
-- ------------------------------------------------------------
do $$ begin
  create type public.payment_provider as enum ('mercadopago', 'stone', 'cielo', 'pagarme', 'asaas');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.status_pagamento as enum (
    'nao_aplicavel',
    'pendente',
    'em_processo',
    'aprovado',
    'recusado',
    'estornado',
    'cancelado'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.metodo_pagamento as enum ('pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'na_entrega');
exception when duplicate_object then null; end $$;

-- ------------------------------------------------------------
-- 2) loja_pagamento_config — credenciais + preferências da lojista
-- ------------------------------------------------------------
create table if not exists public.loja_pagamento_config (
  id                   uuid primary key default gen_random_uuid(),
  loja_id              uuid not null references public.lojas(id) on delete cascade,
  provider             payment_provider not null default 'mercadopago',
  -- credenciais criptografadas pelo on-premise antes de gravar.
  -- ex.: { "access_token_enc": "...", "public_key": "APP_USR-...", "user_id": "123456" }
  credentials          jsonb not null default '{}'::jsonb,
  oauth_refresh_token  text,
  metodos_aceitos      metodo_pagamento[] not null default array['pix']::metodo_pagamento[],
  aceita_na_entrega    boolean not null default true,
  ativo                boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (loja_id)
);

grant all on public.loja_pagamento_config to service_role;
alter table public.loja_pagamento_config enable row level security;
-- Sem policies para anon/authenticated => acesso zero pelo frontend.

-- View pública com metadados NÃO-sensíveis, para o front decidir quais
-- opções mostrar sem expor credenciais.
create or replace view public.loja_pagamento_publico as
select
  loja_id,
  provider,
  metodos_aceitos,
  aceita_na_entrega,
  ativo
from public.loja_pagamento_config
where ativo = true;

grant select on public.loja_pagamento_publico to anon, authenticated;

-- ------------------------------------------------------------
-- 3) Novas colunas em pedidos
-- ------------------------------------------------------------
alter table public.pedidos
  add column if not exists status_pgto            status_pagamento not null default 'nao_aplicavel',
  add column if not exists metodo_pgto            metodo_pagamento,
  add column if not exists provider_preference_id text,
  add column if not exists provider_payment_id    text,
  add column if not exists valor_pago             numeric(10,2),
  add column if not exists pago_em                timestamptz;

create index if not exists idx_pedidos_status_pgto        on public.pedidos(status_pgto);
create index if not exists idx_pedidos_provider_payment   on public.pedidos(provider_payment_id);

-- ------------------------------------------------------------
-- 4) pagamento_eventos — log de webhooks (auditoria + idempotência)
-- ------------------------------------------------------------
create table if not exists public.pagamento_eventos (
  id                 uuid primary key default gen_random_uuid(),
  pedido_id          uuid references public.pedidos(id) on delete set null,
  provider           payment_provider not null,
  provider_event_id  text not null,
  tipo               text not null,
  payload            jsonb not null,
  processado_em      timestamptz not null default now(),
  unique (provider, provider_event_id)
);

grant all on public.pagamento_eventos to service_role;
alter table public.pagamento_eventos enable row level security;

-- ------------------------------------------------------------
-- 5) Se o get_pedido for definido com colunas explícitas,
--    adicione ao SELECT interno:
--    status_pgto, metodo_pgto, provider_preference_id,
--    provider_payment_id, valor_pago, pago_em
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- 6) Realtime na tabela pedidos
-- ------------------------------------------------------------
do $$ begin
  perform 1 from pg_publication_tables
   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pedidos';
  if not found then
    execute 'alter publication supabase_realtime add table public.pedidos';
  end if;
end $$;
