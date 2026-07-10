import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Categoria, Produto } from "@/types/db";

export interface CategoriaComProdutos extends Categoria {
  produtos: Produto[];
}

async function fetchCatalogo(lojaId: string): Promise<CategoriaComProdutos[]> {
  const [catRes, prodRes] = await Promise.all([
    supabase
      .from("categorias")
      .select("*")
      .eq("loja_id", lojaId)
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
    supabase
      .from("produtos")
      .select("*")
      .eq("loja_id", lojaId)
      .eq("ativo", true)
      .order("ordem", { ascending: true }),
  ]);

  if (catRes.error) throw catRes.error;
  if (prodRes.error) throw prodRes.error;

  const categorias = (catRes.data ?? []) as Categoria[];
  const produtos = (prodRes.data ?? []) as Produto[];

  const semCategoria: CategoriaComProdutos[] = [];
  const map = new Map<string, CategoriaComProdutos>();
  for (const c of categorias) map.set(c.id, { ...c, produtos: [] });

  for (const p of produtos) {
    if (p.categoria_id && map.has(p.categoria_id)) {
      map.get(p.categoria_id)!.produtos.push(p);
    } else {
      if (semCategoria.length === 0) {
        semCategoria.push({
          id: "__sem_categoria__",
          loja_id: lojaId,
          pdv_categoria_id: null,
          nome: "Outros",
          ordem: 9999,
          ativo: true,
          created_at: "",
          produtos: [],
        });
      }
      semCategoria[0].produtos.push(p);
    }
  }

  return [...map.values(), ...semCategoria].filter((c) => c.produtos.length > 0);
}

export function useCatalogo(lojaId: string | undefined) {
  return useQuery({
    queryKey: ["catalogo", lojaId],
    queryFn: () => fetchCatalogo(lojaId!),
    enabled: !!lojaId,
    staleTime: 60_000,
  });
}
