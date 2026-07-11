// Cliente HTTP para o backend on-premise.
// Toda comunicação com o Mercado Pago (ou qualquer gateway) passa por aqui:
// o front NUNCA fala direto com o provider e NUNCA vê credenciais da loja.

const BASE = (import.meta.env.VITE_ONPREMISE_API_URL as string | undefined)?.replace(/\/$/, "");

export class OnPremiseApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new OnPremiseApiError(
      0,
      "VITE_ONPREMISE_API_URL não configurado. Defina no .env do front e nos secrets do GitHub Actions.",
    );
  }
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const body = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const msg = (body as { error?: string })?.error ?? `HTTP ${res.status}`;
    throw new OnPremiseApiError(res.status, msg, body);
  }
  return body as T;
}

// ---------- Contratos ----------

import type { PedidoItem, Modalidade, MetodoPagamento } from "@/types/db";

export interface CriarPedidoInput {
  pedido_id: string;                 // UUID gerado no cliente (idempotência)
  loja_id: string;
  loja_slug: string;
  cliente: {
    id: string;
    nome: string;
    telefone: string;
  };
  modalidade: Modalidade;
  endereco?: {
    rua: string; numero: string; bairro: string;
    complemento?: string | null;
    cidade: string; uf: string; cep: string;
  } | null;
  itens: PedidoItem[];
  total_general: number;
  observacao?: string | null;
  metodo_pgto: MetodoPagamento;
  // URL para onde o MP redireciona após o pagamento (tela de acompanhamento)
  return_url: string;
}

export interface CriarPedidoResponse {
  pedido_id: string;
  // Presente somente quando metodo_pgto é online (pix/cartao). Ausente para 'na_entrega'.
  init_point?: string;
  provider_preference_id?: string;
}

export const onPremiseApi = {
  criarPedido: (input: CriarPedidoInput) =>
    request<CriarPedidoResponse>("/api/pedidos", {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
