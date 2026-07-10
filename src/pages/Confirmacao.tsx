import { Link, useLocation, useOutletContext, useParams } from "react-router-dom";
import type { Loja, Pedido } from "@/types/db";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { brl } from "@/lib/money";
import { montarMensagemPedido, whatsappUrl } from "@/lib/whatsapp";

export default function Confirmacao() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const { numero } = useParams<{ numero: string }>();
  const location = useLocation();
  const pedido = (location.state as { pedido?: Pedido } | null)?.pedido ?? null;

  return (
    <div className="py-8 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
        <CheckCircle2 className="h-9 w-9" />
      </div>
      <h1 className="mt-4 text-2xl font-bold">Pedido enviado!</h1>
      <p className="mt-1 text-muted-foreground">
        Pedido <span className="font-semibold">#{numero}</span> registrado.
      </p>

      {pedido && (
        <div className="mx-auto mt-6 max-w-sm space-y-2 rounded-xl border bg-card p-4 text-left text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="font-bold">{brl(pedido.total_general)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Modalidade</span>
            <span>{pedido.modalidade === "delivery" ? "Entrega" : "Retirada"}</span>
          </div>
        </div>
      )}

      <p className="mt-6 text-sm text-muted-foreground">
        Confirme o recebimento com a loja pelo WhatsApp:
      </p>

      {loja.telefone_contato && pedido && (
        <a
          href={whatsappUrl(loja.telefone_contato, montarMensagemPedido(pedido, loja.nome))}
          target="_blank"
          rel="noopener"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-white shadow-md hover:bg-emerald-600"
        >
          <MessageCircle className="h-5 w-5" />
          Abrir WhatsApp
        </a>
      )}

      <div className="mt-8">
        <Link to={`/${loja.slug}`} className="text-sm underline">
          Fazer outro pedido
        </Link>
      </div>
    </div>
  );
}
