-- ============================================================================
-- Migration 005 — Home marketplace
-- View pública consumida pela home. Idempotente.
-- ============================================================================

create or replace view public.lojas_publicas as
select
  l.id,
  l.slug,
  l.nome,
  l.logo_url,
  l.cor_primaria,
  l.cor_secundaria,
  l.loja_aberta,
  l.horarios_funcionamento,
  l.latitude,
  l.longitude,
  l.frete_ativo,
  coalesce(max(f.km_max), 0) as raio_max_km
from public.lojas l
left join public.loja_frete_faixas f on f.loja_id = l.id
group by l.id;

grant select on public.lojas_publicas to anon, authenticated;
