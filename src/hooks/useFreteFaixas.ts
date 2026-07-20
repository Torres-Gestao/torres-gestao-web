import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { FreteFaixa } from "@/types/db";

export type CalculoFrete =
  | { status: "ok"; valor: number; km: number; faixa: FreteFaixa }
  | { status: "fora_area"; km: number; maiorFaixa: FreteFaixa | null };

export function useFreteFaixas(lojaId: string | undefined) {
  const [faixas, setFaixas] = useState<FreteFaixa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("loja_frete_faixas" as never)
        .select("*")
        .eq("loja_id", lojaId)
        .order("ordem", { ascending: true });
      if (!ativo) return;
      const rows = ((data as unknown) as FreteFaixa[] | null) ?? [];
      // Garante ordenação por km_min como fallback caso ordem seja igual.
      rows.sort(
        (a, b) => a.ordem - b.ordem || Number(a.km_min) - Number(b.km_min),
      );
      setFaixas(rows);
      setLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [lojaId]);

  const maiorFaixa = useMemo<FreteFaixa | null>(() => {
    if (faixas.length === 0) return null;
    return faixas.reduce((acc, f) =>
      Number(f.km_max) > Number(acc.km_max) ? f : acc,
    );
  }, [faixas]);

  function calcularFrete(km: number): CalculoFrete {
    const faixa = faixas.find(
      (f) => km >= Number(f.km_min) && km <= Number(f.km_max),
    );
    if (faixa) {
      return { status: "ok", valor: Number(faixa.valor), km, faixa };
    }
    return { status: "fora_area", km, maiorFaixa };
  }

  return { faixas, loading, calcularFrete, maiorFaixa };
}
