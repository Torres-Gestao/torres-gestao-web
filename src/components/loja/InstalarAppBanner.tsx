import { useInstalarApp } from "@/hooks/useInstalarApp";
import { Download, Share, X } from "lucide-react";
import type { Loja } from "@/types/db";

export default function InstalarAppBanner({ loja }: { loja: Loja }) {
  const cor = loja.cor_primaria ?? "#6B21A8";
  const { podeMostrar, ios, instalar, dispensar } = useInstalarApp(loja.slug);

  if (!podeMostrar) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-4">
      <div
        className="mx-auto flex w-full max-w-3xl items-center gap-3 rounded-2xl px-4 py-3 text-white shadow-lg"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, #111 160%)` }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/30">
          {loja.logo_url ? (
            <img
              src={loja.logo_url}
              alt={`Logo de ${loja.nome}`}
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Download className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Instalar o app da {loja.nome}</p>
          <p className="truncate text-xs opacity-85">
            {ios
              ? "Toque em Compartilhar e em “Adicionar à Tela de Início”."
              : "Peça mais rápido, direto da tela inicial."}
          </p>
        </div>
        {!ios && (
          <button
            onClick={() => void instalar()}
            className="shrink-0 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-900"
          >
            Instalar
          </button>
        )}
        {ios && <Share className="h-5 w-5 shrink-0 opacity-90" />}
        <button
          onClick={dispensar}
          aria-label="Agora não"
          className="shrink-0 rounded-full p-1.5 hover:bg-white/15"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
