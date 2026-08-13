// Meta Pixel por loja (white label).
// O snippet é injetado dinamicamente só quando a loja acessada tem um
// meta_pixel_id configurado. Nada aqui pode quebrar a página ou o pedido:
// tudo é defensivo e falha em silêncio.

type FbqParams = Record<string, unknown>;

interface Fbq {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
}

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const MOEDA = "BRL";
const PURCHASE_KEY = "torres_gestao_purchase_enviado";

let pixelAtivo: string | null = null;

/** Injeta o fbevents.js oficial uma única vez. */
function carregarScript() {
  if (window.fbq) return;
  const n: Fbq = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else (n.queue as unknown[]).push(args);
  } as Fbq;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  window.fbq = n;
  if (!window._fbq) window._fbq = n;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
}

/** Inicializa o Pixel da loja. Chamadas repetidas com o mesmo id são ignoradas. */
export function initMetaPixel(pixelId: string | null | undefined): void {
  try {
    const id = (pixelId ?? "").trim();
    if (!id) return;
    if (pixelAtivo === id) return;
    carregarScript();
    pixelAtivo = id;
    window.fbq?.("init", id);
    window.fbq?.("track", "PageView");
  } catch {
    // ignora
  }
}

/** Dispara um evento padrão. Adiciona currency BRL sempre que houver value. */
export function track(evento: string, params?: FbqParams): void {
  try {
    if (!pixelAtivo || !window.fbq) return;
    const p: FbqParams = { ...(params ?? {}) };
    if (p.value != null && p.currency == null) p.currency = MOEDA;
    window.fbq("track", evento, p);
  } catch {
    // ignora
  }
}

export function trackPageView(): void {
  track("PageView");
}

/** Purchase deduplicado por pedido (reload / volta do gateway não duplica). */
export function trackPurchaseOnce(pedidoId: string, params: FbqParams): void {
  try {
    if (!pedidoId) return;
    let enviados: string[] = [];
    try {
      const raw = sessionStorage.getItem(PURCHASE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : null;
      if (Array.isArray(parsed)) enviados = parsed.filter((x): x is string => typeof x === "string");
    } catch {
      enviados = [];
    }
    if (enviados.includes(pedidoId)) return;

    track("Purchase", params);

    try {
      sessionStorage.setItem(
        PURCHASE_KEY,
        JSON.stringify([...enviados, pedidoId].slice(-20)),
      );
    } catch {
      // sessionStorage bloqueado — evento já foi enviado, segue o jogo.
    }
  } catch {
    // ignora
  }
}
