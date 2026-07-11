import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { PedidoItem, Produto, RespostaSelecionada } from "@/types/db";

interface CarrinhoLoja {
  slug: string;
  itens: PedidoItem[];
}

interface AdicionarExtras {
  observacao?: string;
  respostas?: RespostaSelecionada[];
}

interface CarrinhoContextValue {
  slug: string | null;
  itens: PedidoItem[];
  setSlug: (slug: string) => void;
  adicionar: (produto: Produto, quantidade: number, extras?: AdicionarExtras) => void;
  atualizarQuantidade: (uid: string, quantidade: number) => void;
  remover: (uid: string) => void;
  limpar: () => void;
  quantidadeTotal: number;
  subtotal: number;
}

const CarrinhoContext = createContext<CarrinhoContextValue | null>(null);

const STORAGE_KEY = "cardapio-carrinho-v1";

// Soma dos adicionais escolhidos (respostas do tipo produto com preço).
function totalAdicionais(respostas?: RespostaSelecionada[]): number {
  if (!respostas) return 0;
  return respostas.reduce(
    (acc, r) => acc + r.escolhas.reduce((s, e) => s + (Number(e.preco) || 0), 0),
    0,
  );
}

// Assinatura para agrupar linhas idênticas (mesmo produto + mesmas respostas).
function assinatura(produtoId: string, extras?: AdicionarExtras): string {
  return JSON.stringify({
    p: produtoId,
    o: extras?.observacao ?? "",
    r: (extras?.respostas ?? []).map((x) => ({
      q: x.pergunta_id,
      e: x.escolhas.map((c) => c.nome).sort(),
    })),
  });
}

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
    (produto: Produto, quantidade: number, extras?: AdicionarExtras) => {
      if (quantidade <= 0) return;
      const precoUnitario = Number(
        (Number(produto.preco) + totalAdicionais(extras?.respostas)).toFixed(2),
      );
      const sig = assinatura(produto.id, extras);
      setState((prev) => {
        const base: CarrinhoLoja = prev ?? { slug: "", itens: [] };
        const existente = base.itens.find(
          (i) => assinatura(i.produto_id, { observacao: i.observacao, respostas: i.respostas }) === sig,
        );
        let itens: PedidoItem[];
        if (existente) {
          itens = base.itens.map((i) =>
            i === existente
              ? {
                  ...i,
                  quantidade: i.quantidade + quantidade,
                  subtotal: Number(((i.quantidade + quantidade) * i.preco_unitario).toFixed(2)),
                }
              : i,
          );
        } else {
          itens = [
            ...base.itens,
            {
              uid: crypto.randomUUID(),
              produto_id: produto.id,
              nome: produto.nome,
              quantidade,
              preco_unitario: precoUnitario,
              subtotal: Number((quantidade * precoUnitario).toFixed(2)),
              observacao: extras?.observacao,
              respostas: extras?.respostas,
            },
          ];
        }
        return { ...base, itens };
      });
    },
    [],
  );

  const atualizarQuantidade = useCallback((uid: string, quantidade: number) => {
    setState((prev) => {
      if (!prev) return prev;
      if (quantidade <= 0) {
        return { ...prev, itens: prev.itens.filter((i) => i.uid !== uid) };
      }
      return {
        ...prev,
        itens: prev.itens.map((i) =>
          i.uid === uid
            ? { ...i, quantidade, subtotal: Number((quantidade * i.preco_unitario).toFixed(2)) }
            : i,
        ),
      };
    });
  }, []);

  const remover = useCallback((uid: string) => {
    setState((prev) =>
      prev ? { ...prev, itens: prev.itens.filter((i) => i.uid !== uid) } : prev,
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
