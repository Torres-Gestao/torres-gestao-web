# Cardápio Digital — White Label

SPA em **Vite + React + React Router (HashRouter)** que consome direto o **Supabase** e é publicada como site estático no **GitHub Pages**.

Cada loja tem seu cardápio em `/#/<slug>` (ex.: `/#/pizzaria-do-joao`).

## Rodando local

```bash
bun install
cp .env.example .env   # já vem preenchido no repo com as credenciais do Supabase
bun run dev
```

Abra http://localhost:8080

## Variáveis de ambiente

| Nome | Descrição |
|------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave pública (anon) — pode ir para o bundle |
| `VITE_BASE_PATH` | (opcional) sobrescreve o base path de produção (padrão `/torres-gestao-web/`) |

## Deploy no GitHub Pages

1. No GitHub, vá em **Settings → Pages → Source: GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions → New repository secret**, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Faça `git push` para `main`. O workflow `.github/workflows/deploy.yml` compila e publica automaticamente.

O `base` do Vite está configurado como `/torres-gestao-web/`. Se o repositório tiver outro nome, atualize `vite.config.ts` ou defina o secret `VITE_BASE_PATH`.

## RLS necessária no Supabase

Rode este SQL uma vez no editor SQL do Supabase para que o site consiga ler o cardápio e criar pedidos:

```sql
-- LEITURA PÚBLICA (vitrine)
alter table public.lojas       enable row level security;
alter table public.categorias  enable row level security;
alter table public.produtos    enable row level security;

grant select on public.lojas       to anon, authenticated;
grant select on public.categorias  to anon, authenticated;
grant select on public.produtos    to anon, authenticated;

create policy "public read lojas"      on public.lojas      for select to anon using (true);
create policy "public read categorias" on public.categorias for select to anon using (ativo = true);
create policy "public read produtos"   on public.produtos   for select to anon using (ativo = true);

-- PEDIDOS: cliente anônimo pode CRIAR, mas não listar
alter table public.pedidos enable row level security;
grant insert on public.pedidos to anon;
grant usage, select on sequence public.pedidos_numero_pedido_seq to anon;
grant all on public.pedidos to service_role;

create policy "anon insert pedido" on public.pedidos
  for insert to anon with check (true);
```

## Estrutura

```
src/
  App.tsx                 -> rotas
  main.tsx                -> HashRouter + QueryClient
  lib/
    supabase.ts           -> client anon
    whatsapp.ts           -> monta mensagem e URL wa.me
    money.ts, cep.ts
  types/db.ts             -> tipos das tabelas
  hooks/
    useLoja.ts            -> busca loja por slug + aplica cores como CSS vars
    useProdutos.ts        -> categorias + produtos
    useCarrinho.tsx       -> Context + localStorage por loja
  components/loja/        -> Shell, Header, Card, Modal, FloatingCart
  pages/                  -> Home, Vitrine, Carrinho, Checkout, Confirmacao
```

## Fluxo do pedido

1. Cliente escolhe itens (adicionados ao carrinho em `localStorage`).
2. Preenche checkout (nome, telefone, endereço via ViaCEP, forma de pagamento).
3. Site insere linha em `pedidos` (`status_web = 'pendente'`).
4. Redireciona para `wa.me/<telefone-da-loja>` com a mensagem formatada.

Nenhuma integração de gateway de pagamento nesta V1 — o pagamento acontece na entrega/retirada (dinheiro / PIX / cartão).
