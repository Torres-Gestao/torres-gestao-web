-- ============================================================================
-- Migration 008 — Domínio customizado por lojista
-- Idempotente. Rode no SQL Editor do Supabase.
-- ============================================================================

-- ---------- Colunas -------------------------------------------------------
ALTER TABLE public.lojas
  ADD COLUMN IF NOT EXISTS dominio_customizado text,
  ADD COLUMN IF NOT EXISTS dominio_verificado  boolean NOT NULL DEFAULT false;

-- ---------- Normalização (ESCRITA) ---------------------------------------
-- ATENÇÃO: esta regra precisa ser IDÊNTICA à usada na leitura, dentro de
-- public.resolve_tenant(). Se mudar aqui, mude lá também.
--   lower(trim(host)) -> remove esquema -> remove "www." -> remove porta/barra final
CREATE OR REPLACE FUNCTION public.normaliza_host(p_host text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(lower(trim(coalesce(p_host, ''))), '^https?://', ''),
        '^www\.', ''
      ),
      '[:/].*$', ''
    ),
    ''
  )
$$;

CREATE OR REPLACE FUNCTION public.lojas_normaliza_dominio()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.dominio_customizado := public.normaliza_host(NEW.dominio_customizado);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lojas_normaliza_dominio ON public.lojas;
CREATE TRIGGER trg_lojas_normaliza_dominio
  BEFORE INSERT OR UPDATE OF dominio_customizado ON public.lojas
  FOR EACH ROW EXECUTE FUNCTION public.lojas_normaliza_dominio();

-- Normaliza o que já existe antes de criar o índice único.
UPDATE public.lojas
   SET dominio_customizado = public.normaliza_host(dominio_customizado)
 WHERE dominio_customizado IS NOT NULL
   AND dominio_customizado IS DISTINCT FROM public.normaliza_host(dominio_customizado);

-- ---------- Índices -------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS lojas_dominio_customizado_uidx
  ON public.lojas (dominio_customizado)
  WHERE dominio_customizado IS NOT NULL;

-- Lookup por slug (ramo marketplace da RPC) precisa de índice.
CREATE UNIQUE INDEX IF NOT EXISTS lojas_slug_uidx ON public.lojas (slug);

-- ---------- Slugs reservados ---------------------------------------------
-- Estas palavras viram rotas de primeiro nível no modo domínio próprio.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'lojas_slug_nao_reservado'
  ) THEN
    ALTER TABLE public.lojas
      ADD CONSTRAINT lojas_slug_nao_reservado
      CHECK (slug NOT IN (
        'carrinho', 'checkout', 'pedido', 'pedidos', 'assets',
        'api', 'admin', 'login', 'app', 'static', 'public'
      ));
  END IF;
END$$;

-- ---------- RPC de resolução de tenant -----------------------------------
-- Resolve por host customizado OU por slug, numa única chamada.
-- A normalização do host aqui usa public.normaliza_host(), a MESMA função do
-- trigger de escrita acima — não duplique a regex.
CREATE OR REPLACE FUNCTION public.resolve_tenant(p_host text, p_slug text)
RETURNS SETOF public.lojas
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT l.*
    FROM public.lojas l
   WHERE (
           p_host IS NOT NULL
       AND l.dominio_customizado IS NOT NULL
       AND l.dominio_verificado
       AND l.dominio_customizado = public.normaliza_host(p_host)
         )
      OR (p_slug IS NOT NULL AND l.slug = p_slug)
   ORDER BY (l.dominio_customizado IS NOT NULL) DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.resolve_tenant(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.resolve_tenant(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.normaliza_host(text) TO anon, authenticated;
