import { useEffect } from "react";

// Rastreamento de origem (UTM + referrer) por sessão.
// Regra: grava na primeira visita da sessão e não sobrescreve, EXCETO quando
// chega uma visita com UTM e a sessão só tinha referrer (campanha paga > orgânico).
//
// IMPORTANTE: nada aqui pode derrubar o checkout. Todas as funções são
// defensivas (try/catch) e falham devolvendo null.

export const TRACKING_KEY = "torres_gestao_tracking";

const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

export type UtmKey = (typeof UTM_KEYS)[number];

export type TrackingData = Partial<Record<UtmKey, string>> & {
  referrer?: string;
  landing_page?: string;
  captured_at?: string;
};

const MAX_LEN = 255;

/** Trunca o VALOR da string (nunca o JSON serializado). */
function safe(v: string | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  return t ? t.slice(0, MAX_LEN) : undefined;
}

function hasUtm(t: TrackingData | null): boolean {
  if (!t) return false;
  return UTM_KEYS.some((k) => Boolean(t[k]));
}

/** Referrer externo (descarta navegação interna do próprio host). */
function referrerExterno(): string | undefined {
  try {
    const raw = document.referrer;
    if (!raw) return undefined;
    const url = new URL(raw);
    if (url.hostname === window.location.hostname) return undefined;
    return safe(raw);
  } catch {
    return undefined;
  }
}

/** Coleta da URL atual + referrer. Allowlist estrita de chaves. */
function coletar(): TrackingData | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const data: TrackingData = {};

    for (const k of UTM_KEYS) {
      const v = safe(params.get(k));
      if (v) data[k] = v;
    }

    const ref = referrerExterno();
    if (ref) data.referrer = ref;

    // Nada relevante: acesso direto.
    if (Object.keys(data).length === 0) return null;

    const lp = safe(window.location.pathname);
    if (lp) data.landing_page = lp;
    data.captured_at = new Date().toISOString();

    return data;
  } catch {
    return null;
  }
}

/** Leitura pura da sessão. Nunca lança. */
export function getTracking(): TrackingData | null {
  try {
    const raw = sessionStorage.getItem(TRACKING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as TrackingData;
  } catch {
    return null;
  }
}

/** Captura a origem no boot. Silencioso em caso de falha. */
export function useTracking(): void {
  useEffect(() => {
    try {
      const atual = coletar();
      if (!atual) return;

      const existente = getTracking();

      // Primeira origem vale, exceto quando a nova traz UTM e a antiga não.
      if (existente && !(hasUtm(atual) && !hasUtm(existente))) return;

      sessionStorage.setItem(TRACKING_KEY, JSON.stringify(atual));
    } catch {
      // sessionStorage bloqueado (modo privado/iframe/cota) — ignora.
    }
  }, []);
}
