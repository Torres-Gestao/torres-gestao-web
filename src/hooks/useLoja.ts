import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Loja } from "@/types/db";
import { useEffect } from "react";

async function fetchLoja(slug: string): Promise<Loja | null> {
  const { data, error } = await supabase
    .from("lojas")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return (data as Loja | null) ?? null;
}

export function useLoja(slug: string | undefined) {
  const query = useQuery({
    queryKey: ["loja", slug],
    queryFn: () => fetchLoja(slug!),
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });

  // Aplica cores da loja como variáveis CSS
  useEffect(() => {
    const loja = query.data;
    if (!loja) return;
    const root = document.documentElement;
    if (loja.cor_primaria) root.style.setProperty("--brand-primary", loja.cor_primaria);
    if (loja.cor_secundaria) root.style.setProperty("--brand-secondary", loja.cor_secundaria);
    return () => {
      root.style.removeProperty("--brand-primary");
      root.style.removeProperty("--brand-secondary");
    };
  }, [query.data]);

  return query;
}
