// GET /icon/{slug}?size=512  ->  logo da loja servida pela própria origem.
// Same-origin evita problemas de CORS/canvas e permite que o Chrome use a
// imagem como ícone do app instalado (data: URLs eram descartadas).

import { buscarLoja } from "../_lib/loja";

interface Ctx {
  params: { slug: string };
  request: Request;
  env: Record<string, string>;
}

export const onRequestGet = async ({ params, request, env }: Ctx) => {
  const url = new URL(request.url);
  const slug = decodeURIComponent(params.slug ?? "");
  const loja = await buscarLoja(env, slug, url.hostname);
  const generico = new URL("/icon-512.png", url).href;

  if (!loja?.logo_url) return Response.redirect(generico, 302);

  let upstream: Response;
  try {
    upstream = await fetch(loja.logo_url, { cf: { cacheTtl: 86400 } } as RequestInit);
  } catch {
    return Response.redirect(generico, 302);
  }
  if (!upstream.ok || !upstream.body) return Response.redirect(generico, 302);

  const tipo = upstream.headers.get("content-type") ?? "image/png";
  if (!tipo.startsWith("image/")) return Response.redirect(generico, 302);

  return new Response(upstream.body, {
    headers: {
      "content-type": tipo,
      "cache-control": "public, max-age=86400, s-maxage=604800, immutable",
      "access-control-allow-origin": "*",
    },
  });
};
