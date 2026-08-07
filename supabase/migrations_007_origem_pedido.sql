-- ============================================================================
-- Migration 007 — origem do pedido (UTM + referrer)
-- Idempotente.
-- ============================================================================

alter table public.pedidos
  add column if not exists origem jsonb;

comment on column public.pedidos.origem is
  'Origem do cliente capturada no front (utm_* / referrer / landing_page / captured_at). Null = acesso direto.';
