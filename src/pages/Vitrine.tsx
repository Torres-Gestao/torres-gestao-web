import { useEffect, useMemo, useRef, useState } from "react";
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
  const [ativa, setAtiva] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

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

  useEffect(() => {
    if (!filtradas.length) return;
    if (!ativa || !filtradas.find((c) => c.id === ativa)) {
      setAtiva(filtradas[0].id);
    }
  }, [filtradas, ativa]);

  // Destaca categoria conforme scroll
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    filtradas.forEach((cat) => {
      const el = sectionRefs.current[cat.id];
      if (!el) return;
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setAtiva(cat.id);
          });
        },
        { rootMargin: "-40% 0px -55% 0px", threshold: 0 },
      );
      io.observe(el);
      observers.push(io);
    });
    return () => observers.forEach((o) => o.disconnect());
  }, [filtradas]);

  function irPara(id: string) {
    const el = sectionRefs.current[id];
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 120;
    window.scrollTo({ top, behavior: "smooth" });
    setAtiva(id);
  }

  const brand = "var(--brand-primary, #6B21A8)";

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

        {/* Nav horizontal (mobile) */}
        {filtradas.length > 0 && (
          <div className="mt-3 -mx-4 overflow-x-auto md:hidden">
            <div className="flex gap-2 px-4">
              {filtradas.map((c) => {
                const isActive = ativa === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => irPara(c.id)}
                    className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition"
                    style={
                      isActive
                        ? { backgroundColor: brand, color: "#fff", borderColor: brand }
                        : undefined
                    }
                  >
                    {c.nome}
                  </button>
                );
              })}
            </div>
          </div>
        )}
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

      {/* Layout com coluna lateral em md+ */}
      <div className="grid gap-6 pt-4 md:grid-cols-[200px_1fr]">
        {/* Coluna de navegação (desktop) */}
        {filtradas.length > 0 && (
          <aside className="hidden md:block">
            <nav className="sticky top-24 space-y-1">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Categorias
              </p>
              {filtradas.map((c) => {
                const isActive = ativa === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => irPara(c.id)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition hover:bg-muted"
                    style={
                      isActive
                        ? {
                            backgroundColor: `color-mix(in oklab, ${brand} 10%, transparent)`,
                            color: brand,
                            fontWeight: 600,
                          }
                        : undefined
                    }
                  >
                    <span className="truncate">{c.nome}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      {c.produtos.length}
                    </span>
                  </button>
                );
              })}
            </nav>
          </aside>
        )}

        <div className="min-w-0 space-y-8 pb-4">
          {filtradas.map((cat) => (
            <section
              key={cat.id}
              id={`cat-${cat.id}`}
              ref={(el) => {
                sectionRefs.current[cat.id] = el;
              }}
              className="scroll-mt-32"
            >
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
      </div>

      <ProdutoModal produto={selecionado} onClose={() => setSelecionado(null)} />
    </div>
  );
}
