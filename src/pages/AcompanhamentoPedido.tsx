import { useEffect, useRef, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import type { Loja, Pedido } from "@/types/db";
import { brl } from "@/lib/money";
import {
  CheckCircle2,
  Clock,
  ChefHat,
  Package,
  Bike,
  PartyPopper,
  XCircle,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Step {
  key: string;
  label: string;
  descricao: string;
  icon: LucideIcon;
}

const STEPS: Step[] = [
  { key: "pendente",   label: "Pedido recebido",  descricao: "Aguardando confirmação da loja", icon: Clock },
  { key: "confirmado", label: "Pedido aceito",    descricao: "A loja confirmou seu pedido",     icon: CheckCircle2 },
  { key: "em_preparo", label: "Em preparo",       descricao: "Seu pedido está sendo preparado", icon: ChefHat },
  { key: "pronto",     label: "Pronto",           descricao: "Pronto para retirada/envio",      icon: Package },
  { key: "em_rota",    label: "Saiu para entrega", descricao: "A caminho do endereço",          icon: Bike },
  { key: "entregue",   label: "Concluído",        descricao: "Pedido entregue. Bom apetite!",   icon: PartyPopper },
];

function stepIndex(status: string): number {
  const i = STEPS.findIndex((s) => s.key === status);
  return i === -1 ? 0 : i;
}

export default function AcompanhamentoPedido() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const { id } = useParams<{ id: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const pedidoRef = useRef<Pedido | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    pedidoRef.current = pedido;
  }, [pedido]);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    let falhasConsecutivas = 0;

    async function carregar(inicial: boolean) {
      // Leitura restrita: a função só retorna o pedido correspondente ao id,
      // então o cliente final vê apenas o próprio pedido.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_pedido", { p_id: id });
      if (!ativo) return;
      if (error) {
        falhasConsecutivas += 1;
        if (!pedidoRef.current && falhasConsecutivas >= 2) {
          setErro("Não foi possível consultar o pedido agora. Tentando novamente...");
        }
      } else {
        falhasConsecutivas = 0;
        setErro(null);
        setPedido(((data as Pedido[] | null) ?? [])[0] ?? null);
      }
      if (inicial) setLoading(false);
    }

    carregar(true);
    // Sem SELECT direto na tabela não há realtime público; usamos polling.
    const intervalo = setInterval(() => carregar(false), 8000);

    return () => {
      ativo = false;
      clearInterval(intervalo);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">{erro ?? "Pedido não encontrado."}</p>
        <Link to={`/${loja.slug}`} className="mt-4 inline-block text-sm underline">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  // O sistema on-premise atualiza o campo status_web, que é a única fonte
  // do status exibido.
  const statusAtual = pedido.status_web ?? "";
  const cancelado = statusAtual === "cancelado";
  const atual = stepIndex(statusAtual);
  const brand = "var(--brand-primary, #6B21A8)";

  return (
    <div className="py-6">
      <div className="mb-6 flex items-center gap-2">
        <Link to={`/${loja.slug}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Pedido #{pedido.numero_pedido}
          </p>
          <h1 className="text-xl font-bold">Acompanhamento</h1>
        </div>
      </div>

      {cancelado ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <XCircle className="h-10 w-10 text-red-500" />
          <p className="font-semibold text-red-700">Pedido cancelado</p>
          <p className="text-sm text-red-600">Entre em contato com a loja para mais detalhes.</p>
        </div>
      ) : (
        <ol className="relative ml-3 border-l-2 border-muted pl-6">
          {STEPS.map((step, i) => {
            const done = i < atual;
            const active = i === atual;
            const Icon = step.icon;
            return (
              <li key={step.key} className="relative pb-7 last:pb-0">
                <span
                  className="absolute -left-[34px] flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background transition-colors"
                  style={{
                    backgroundColor: done || active ? brand : "hsl(var(--muted))",
                    color: done || active ? "#fff" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {active ? (
                    <span className="relative flex h-3 w-3">
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                        style={{ backgroundColor: "#fff" }}
                      />
                      <Icon className="h-4 w-4" />
                    </span>
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </span>
                <div
                  className={`rounded-lg border p-3 transition ${
                    active ? "border-transparent shadow-sm" : "bg-card"
                  }`}
                  style={active ? { backgroundColor: "color-mix(in oklab, " + brand + " 8%, transparent)", borderColor: brand } : undefined}
                >
                  <p className={`font-semibold ${active ? "" : done ? "" : "text-muted-foreground"}`}>
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground">{step.descricao}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {erro && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {erro}
        </div>
      )}

      {pedido.metodo_pgto && pedido.metodo_pgto !== "na_entrega" && (
        <div className="mt-6 rounded-xl border bg-card p-4">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pagamento
          </h2>
          {pedido.status_pgto === "aprovado" ? (
            <p className="text-sm font-medium text-green-600">✓ Pagamento aprovado</p>
          ) : pedido.status_pgto === "recusado" || pedido.status_pgto === "cancelado" ? (
            <p className="text-sm font-medium text-red-600">Pagamento não realizado</p>
          ) : pedido.status_pgto === "em_processo" ? (
            <p className="text-sm text-muted-foreground">Processando pagamento...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Pagamento pendente.</p>
              {pedido.provider_preference_id && (
                <a
                  href={`https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${pedido.provider_preference_id}`}
                  className="inline-block rounded-md px-4 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: brand }}
                >
                  Pagar agora
                </a>
              )}
            </div>
          )}
        </div>
      )}


      <div className="mt-8 rounded-xl border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Resumo
        </h2>
        <ul className="space-y-2 text-sm">
          {pedido.itens.map((it, i) => (
            <li key={i}>
              <div className="flex justify-between">
                <span>
                  {it.quantidade}x {it.nome}
                </span>
                <span>{brl(it.subtotal)}</span>
              </div>
              {it.respostas?.map((r) =>
                r.escolhas.length > 0 ? (
                  <p key={r.pergunta_id} className="pl-4 text-xs text-muted-foreground">
                    {r.texto}: {r.escolhas.map((e) => e.nome).join(", ")}
                  </p>
                ) : null,
              )}
              {it.observacao && (
                <p className="pl-4 text-xs italic text-muted-foreground">{it.observacao}</p>
              )}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-bold">
          <span>Total</span>
          <span>{brl(pedido.total_general)}</span>
        </div>
      </div>

      <div className="mt-6 text-center">
        <Link to={`/${loja.slug}`} className="text-sm underline">
          Voltar ao cardápio
        </Link>
      </div>
    </div>
  );
}
