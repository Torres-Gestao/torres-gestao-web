// Manifest dinâmico por loja (white label): cada loja instala "o app dela".
//
// Caminho principal: Pages Functions servem /manifest/{slug} e /icon/{slug}
// em URLs http reais da mesma origem — é a única forma do Chrome usar a logo
// da loja como ícone do app instalado (manifest blob: + ícone data: era
// descartado e o app caía sempre no ícone genérico).
//
// Caminho de fallback (hosts sem Pages Functions, ex.: preview): gera o
// manifest em runtime como Blob, com a logo convertida em PNG via canvas.

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

function linkManifest(): HTMLLinkElement {
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "manifest";
    document.head.appendChild(link);
  }
  return link;
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

/**
 * Transforma a logo da loja num PNG quadrado (data URL). Usado só no fallback.
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

/** A rota /manifest/{slug} existe (Pages Function) e devolve JSON de manifest? */
async function functionsDisponiveis(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const tipo = res.headers.get("content-type") ?? "";
    return tipo.includes("manifest") || tipo.includes("json");
  } catch {
    return false;
  }
}

async function fallbackBlob(loja: ManifestLoja, escopo: string, cor: string) {
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
      trocarLink("apple-touch-icon", i512);
      trocarLink("icon", i512, "image/png");
    } else {
      icones.push(
        { src: loja.logoUrl, sizes: "192x192", purpose: "any" },
        { src: loja.logoUrl, sizes: "512x512", purpose: "any" },
      );
      trocarLink("apple-touch-icon", loja.logoUrl);
    }
  }
  icones.push(
    { src: abs("/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
    { src: abs("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
    { src: abs("/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
  );

  const manifest = {
    id: escopo,
    name: loja.nome,
    short_name: loja.nome.slice(0, 12),
    description: `Cardápio digital de ${loja.nome}`,
    start_url: abs(escopo),
    scope: abs(escopo),
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
  linkManifest().href = url;
  if (blobAtual) URL.revokeObjectURL(blobAtual);
  blobAtual = url;
}

export async function aplicarManifestDaLoja(loja: ManifestLoja) {
  if (typeof document === "undefined") return;

  const cor = loja.corPrimaria || "#6B21A8";
  const escopoRaw = loja.dominioProprio ? "/" : `/${loja.slug ?? ""}`;
  const escopo = escopoRaw.endsWith("/") ? escopoRaw : `${escopoRaw}/`;

  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = cor;

  const apple = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
  if (apple) apple.content = loja.nome;

  document.title = `${loja.nome} | Cardápio Digital`;

  // Slug usado nas Pages Functions ("_" = resolver pelo host, domínio próprio).
  const chave = loja.dominioProprio ? "_" : (loja.slug ?? "");
  const urlManifest = `/manifest/${encodeURIComponent(chave)}`;

  if (chave && (await functionsDisponiveis(urlManifest))) {
    linkManifest().href = urlManifest;
    if (loja.logoUrl) {
      const icone = `/icon/${encodeURIComponent(chave)}?size=180`;
      trocarLink("apple-touch-icon", icone);
      trocarLink("icon", icone);
    }
    if (blobAtual) {
      URL.revokeObjectURL(blobAtual);
      blobAtual = null;
    }
    return;
  }

  await fallbackBlob(loja, escopo, cor);
}
