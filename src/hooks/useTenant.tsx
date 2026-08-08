import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { Loja } from "@/types/db";
import { isPlatformHost, normalizeHost, setCustomDomainMode } from "@/lib/tenant";

interface TenantValue {
  /** Loja resolvida pelo domínio próprio (null no marketplace). */
  loja: Loja | null;
  /** true quando o host é um domínio de lojista. */
  isCustomDomain: boolean;
  /** host normalizado atual */
  host: string;
  isLoading: boolean;
  /** host é customizado mas nenhuma loja foi encontrada */
  naoConfigurado: boolean;
}

const TenantCtx = createContext<TenantValue>({
  loja: null,
  isCustomDomain: false,
  host: "",
  isLoading: false,
  naoConfigurado: false,
});

export function useTenant() {
  return useContext(TenantCtx);
}

async function resolveTenant(host: string): Promise<Loja | null> {
  const { data, error } = await supabase.rpc("resolve_tenant" as never, {
    p_host: host,
    p_slug: null,
  } as never);
  if (error) throw error;
  const rows = (data as unknown as Loja[] | null) ?? [];
  return rows[0] ?? null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const host = normalizeHost(
    typeof window === "undefined" ? "" : window.location.hostname,
  );
  const hostCustomizado = !!host && !isPlatformHost(host);

  const { data, isLoading } = useQuery({
    queryKey: ["tenant", host],
    queryFn: () => resolveTenant(host),
    enabled: hostCustomizado,
    // React Query é a ÚNICA fonte de cache do tenant (sem localStorage).
    staleTime: 5 * 60_000,
    // Resultado negativo não fica preso em cache: lojista recém-configurado
    // precisa ver o domínio funcionar logo após salvar no PDV.
    gcTime: 5 * 60_000,
    retry: 1,
  });

  const loja = (data as Loja | null) ?? null;
  const isCustomDomain = hostCustomizado && !!loja;

  useEffect(() => {
    setCustomDomainMode(isCustomDomain);
  }, [isCustomDomain]);
  // garante o modo correto já no primeiro render da árvore
  setCustomDomainMode(isCustomDomain);

  const value = useMemo<TenantValue>(
    () => ({
      loja,
      isCustomDomain,
      host,
      isLoading: hostCustomizado && isLoading,
      naoConfigurado: hostCustomizado && !isLoading && !loja,
    }),
    [loja, isCustomDomain, host, hostCustomizado, isLoading],
  );

  if (value.isLoading) return <BootSkeleton />;

  return <TenantCtx.Provider value={value}>{children}</TenantCtx.Provider>;
}

function BootSkeleton() {
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisivel(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ background: "#6B21A8" }}
    >
      {visivel && (
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white" />
      )}
    </div>
  );
}
