# Ícone da loja no app instalado — por que cai no fallback e como resolver

## Diagnóstico

Hoje o manifest é montado no navegador (`src/lib/pwa-manifest.ts`) e entregue como `blob:`, com os ícones embutidos como `data:` (canvas). Três problemas reais desse desenho:

1. **Ícones `data:` são ignorados pelo Chrome na instalação.** O pipeline de instalabilidade busca o ícone por rede a partir da URL do manifest. Como o manifest é `blob:` (base opaca) e os ícones são `data:`, o Chrome descarta e usa o único ícone com URL http real que existe na lista — `/icon-512.png`, o fallback genérico.
2. **Timing.** O `beforeinstallprompt` e a captura do manifest acontecem no primeiro paint, quando ainda vale o `/manifest.webmanifest` estático. A troca só ocorre depois que a loja carrega do banco — tarde demais.
3. **iOS ignora manifest** e lê `apple-touch-icon`; trocar essa tag por JS depois do carregamento normalmente não é respeitado. Além disso, se o Storage não devolver CORS, o canvas falha e o `data:` nem é gerado.

Ou seja: não é a logo da loja que está ruim — é o formato de entrega do manifest/ícone.

## Solução: manifest e ícone com URL real, servidos pelo Cloudflare Pages

### 1. Function de manifest por loja
`functions/manifest/[slug].ts` (Cloudflare Pages Functions) devolve `application/manifest+json` com nome, `theme_color`, `start_url`/`scope` e ícones apontando para URLs http reais da própria origem. Os dados da loja vêm de uma consulta pública ao banco (view `lojas_publicas`) com cache curto.

### 2. Function de ícone por loja
`functions/icon/[slug].ts` baixa a `logo_url`, devolve PNG quadrado (192/512, `any` + `maskable`) com cache longo. Ícone same-origin, sem CORS, sem canvas, sem `data:`.
Se a loja não tiver logo, ela redireciona para o ícone genérico — o fallback continua existindo, mas deixa de ser o caso padrão.

### 3. Escolher o manifest cedo, antes do React
Script inline no `index.html` que, pelo hostname (domínio próprio) ou pelo primeiro segmento da URL (`/{slug}`), já aponta `<link rel="manifest">` para `/manifest/{slug}` e `apple-touch-icon` para `/icon/{slug}?size=180` no primeiro paint. Assim o Chrome captura o manifest certo e o iOS lê o ícone certo.

### 4. Limpar o runtime
`src/lib/pwa-manifest.ts` deixa de gerar Blob/canvas: passa apenas a corrigir `theme-color`, título e, se o slug só for conhecido depois (domínio próprio resolvido via `resolve_tenant`), reapontar o `href` do manifest para a URL real.

## Detalhes técnicos

- Pages Functions rodam no mesmo domínio do site, inclusive nos domínios próprios dos lojistas — cada loja instala com o próprio ícone sem configuração extra.
- Cache: `s-maxage` alto no ícone com chave por slug; invalidação natural ao trocar a logo se a URL da logo mudar (usar hash da `logo_url` no query string).
- No preview da Lovable não há Pages Functions: o manifest cai no estático genérico — teste real só no site publicado.
- iOS congela o ícone no momento da instalação; lojas já instaladas precisam reinstalar.
- Nenhuma mudança de banco, de fluxo de pedido ou de checkout.
