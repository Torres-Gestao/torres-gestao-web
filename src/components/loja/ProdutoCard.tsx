import type { Produto } from "@/types/db";
import { brl } from "@/lib/money";
import { Plus } from "lucide-react";

interface Props {
  produto: Produto;
  onSelecionar: (p: Produto) => void;
}

export default function ProdutoCard({ produto, onSelecionar }: Props) {
  const indisponivel = !produto.disponivel;
  return (
    <button
      type="button"
      onClick={() => !indisponivel && onSelecionar(produto)}
      disabled={indisponivel}
      className="group flex w-full items-stretch gap-3 rounded-xl border bg-card p-3 text-left shadow-sm transition-shadow hover:shadow-md disabled:opacity-50"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-sm font-semibold">{produto.nome}</h3>
        </div>
        {produto.descricao && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{produto.descricao}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span
            className="text-sm font-bold"
            style={{ color: "var(--brand-primary, #6B21A8)" }}
          >
            {brl(Number(produto.preco))}
          </span>
          {indisponivel && (
            <span className="text-[10px] font-medium uppercase text-red-500">
              indisponível
            </span>
          )}
        </div>
      </div>
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {produto.imagem_url ? (
          <img
            src={produto.imagem_url}
            alt={produto.nome}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            sem foto
          </div>
        )}
        {!indisponivel && (
          <span
            className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full text-white shadow-md"
            style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
          >
            <Plus className="h-4 w-4" />
          </span>
        )}
      </div>
    </button>
  );
}
