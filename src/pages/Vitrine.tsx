import { useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";
import type { Loja, Produto } from "@/types/db";
import { useCatalogo } from "@/hooks/useProdutos";
import ProdutoCard from "@/components/loja/ProdutoCard";
import ProdutoModal from "@/components/loja/ProdutoModal";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";

export default function Vitrine() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const { data: categorias, isLoading } = useCatalogo(loja.id);
  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Produto | null>(null);

  const filtradas = useMemo(() => {
    if (!categorias) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return categorias;
    return categorias
      .map((c) => ({
        ...c,
        produtos: c.produtos.filter(
          (p) =>
            p.nome.toLowerCase().includes(q) ||
            (p.descricao ?? "").toLowerCase().includes(q),
        ),
      }))
      .filter((c) => c.produtos.length > 0);
  }, [categorias, busca]);

  return (
    <div>
      <div className="sticky top-0 z-30 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar no cardápio..."
            className="pl-9"
          />
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && filtradas.length === 0 && (
        <div className="py-16 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado.
        </div>
      )}

      <div className="space-y-8 py-4">
        {filtradas.map((cat) => (
          <section key={cat.id}>
            <h2 className="mb-3 text-base font-bold uppercase tracking-wide text-muted-foreground">
              {cat.nome}
            </h2>
            <div className="grid gap-3">
              {cat.produtos.map((p) => (
                <ProdutoCard key={p.id} produto={p} onSelecionar={setSelecionado} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <ProdutoModal produto={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
