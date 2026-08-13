// Manifest dinâmico por loja (white label): cada loja instala "o app dela".
// Gerado em runtime como Blob e trocado na tag <link rel="manifest">.

interface ManifestLoja {
  nome: string;
  slug?: string | null;
  logoUrl?: string | null;
  corPrimaria?: string | null;
  /** true = domínio próprio do lojista (escopo na raiz) */
  dominioProprio: boolean;
}

let blobAtual: string | null = null;

function abs(path: string) {
  return new URL(path, window.location.origin).href;
}

function tipoDaImagem(url: string): string {
  const limpa = url.split("?")[0].toLowerCase();
  if (limpa.endsWith(".jpg") || limpa.endsWith(".jpeg")) return "image/jpeg";
  if (limpa.endsWith(".webp")) return "image/webp";
  if (limpa.endsWith(".svg")) return "image/svg+xml";
  return "image/png";
}

export function aplicarManifestDaLoja(loja: ManifestLoja) {
  if (typeof document === "undefined") return;

  const escopo = loja.dominioProprio ? "/" : `/${loja.slug ?? ""}`;
  const cor = loja.corPrimaria || "#6B21A8";

  const icones: Record<string, string>[] = [];
  if (loja.logoUrl) {
    const tipo = tipoDaImagem(loja.logoUrl);
    icones.push(
      { src: loja.logoUrl, sizes: "192x192", type: tipo, purpose: "any" },
      { src: loja.logoUrl, sizes: "512x512", type: tipo, purpose: "any" },
    );
  }
  // Fallback sempre presente (garante instalabilidade mesmo sem logo/CORS).
  icones.push(
    { src: abs("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: abs("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: abs("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  );

  const manifest = {
    name: loja.nome,
    short_name: loja.nome.slice(0, 12),
    description: `Cardápio digital de ${loja.nome}`,
    start_url: abs(escopo.endsWith("/") ? escopo : `${escopo}/`),
    scope: abs(escopo.endsWith("/") ? escopo : `${escopo}/`),
    id: escopo.endsWith("/") ? escopo : `${escopo}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: cor,
    lang: "pt-BR",
    icons: icones,
  };

  const link =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
    (() => {
      const l = document.createElement("link");
      l.rel = "manifest";
      document.head.appendChild(l);
      return l;
    })();

  const url = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
  );
  link.href = url;
  if (blobAtual) URL.revokeObjectURL(blobAtual);
  blobAtual = url;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = cor;

  const apple = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  if (apple) apple.content = loja.nome;

  document.title = `${loja.nome} | Cardápio Digital`;
}
