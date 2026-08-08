// Resolução de tenant (marketplace por slug vs. domínio próprio do lojista).

/**
 * Normalização do hostname no FRONT.
 * Precisa espelhar public.normaliza_host() do SQL (migration 008):
 * lower + trim + remove esquema + remove "www." + remove porta.
 */
export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[:/].*$/, "");
}

/** Hosts da plataforma — nunca são domínio próprio de lojista. */
const PLATFORM_SUFFIXES = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  ".lovable.app",
  ".lovableproject.com",
  ".github.io",
  ".pages.dev",
  ".workers.dev",
];

function extraPlatformHosts(): string[] {
  const raw = (import.meta.env.VITE_PLATFORM_HOSTS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((h) => normalizeHost(h))
    .filter(Boolean);
}

export function isPlatformHost(host: string): boolean {
  const h = normalizeHost(host);
  if (!h) return true;
  if (extraPlatformHosts().includes(h)) return true;
  return PLATFORM_SUFFIXES.some((s) =>
    s.startsWith(".") ? h === s.slice(1) || h.endsWith(s) : h === s,
  );
}

/** Modo atual (definido pelo TenantProvider assim que o host é resolvido). */
let customDomainMode = false;

export function setCustomDomainMode(value: boolean) {
  customDomainMode = value;
}

export function isCustomDomainMode() {
  return customDomainMode;
}

/**
 * Monta um caminho interno respeitando o modo:
 * - domínio próprio: /carrinho
 * - marketplace:     /minha-loja/carrinho
 */
export function tenantPath(slug: string | null | undefined, sub = ""): string {
  const s = sub ? (sub.startsWith("/") ? sub : `/${sub}`) : "";
  if (customDomainMode) return s || "/";
  return `/${slug ?? ""}${s}`;
}
