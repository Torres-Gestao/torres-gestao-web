# PWA instalável (white label, um app por loja)

O cardápio passa a poder ser instalado na tela inicial do celular, com ícone e nome **da loja que o cliente está acessando** — não um app genérico do sistema.

## O que o cliente final vai ver

- Ao abrir o cardápio de uma loja, um banner discreto "Instalar o app da {Loja}" aparece (dispensável, não volta a incomodar depois de fechado).
- Instalando, o celular cria um atalho com a logo da loja; abrindo por ele, a barra de endereço some e a barra de status usa a cor primária da loja.
- No marketplace (home sem loja), o app instalável é o genérico "Cardápio Digital".

## Etapas

### 1. Manifest dinâmico por loja

Um manifest estático não serve aqui: cada loja tem nome, logo e cor próprios. O manifest será gerado em runtime (Blob) a partir dos dados já carregados no `TenantProvider`/`LojaShell`:

- `name`/`short_name`: nome da loja; `theme_color`: `cor_primaria`; `display: standalone`.
- `start_url`/`scope`: `/` em domínio próprio, `/{slug}` no domínio do sistema.
- Ícones: derivados de `logo_url` (192/512, `purpose: any maskable`), com fallback para ícones genéricos em `public/` quando a loja não tem logo.
- A tag `<link rel="manifest">` e `<meta name="theme-color">` são atualizadas quando a loja resolve.
- Fallback estático `public/manifest.webmanifest` para o marketplace e para o primeiro paint.

### 2. Service worker (necessário para o convite de instalação)

O Chrome só oferece instalação quando existe um service worker com handler de fetch. Em vez de arquivo manual, será usado `vite-plugin-pwa` (`generateSW`), com registro por um módulo wrapper único que **não registra** em dev, dentro de iframe, nos hosts de preview da Lovable ou com `?sw=off` (nesses casos ele desregistra SWs antigos). Navegações usam NetworkFirst (nunca cache-first), assets com hash usam CacheFirst, `/~oauth` fica fora do fallback.

Efeito prático: cardápio abre instantâneo em rede ruim; dados de pedido/preço continuam sempre vindo da rede.

### 3. Botão/banner de instalação

- Hook capturando `beforeinstallprompt`, guardando o evento e expondo `promptInstall()`.
- Componente de banner dentro do `LojaShell`, com a cor e o nome da loja, "Instalar" e "Agora não" (dispensa gravada em `localStorage` por loja).
- iOS não dispara esse evento: no Safari/iPhone o banner mostra a instrução "Compartilhar > Adicionar à Tela de Início".

### 4. Ícones e head

- `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` genéricos do sistema.
- `index.html` recebe `link rel="manifest"`, `apple-touch-icon` e mantém `theme-color`.

## Detalhes técnicos

- Offline real só funciona no site publicado (Cloudflare Pages), nunca no preview da Lovable — o registro é bloqueado lá de propósito.
- iOS congela `start_url`/`scope` no momento da instalação; mudanças posteriores exigem reinstalar.
- Ícones vindos de `logo_url` (Supabase Storage) precisam ser servidos com CORS permissivo e de preferência quadrados; se não forem PNG quadrados, o Android pode recortar mal — daí o `purpose: any maskable` e o fallback.
- Nenhuma mudança de banco ou de fluxo de pedido.
