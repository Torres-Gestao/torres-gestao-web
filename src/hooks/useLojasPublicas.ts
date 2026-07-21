import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LojaPublica } from "@/types/db";

async function fetchLojasPublicas(): Promise<LojaPublica[]> {
  const { data, error } = await supabase
    .from("lojas_publicas" as never)
    .select("*");
  if (error) throw error;
  return ((data as unknown) as LojaPublica[] | null) ?? [];
}

export function useLojasPublicas() {
  return useQuery({
    queryKey: ["lojas_publicas"],
    queryFn: fetchLojasPublicas,
    staleTime: 60_000,
  });
}
