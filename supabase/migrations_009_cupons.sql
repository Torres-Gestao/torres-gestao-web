-- ============================================================
-- Migration 009 — Cupons / promoções / frete grátis
-- O PDV (on-premise) publica os cupons; o site lê, aplica e grava
-- o pedido já com o desconto resolvido.
-- ============================================================

-- ---------- Tabela de cupons ----------
CREATE TABLE IF NOT EXISTS public.cupons (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id                uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  pdv_cupom_id           text NOT NULL,
  codigo                 text,                  -- vazio/null = promoção automática
  nome                   text,
  ativo                  boolean DEFAULT true,
  tipo                   text,                  -- percentual | valor_fixo | leve_x_pague_y | compre_x_ganhe_desconto | item_gratis
  valor                  numeric DEFAULT 0,
  escopo                 text DEFAULT 'pedido', -- pedido | itens | entrega
  canais                 jsonb DEFAULT '[]'::jsonb,
  produtos_alvo          jsonb DEFAULT '[]'::jsonb,   -- UUIDs de produtos do Supabase
  categorias_alvo        jsonb DEFAULT '[]'::jsonb,   -- UUIDs de categorias do Supabase
  valor_minimo           numeric DEFAULT 0,
  qtd_minima             numeric DEFAULT 0,
  regra                  jsonb DEFAULT '{}'::jsonb,
  limite_uso_total       numeric DEFAULT 0,     -- 0 = sem limite
  limite_por_cliente     numeric DEFAULT 0,
  tem_limite_por_cliente boolean DEFAULT false,
  primeira_compra        boolean DEFAULT false,
  acumulavel             boolean DEFAULT false,
  prioridade             numeric DEFAULT 0,
  agendamento            jsonb DEFAULT '{}'::jsonb,
  updated_at             timestamptz DEFAULT now(),
  UNIQUE (loja_id, pdv_cupom_id)
);

CREATE INDEX IF NOT EXISTS cupons_loja_ativo_idx ON public.cupons (loja_id, ativo);

-- Grants: sem isso o PostgREST devolve permission denied mesmo com RLS ok.
GRANT SELECT ON public.cupons TO anon, authenticated;
GRANT ALL    ON public.cupons TO service_role;

ALTER TABLE public.cupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cupons_public_read" ON public.cupons;
CREATE POLICY "cupons_public_read"
  ON public.cupons
  FOR SELECT
  USING (ativo = true);

-- ---------- Colunas novas em pedidos ----------
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_id         uuid;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupom_codigo     text;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS valor_desconto   numeric DEFAULT 0;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS entrega_gratis   boolean DEFAULT false;
ALTER TABLE public.pedidos ADD COLUMN IF NOT EXISTS cupons_aplicados jsonb   DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS pedidos_cupom_idx ON public.pedidos (cupom_id);

-- ---------- Contagem de usos ----------
-- SELECT em pedidos é revogado para anon (migration 001), então a contagem
-- de usos precisa vir de uma função SECURITY DEFINER que devolve só números.
CREATE OR REPLACE FUNCTION public.contar_usos_cupom(
  p_cupom_id uuid,
  p_telefone text DEFAULT NULL
)
RETURNS TABLE (total bigint, do_cliente bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    count(*) FILTER (WHERE true) AS total,
    count(*) FILTER (
      WHERE p_telefone IS NOT NULL
        AND regexp_replace(coalesce(p.cliente_telefone, ''), '\D', '', 'g')
            = regexp_replace(p_telefone, '\D', '', 'g')
    ) AS do_cliente
  FROM public.pedidos p
  WHERE p.cupom_id = p_cupom_id
    AND coalesce(p.status::text, '') <> 'cancelado';
$$;

REVOKE ALL ON FUNCTION public.contar_usos_cupom(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.contar_usos_cupom(uuid, text) TO anon, authenticated;

-- Conta pedidos anteriores do telefone na loja (para "primeira compra").
CREATE OR REPLACE FUNCTION public.contar_pedidos_cliente(
  p_loja_id uuid,
  p_telefone text
)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)
  FROM public.pedidos p
  WHERE p.loja_id = p_loja_id
    AND regexp_replace(coalesce(p.cliente_telefone, ''), '\D', '', 'g')
        = regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')
    AND coalesce(p.status::text, '') <> 'cancelado';
$$;

REVOKE ALL ON FUNCTION public.contar_pedidos_cliente(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.contar_pedidos_cliente(uuid, text) TO anon, authenticated;
