-- ============================================================================
-- Migration 010 — Meta Pixel por loja
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================================

alter table public.lojas
  add column if not exists meta_pixel_id text;

comment on column public.lojas.meta_pixel_id is
  'ID do Meta Pixel (Facebook/Instagram) do lojista. Null = sem rastreamento.';

-- ---------- View pública (marketplace) -------------------------------------
-- DROP + CREATE é necessário porque adicionamos meta_pixel_id no meio das
-- colunas; CREATE OR REPLACE VIEW não consegue reordenar/reidentificar as
-- colunas existentes e gera erro 42P16.
drop view if exists public.lojas_publicas;

create view public.lojas_publicas as
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
  l.meta_pixel_id,
  coalesce(max(f.km_max), 0) as raio_max_km
from public.lojas l
left join public.loja_frete_faixas f on f.loja_id = l.id
group by l.id;

grant select on public.lojas_publicas to anon, authenticated;

-- resolve_tenant devolve SETOF public.lojas — a nova coluna já vai junto,
-- basta recriar a função para atualizar o tipo de retorno em cache.
create or replace function public.resolve_tenant(p_host text, p_slug text)
returns setof public.lojas
language sql
stable
security definer
set search_path = public
as $$
  select l.*
    from public.lojas l
   where (
           p_host is not null
       and l.dominio_customizado is not null
       and l.dominio_verificado
       and l.dominio_customizado = public.normaliza_host(p_host)
         )
      or (p_slug is not null and l.slug = p_slug)
   order by (l.dominio_customizado is not null) desc
   limit 1;
$$;

revoke all on function public.resolve_tenant(text, text) from public;
grant execute on function public.resolve_tenant(text, text) to anon, authenticated;

-- ---------- Exemplo de configuração manual ---------------------------------
-- update public.lojas set meta_pixel_id = '1534733807728159'
--  where slug = 'acai-do-madruga-marista';
