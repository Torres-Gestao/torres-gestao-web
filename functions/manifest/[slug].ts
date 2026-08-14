// GET /manifest/{slug}  ->  manifest PWA da loja (white label).
// Servido pela mesma origem do site (inclusive nos domínios próprios), com
// ícones em URLs http reais — requisito do Chrome para usar o ícone da loja.

import { buscarLoja } from "../_lib/loja";

interface Ctx {
  params: { slug: string };
  request: Request;
  env: Record<string, string>;
}

function hash(texto: string): string {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export const onRequestGet = async ({ params, request, env }: Ctx) => {
  const url = new URL(request.url);
  const slug = decodeURIComponent(params.slug ?? "").replace(/\.webmanifest$/, "");
  const loja = await buscarLoja(env, slug, url.hostname);

  if (!loja) {
    // Sem loja: entrega o manifest genérico estático.
    return Response.redirect(new URL("/manifest.webmanifest", url).href, 302);
  }

  // Domínio próprio -> escopo na raiz. Domínio da plataforma -> /{slug}/.
  const naRaiz = !url.pathname.startsWith(`/manifest/${loja.slug}`) || slug === "_";
  const escopo = naRaiz ? "/" : `/${loja.slug}/`;
  const cor = loja.cor_primaria || "#6B21A8";
  const v = loja.logo_url ? hash(loja.logo_url) : "0";
  const base = `/icon/${encodeURIComponent(slug || loja.slug)}`;

  const manifest = {
    id: escopo,
    name: loja.nome,
    short_name: loja.nome.slice(0, 12),
    description: `Cardápio digital de ${loja.nome}`,
    start_url: escopo,
    scope: escopo,
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: cor,
    lang: "pt-BR",
    icons: loja.logo_url
      ? [
          { src: `${base}?size=192&v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
          { src: `${base}?size=512&v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: `${base}?size=512&maskable=1&v=${v}`,
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ]
      : [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
  };

  return new Response(JSON.stringify(manifest), {
    headers: {
      "content-type": "application/manifest+json; charset=utf-8",
      "cache-control": "public, max-age=60, s-maxage=300",
      "access-control-allow-origin": "*",
    },
  });
};
