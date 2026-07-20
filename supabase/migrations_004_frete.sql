-- ============================================================================
-- Migration 004 — Frete por distância (Mapbox)
-- Rodar no SQL Editor do Supabase. Idempotente.
-- ============================================================================

-- 1) Campos na loja: endereço, coordenadas, token público Mapbox e flag geral.
alter table public.lojas
  add column if not exists endereco              jsonb,
  add column if not exists latitude              numeric(10,7),
  add column if not exists longitude             numeric(10,7),
  add column if not exists mapbox_public_token   text,
  add column if not exists frete_ativo           boolean not null default false;

-- 2) Tabela de faixas de frete por km.
create table if not exists public.loja_frete_faixas (
  id         uuid primary key default gen_random_uuid(),
  loja_id    uuid not null references public.lojas(id) on delete cascade,
  km_min     numeric(6,2) not null default 0,
  km_max     numeric(6,2) not null,
  valor      numeric(10,2) not null,
  ordem      int not null default 0,
  created_at timestamptz not null default now(),
  constraint loja_frete_faixas_km_check check (km_max > km_min)
);

create index if not exists idx_loja_frete_faixas_loja_ordem
  on public.loja_frete_faixas (loja_id, ordem);

-- 3) GRANTs.
grant select on public.loja_frete_faixas to anon, authenticated;
grant all    on public.loja_frete_faixas to service_role;

-- 4) RLS: leitura pública (o storefront do cliente final é anônimo).
alter table public.loja_frete_faixas enable row level security;

drop policy if exists "faixas_public_read" on public.loja_frete_faixas;
create policy "faixas_public_read"
  on public.loja_frete_faixas for select
  to anon, authenticated
  using (true);

-- Escrita: apenas service_role (o on-premise gerencia).
-- (Sem políticas de INSERT/UPDATE/DELETE para anon/authenticated.)

-- 5) Coordenadas do cliente no endereço (opcional; jsonb aceita novas chaves).
--    Guardadas automaticamente pelo front dentro de clientes.endereco:
--    { rua, numero, ..., latitude, longitude }
