import { Link, useOutletContext, useNavigate } from "react-router-dom";
import type { Loja } from "@/types/db";
import { useCarrinho } from "@/hooks/useCarrinho";
import { brl } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Minus, Plus, Trash2, ArrowLeft } from "lucide-react";

export default function Carrinho() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const navigate = useNavigate();
  const { itens, atualizarQuantidade, remover, subtotal } = useCarrinho();

  if (itens.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Seu carrinho está vazio.</p>
        <Link
          to={`/${loja.slug}`}
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium"
          style={{ color: "var(--brand-primary, #6B21A8)" }}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao cardápio
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/${loja.slug}`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-bold">Seu pedido</h2>
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {itens.map((it) => (
          <li key={it.uid ?? it.produto_id} className="flex items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-medium leading-tight">{it.nome}</p>
              {it.respostas?.map((r) =>
                r.escolhas.length > 0 ? (
                  <p key={r.pergunta_id} className="mt-0.5 text-xs text-muted-foreground">
                    <span className="font-medium">{r.texto}:</span>{" "}
                    {r.escolhas
                      .map((e) => e.nome + (e.preco ? ` (+${brl(e.preco)})` : ""))
                      .join(", ")}
                  </p>
                ) : null,
              )}
              {it.observacao && (
                <p className="mt-0.5 text-xs italic text-muted-foreground">{it.observacao}</p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">{brl(it.preco_unitario)} cada</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => atualizarQuantidade(it.uid ?? "", it.quantidade - 1)}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="w-6 text-center text-sm font-semibold">{it.quantidade}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => atualizarQuantidade(it.uid ?? "", it.quantidade + 1)}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{brl(it.subtotal)}</span>
                <button
                  onClick={() => remover(it.uid ?? "")}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-6 space-y-2 rounded-xl border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium">{brl(subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Taxa de entrega</span>
          <span className="text-xs italic text-muted-foreground">calculada no checkout</span>
        </div>
      </div>

      <Button
        className="mt-6 h-12 w-full text-base"
        style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
        onClick={() => navigate(`/${loja.slug}/checkout`)}
        disabled={!aberta}
      >
        {aberta ? "Continuar para o checkout" : "Loja fechada no momento"}
      </Button>
    </div>
  );
}
