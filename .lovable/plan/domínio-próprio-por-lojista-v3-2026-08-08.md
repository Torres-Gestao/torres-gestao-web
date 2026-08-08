# Domínio próprio por lojista (v3)

Retomando de onde paramos. Estado atual verificado no código: `src/main.tsx` usa `HashRouter`, deploy é GitHub Pages (`.github/workflows/deploy.yml`), `vite.config.ts` usa base `/torres-gestao-web/`, e não existe nenhuma coluna de domínio nem RPC de tenant no banco (migrations vão até a 007).

## O que muda para o lojista

- Continua funcionando o modelo atual: `sistema.com/#/nome-da-loja`.
- Quem quiser, cadastra o próprio domínio no PDV (on-premise). O PDV grava no Supabase e a vitrine passa a abrir direto em `dominiodolojista.com`, sem slug na URL.

## Etapas

### 1. Banco (migration 008)

- `lojas.dominio_customizado text unique` + `dominio_verificado boolean default false`.
- Índice funcional `lower(dominio_customizado)`; confirmar que `slug` já tem unique/PK (senão criar) para o ramo marketplace não fazer seq scan.
- Trigger de normalização na escrita: `lower()` + remove `^www\.`. Comentário no SQL amarrando trigger e RPC (os dois regex têm que ser idênticos; mudou um, muda o outro).
- CHECK de slugs reservados (`carrinho`, `checkout`, `pedido`, `assets`, ...). Ciente de que ampliar a lista depois exige migration.
- RPC `resolve_tenant(p_host text, p_slug text)` retornando a loja por host normalizado OU por slug, com `LIMIT 1`, `security definer`, grants para `anon`.

### 2. Hospedagem: GitHub Pages -> Cloudflare Pages

GitHub Pages só aceita um domínio por repositório, então domínio por lojista exige a troca. Cloudflare Pages: build igual (`bun run build`), domínios customizados ilimitados com SSL automático. O lojista aponta CNAME para o projeto Pages.

### 3. Roteamento: HashRouter -> BrowserRouter

- `main.tsx` passa a usar `BrowserRouter`; `vite.config.ts` volta a `base: "/"`.
- Rotas ficam em dois modos:
  - host customizado: `/`, `/carrinho`, `/checkout`, `/pedido/:id` (sem slug).
  - marketplace: `/`, `/:slug`, `/:slug/carrinho`, ...
- Snippet no `<head>` do `index.html`, antes do bundle, convertendo links antigos `#/x` em `/x` (ignora âncoras normais; `#/` puro vira `/`).

### 4. Frontend

- `TenantProvider` chama `resolve_tenant` com `window.location.hostname` + slug da rota, via React Query como **única** fonte de cache (sem localStorage paralelo). Resultado negativo não é cacheado (ou TTL bem curto) para o lojista recém-configurado não ver "domínio não configurado" por minutos.
- Skeleton de boot com cor fallback `#6B21A8` até resolver a loja. O flash de cor no single-tenant fica aceito na v1.
- Todos os links internos passam a ser gerados por um helper `tenantPath()` que sabe se está em modo domínio próprio ou marketplace.

## Detalhes técnicos

- SEO/preview social por lojista (title/og dinâmicos no HTML) exigiria uma Cloudflare Pages Function injetando meta no servidor — fica fora da v1, com `document.title` sendo ajustado no client.
- O PDV continua sendo a fonte da verdade do domínio; o white label só lê.
- Links `#/` antigos (WhatsApp, impressos) seguem funcionando pelo redirect do `<head>`.

## Decisão necessária antes de executar

A troca para Cloudflare Pages é pré-requisito da etapa 2 em diante. As etapas 1 e 4 (banco + resolve de tenant) já podem ser feitas mesmo continuando no GitHub Pages, mas sem a troca nenhum lojista consegue de fato usar o próprio domínio.
