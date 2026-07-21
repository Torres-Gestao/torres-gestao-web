import { Store, MapPin } from "lucide-react";
import type { LojaPublica } from "@/types/db";
import { isLojaAberta } from "@/lib/loja-status";

interface Props {
  loja: LojaPublica;
  distanciaKm?: number | null;
  onClick: () => void;
}

export default function LojaCard({ loja, distanciaKm, onClick }: Props) {
  const aberta = isLojaAberta(loja);
  const cor = loja.cor_primaria ?? "#6B21A8";
  return (
    <button
      onClick={onClick}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white text-left shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div
        className="relative flex h-24 items-center justify-center"
        style={{ background: `linear-gradient(135deg, ${cor} 0%, ${loja.cor_secundaria ?? "#111"} 120%)` }}
      >
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-white/15 ring-2 ring-white/40">
          {loja.logo_url ? (
            <img src={loja.logo_url} alt={loja.nome} className="h-full w-full object-cover" />
          ) : (
            <Store className="h-7 w-7 text-white" />
          )}
        </div>
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
            aberta ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
          }`}
        >
          {aberta ? "Aberto" : "Fechado"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="truncate text-sm font-semibold text-neutral-900">{loja.nome}</h3>
        {distanciaKm != null ? (
          <p className="flex items-center gap-1 text-xs text-neutral-500">
            <MapPin className="h-3 w-3" />
            {distanciaKm < 1
              ? `${Math.round(distanciaKm * 1000)} m`
              : `${distanciaKm.toFixed(1)} km`}
          </p>
        ) : (
          <p className="text-xs text-neutral-400">Ver cardápio</p>
        )}
      </div>
    </button>
  );
}
