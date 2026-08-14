// Helper compartilhado pelas Pages Functions (Cloudflare).
// Busca a loja pública por slug ou pelo host (domínio próprio), usando a API
// REST do Supabase com a chave anon (view/RPC já são públicas por RLS).

export interface LojaPublica {
  id: string;
  slug: string;
  nome: string;
  logo_url: string | null;
  cor_primaria: string | null;
}

interface Env {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}

function creds(env: Env) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY;
  return url && key ? { url: url.replace(/\/$/, ""), key } : null;
}

/** Mesma normalização de public.normaliza_host() / src/lib/tenant.ts */
export function normalizeHost(host: string): string {
  return host
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[:/].*$/, "");
}

async function porSlug(env: Env, slug: string): Promise<LojaPublica | null> {
  const c = creds(env);
  if (!c) return null;
  const url =
    `${c.url}/rest/v1/lojas_publicas` +
    `?slug=eq.${encodeURIComponent(slug)}&select=id,slug,nome,logo_url,cor_primaria&limit=1`;
  const res = await fetch(url, {
    headers: { apikey: c.key, authorization: `Bearer ${c.key}` },
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as LojaPublica[];
  return rows[0] ?? null;
}

async function porHost(env: Env, host: string): Promise<LojaPublica | null> {
  const c = creds(env);
  if (!c) return null;
  const res = await fetch(`${c.url}/rest/v1/rpc/resolve_tenant`, {
    method: "POST",
    headers: {
      apikey: c.key,
      authorization: `Bearer ${c.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ p_host: normalizeHost(host), p_slug: null }),
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as LojaPublica[];
  return rows[0] ?? null;
}

/**
 * Resolve a loja. O slug especial "_" significa "descobrir pelo host"
 * (usado nos domínios próprios, onde o HTML não conhece o slug).
 */
export async function buscarLoja(
  env: Env,
  slug: string,
  host: string,
): Promise<LojaPublica | null> {
  if (!slug || slug === "_" || slug === "-") return porHost(env, host);
  return (await porSlug(env, slug)) ?? porHost(env, host);
}
