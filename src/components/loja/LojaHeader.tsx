import type { Loja } from "@/types/db";
import { Store, Phone } from "lucide-react";

export default function LojaHeader({ loja }: { loja: Loja }) {
  const cor = loja.cor_primaria ?? "#6B21A8";
  return (
    <header
      className="relative overflow-hidden text-white"
      style={{
        background: `linear-gradient(135deg, ${cor} 0%, ${loja.cor_secundaria ?? "#111"} 120%)`,
      }}
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-4 px-4 py-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/40">
          {loja.logo_url ? (
            <img src={loja.logo_url} alt={loja.nome} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-8 w-8" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold leading-tight">{loja.nome}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                loja.loja_aberta
                  ? "bg-emerald-500/30 text-emerald-50"
                  : "bg-red-500/30 text-red-50"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  loja.loja_aberta ? "bg-emerald-300" : "bg-red-300"
                }`}
              />
              {loja.loja_aberta ? "Aberto agora" : "Fechado"}
            </span>
            {loja.telefone_contato && (
              <span className="inline-flex items-center gap-1 opacity-90">
                <Phone className="h-3 w-3" /> {loja.telefone_contato}
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
