# Domínio próprio por lojista

## Como funciona

1. O lojista cadastra o domínio no PDV (on-premise). O PDV grava em
   `lojas.dominio_customizado` e marca `dominio_verificado = true` depois que o DNS estiver
   apontado.
2. A vitrine lê `window.location.hostname`, chama a RPC `resolve_tenant(p_host, p_slug)` e:
   - host da plataforma (`*.pages.dev`, `*.lovable.app`, `localhost`, ...) → modo marketplace
     (`/`, `/:slug`, `/:slug/carrinho`, ...);
   - host de lojista → modo domínio próprio (`/`, `/carrinho`, `/checkout`, `/pedido/:id`).
3. Se o host é customizado mas nenhuma loja casa, a tela "Domínio não configurado" aparece.
   Esse resultado negativo não fica em cache longo — basta o lojista atualizar a página.

## Banco

Rode `supabase/migrations_008_dominio_customizado.sql` no SQL Editor. Ele cria:

- `lojas.dominio_customizado`, `lojas.dominio_verificado`;
- `public.normaliza_host()` — usada **tanto** pelo trigger de escrita quanto pela RPC de
  leitura (uma única regra de normalização: lower, sem `www.`, sem esquema, sem porta);
- índice único funcional em `dominio_customizado` e único em `slug`;
- CHECK de slugs reservados (`carrinho`, `checkout`, `pedido`, ...);
- RPC `resolve_tenant(p_host, p_slug)`.

## Hospedagem: Cloudflare Pages

GitHub Pages só aceita um domínio por repositório. Para domínio por lojista:

1. Cloudflare Dashboard → Workers & Pages → Create → Pages → conectar o repositório.
2. Build command: `bun run build` · Output directory: `dist`.
3. Variáveis de ambiente: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Para cada lojista: Custom domains → Set up a domain → o lojista aponta um `CNAME` para
   `<projeto>.pages.dev` (ou os registros que a Cloudflare indicar). SSL é automático.

`public/_redirects` já contém o fallback de SPA (`/* /index.html 200`).

## Links antigos

O snippet no `<head>` do `index.html` converte `#/loja/carrinho` em `/loja/carrinho` antes do
bundle carregar, então links já impressos ou enviados por WhatsApp continuam funcionando.

## Fora do escopo desta versão

Meta tags e preview social por loja (title/og dinâmicos no HTML) exigiriam uma Pages Function
injetando o meta no servidor. Hoje o `document.title` é ajustado no cliente.
