# Correção da migration 010 — Meta Pixel por loja

## Problema

Ao rodar `supabase/migrations_010_meta_pixel.sql` o Supabase retornou:

```
ERROR: 42P16: cannot change name of view column "raio_max_km" to "meta_pixel_id"
HINT:  Use ALTER VIEW ... RENAME COLUMN ... to change name of view column instead.
```

Isso acontece porque inserir a coluna `meta_pixel_id` no meio da lista de colunas da `public.lojas_publicas` fez o PostgreSQL confundir a ordem/identidade das colunas existentes. O `CREATE OR REPLACE VIEW` não consegue reordenar/reidentificar colunas dessa forma.

## Solução

Alterar a migration 010 para **dropar e recriar** a view `public.lojas_publicas` em vez de usar `create or replace view`. Assim o PostgreSQL cria a view do zero com a coluna `meta_pixel_id` na posição correta e sem conflito de nomes.

## Passos

1. **Atualizar `supabase/migrations_010_meta_pixel.sql`**
   - Substituir o bloco `create or replace view public.lojas_publicas as ...` por:
     ```sql
     drop view if exists public.lojas_publicas;
     create view public.lojas_publicas as ...;
     ```
   - Manter o `grant select on public.lojas_publicas to anon, authenticated;` logo após a recriação.
   - Adicionar um comentário explicando que o drop+create é necessário porque a view teve colunas adicionadas no meio da lista.

2. **Manter o resto da migration inalterado**
   - `alter table public.lojas add column if not exists meta_pixel_id text;`
   - `comment on column ...`
   - Recriação de `public.resolve_tenant(...)` (não depende da view, então não precisa de alteração).
   - Exemplo de `update` comentado no final.

3. **Instrução ao usuário**
   - Rodar o arquivo `supabase/migrations_010_meta_pixel.sql` novamente no SQL Editor do Supabase.
   - Preencher `meta_pixel_id` na tabela `public.lojas` para as lojas que devem rastrear eventos.

## Fora de escopo

- Nenhuma alteração no front-end ou no arquivo `src/lib/meta-pixel.ts`.
- Nenhuma mudança nos eventos rastreados ou na lógica de deduplicação de `Purchase`.
