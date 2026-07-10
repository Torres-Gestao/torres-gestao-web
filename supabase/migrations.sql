-- =====================================================================
-- Migração: clientes + status/cliente_id em pedidos
-- Rode este SQL no SQL Editor do Supabase (uma vez).
-- =====================================================================

-- ---------- ENUM de status ------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pedido_status') THEN
    CREATE TYPE pedido_status AS ENUM (
      'pendente', 'aceito', 'em_preparo', 'pronto',
      'em_rota', 'concluido', 'cancelado'
    );
  END IF;
END$$;

-- ---------- Tabela clientes ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.clientes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id     uuid NOT NULL REFERENCES public.lojas(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  telefone    text NOT NULL,
  endereco    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (loja_id, telefone)
);

GRANT SELECT, INSERT, UPDATE ON public.clientes TO anon, authenticated;
GRANT ALL ON public.clientes TO service_role;

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_public_insert" ON public.clientes;
CREATE POLICY "clientes_public_insert" ON public.clientes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "clientes_public_select" ON public.clientes;
CREATE POLICY "clientes_public_select" ON public.clientes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "clientes_public_update" ON public.clientes;
CREATE POLICY "clientes_public_update" ON public.clientes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- ---------- ALTER pedidos: cliente_id + status ---------------------------
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS status pedido_status NOT NULL DEFAULT 'pendente';

CREATE INDEX IF NOT EXISTS pedidos_cliente_id_idx ON public.pedidos(cliente_id);
CREATE INDEX IF NOT EXISTS pedidos_status_idx     ON public.pedidos(status);

-- ---------- Realtime -----------------------------------------------------
-- Habilita o canal de mudança para a tela de acompanhamento.
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
