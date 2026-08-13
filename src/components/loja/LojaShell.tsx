import { Outlet, useNavigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { useLoja } from "@/hooks/useLoja";
import { useTenant } from "@/hooks/useTenant";
import { useCarrinho } from "@/hooks/useCarrinho";
import LojaHeader from "./LojaHeader";
import FloatingCart from "./FloatingCart";
import InstalarAppBanner from "./InstalarAppBanner";
import { aplicarManifestDaLoja } from "@/lib/pwa-manifest";
import { Loader2 } from "lucide-react";

export default function LojaShell() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { loja: lojaTenant, isCustomDomain } = useTenant();
  // No domínio próprio a loja já veio do resolve_tenant; não refaz o fetch.
  const {
    data: lojaSlug,
    isLoading,
    isError,
  } = useLoja(isCustomDomain ? undefined : slug);
  const loja = isCustomDomain ? lojaTenant : (lojaSlug ?? null);
  const { setSlug } = useCarrinho();

  useEffect(() => {
    if (loja?.slug) setSlug(loja.slug);
  }, [loja?.slug, setSlug]);

  // Manifest PWA por loja: instala com nome, logo e cor da loja acessada.
  useEffect(() => {
    if (!loja) return;
    aplicarManifestDaLoja({
      nome: loja.nome,
      slug: loja.slug,
      logoUrl: loja.logo_url,
      corPrimaria: loja.cor_primaria,
      dominioProprio: isCustomDomain,
    });
  }, [loja, isCustomDomain]);

  if (!isCustomDomain && isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !loja) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold">Loja não encontrada</h1>
        <p className="mt-2 text-muted-foreground">
          O endereço <code className="rounded bg-muted px-1">/{slug}</code> não corresponde a
          nenhuma loja ativa.
        </p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <LojaHeader loja={loja} />
      <main className="mx-auto w-full max-w-5xl px-4 pt-4">
        <Outlet context={{ loja }} />
      </main>
      <FloatingCart slug={loja.slug} />
    </div>
  );
}
