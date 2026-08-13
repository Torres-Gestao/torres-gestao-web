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

/**
 * Transforma a logo da loja num PNG quadrado (data URL) do tamanho pedido.
 * A logo é centralizada e "encaixada" sem distorcer, com fundo da cor da loja.
 * Retorna null se a imagem não puder ser lida (CORS, 404, etc).
 */
function logoQuadrada(url: string, tamanho: number, fundo: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = tamanho;
        canvas.height = tamanho;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);

        ctx.fillStyle = fundo;
        ctx.fillRect(0, 0, tamanho, tamanho);

        // ~12% de respiro nas bordas (bom para ícone maskable também)
        const area = tamanho * 0.76;
        const escala = Math.min(area / img.width, area / img.height);
        const w = img.width * escala;
        const h = img.height * escala;
        ctx.drawImage(img, (tamanho - w) / 2, (tamanho - h) / 2, w, h);

        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function trocarLink(rel: string, href: string, type?: string) {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement("link");
    link.rel = rel;
    document.head.appendChild(link);
  }
  if (type) link.type = type;
  link.href = href;
}

export async function aplicarManifestDaLoja(loja: ManifestLoja) {
  if (typeof document === "undefined") return;

  const escopo = loja.dominioProprio ? "/" : `/${loja.slug ?? ""}`;
  const cor = loja.corPrimaria || "#6B21A8";

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = cor;

  const apple = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (apple) apple.content = loja.nome;

  document.title = `${loja.nome} | Cardápio Digital`;

  // Ícones: logo da loja convertida em PNG quadrado (o Android/iOS exigem quadrado).
  const icones: Record<string, string>[] = [];
  if (loja.logoUrl) {
    const [i192, i512] = await Promise.all([
      logoQuadrada(loja.logoUrl, 192, "#ffffff"),
      logoQuadrada(loja.logoUrl, 512, "#ffffff"),
    ]);
    if (i192) icones.push({ src: i192, sizes: "192x192", type: "image/png", purpose: "any" });
    if (i512) {
      icones.push(
        { src: i512, sizes: "512x512", type: "image/png", purpose: "any" },
        { src: i512, sizes: "512x512", type: "image/png", purpose: "maskable" },
      );
      // iOS ignora o manifest: o ícone da home screen vem do apple-touch-icon.
      trocarLink("apple-touch-icon", i512);
      trocarLink("icon", i512, "image/png");
    } else {
      // Sem CORS na logo: ainda assim tenta usar a URL direta.
      icones.push(
        { src: loja.logoUrl, sizes: "192x192", type: "image/png", purpose: "any" },
        { src: loja.logoUrl, sizes: "512x512", type: "image/png", purpose: "any" },
      );
      trocarLink("apple-touch-icon", loja.logoUrl);
    }
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

  const url = URL.createObjectURL(
    new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" }),
  );
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
    (() => {
      const l = document.createElement("link");
      l.rel = "manifest";
      document.head.appendChild(l);
      return l;
    })();
  link.href = url;
  if (blobAtual) URL.revokeObjectURL(blobAtual);
  blobAtual = url;
}
