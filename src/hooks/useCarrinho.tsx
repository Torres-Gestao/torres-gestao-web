import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PedidoItem, Produto } from "@/types/db";

interface CarrinhoLoja {
  slug: string;
  itens: PedidoItem[];
}

interface CarrinhoContextValue {
  slug: string | null;
  itens: PedidoItem[];
  setSlug: (slug: string) => void;
  adicionar: (produto: Produto, quantidade: number, observacao?: string) => void;
  atualizarQuantidade: (produtoId: string, quantidade: number) => void;
  remover: (produtoId: string) => void;
  limpar: () => void;
  quantidadeTotal: number;
  subtotal: number;
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null);

const STORAGE_KEY = "cardapio-carrinho-v1";

function readStorage(): CarrinhoLoja | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CarrinhoLoja) : null;
  } catch {
    return null;
  }
}

function writeStorage(data: CarrinhoLoja | null) {
  if (typeof window === "undefined") return;
  try {
    if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function CarrinhoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CarrinhoLoja | null>(null);

  useEffect(() => {
    setState(readStorage());
  }, []);

  useEffect(() => {
    writeStorage(state);
  }, [state]);

  const setSlug = useCallback((slug: string) => {
    setState((prev) => {
      if (prev && prev.slug === slug) return prev;
      // Troca de loja limpa o carrinho
      return { slug, itens: [] };
    });
  }, []);

  const adicionar = useCallback(
    (produto: Produto, quantidade: number, observacao?: string) => {
      if (quantidade <= 0) return;
      setState((prev) => {
        const base: CarrinhoLoja = prev ?? { slug: "", itens: [] };
        const existente = base.itens.find((i) => i.produto_id === produto.id);
        let itens: PedidoItem[];
        if (existente) {
          itens = base.itens.map((i) =>
            i.produto_id === produto.id
              ? {
                  ...i,
                  quantidade: i.quantidade + quantidade,
                  subtotal: Number(((i.quantidade + quantidade) * i.preco_unitario).toFixed(2)),
                  observacao: observacao ?? i.observacao,
                }
              : i,
          );
        } else {
          itens = [
            ...base.itens,
            {
              produto_id: produto.id,
              nome: produto.nome,
              quantidade,
              preco_unitario: Number(produto.preco),
              subtotal: Number((quantidade * Number(produto.preco)).toFixed(2)),
              observacao,
            },
          ];
        }
        return { ...base, itens };
      });
    },
    [],
  );

  const atualizarQuantidade = useCallback((produtoId: string, quantidade: number) => {
    setState((prev) => {
      if (!prev) return prev;
      if (quantidade <= 0) {
        return { ...prev, itens: prev.itens.filter((i) => i.produto_id !== produtoId) };
      }
      return {
        ...prev,
        itens: prev.itens.map((i) =>
          i.produto_id === produtoId
            ? { ...i, quantidade, subtotal: Number((quantidade * i.preco_unitario).toFixed(2)) }
            : i,
        ),
      };
    });
  }, []);

  const remover = useCallback((produtoId: string) => {
    setState((prev) =>
      prev ? { ...prev, itens: prev.itens.filter((i) => i.produto_id !== produtoId) } : prev,
    );
  }, []);

  const limpar = useCallback(() => {
    setState((prev) => (prev ? { ...prev, itens: [] } : prev));
  }, []);

  const value = useMemo<CarrinhoContextValue>(() => {
    const itens = state?.itens ?? [];
    const quantidadeTotal = itens.reduce((acc, i) => acc + i.quantidade, 0);
    const subtotal = Number(itens.reduce((acc, i) => acc + i.subtotal, 0).toFixed(2));
    return {
      slug: state?.slug ?? null,
      itens,
      setSlug,
      adicionar,
      atualizarQuantidade,
      remover,
      limpar,
      quantidadeTotal,
      subtotal,
    };
  }, [state, setSlug, adicionar, atualizarQuantidade, remover, limpar]);

  return <CarrinhoContext.Provider value={value}>{children}</CarrinhoContext.Provider>;
}

export function useCarrinho() {
  const ctx = useContext(CarrinhoContext);
  if (!ctx) throw new Error("useCarrinho precisa estar dentro do CarrinhoProvider");
  return ctx;
}
