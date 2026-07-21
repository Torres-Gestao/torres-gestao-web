import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, MapPin, Loader2, X } from "lucide-react";
import BuscaLojas from "@/components/marketplace/BuscaLojas";
import LojaCard from "@/components/marketplace/LojaCard";
import { useLojasPublicas } from "@/hooks/useLojasPublicas";
import { useGeoloc } from "@/lib/geo";
import { normalizarBusca } from "@/lib/normalize";
import { haversineKm } from "@/lib/mapbox";
import type { LojaPublica } from "@/types/db";

interface LojaComDistancia extends LojaPublica {
  distanciaKm: number | null;
  dentroDoRaio: boolean;
  temEntrega: boolean;
}

export default function Home() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [mostrarRetirada, setMostrarRetirada] = useState(false);
  const { data: lojas, isLoading, isError } = useLojasPublicas();
  const { coords, status: geoStatus, pedir, limpar } = useGeoloc();

  const enriquecidas = useMemo<LojaComDistancia[]>(() => {
    const arr = lojas ?? [];
    return arr.map((l) => {
      const temCoords = l.latitude != null && l.longitude != null;
      const temEntrega =
        !!l.frete_ativo && temCoords && Number(l.raio_max_km ?? 0) > 0;
      let distanciaKm: number | null = null;
      if (coords && temCoords) {
        distanciaKm = haversineKm(coords, {
          lat: Number(l.latitude),
          lng: Number(l.longitude),
        });
      }
      const dentroDoRaio =
        temEntrega &&
        distanciaKm != null &&
        distanciaKm <= Number(l.raio_max_km ?? 0);
      return { ...l, distanciaKm, dentroDoRaio, temEntrega };
    });
  }, [lojas, coords]);

  const filtradas = useMemo(() => {
    const termo = normalizarBusca(busca);
    if (!termo) return enriquecidas;
    return enriquecidas.filter((l) =>
      normalizarBusca(l.nome).includes(termo) ||
      normalizarBusca(l.slug).includes(termo),
    );
  }, [enriquecidas, busca]);

  // Grupos: entrega perto (se geo) e somente retirada / fora do raio.
  const { entregam, retirada } = useMemo(() => {
    if (!coords) {
      // Sem geolocation: mostra todas as com entrega em "entregam" e as sem entrega em "retirada"
      return {
        entregam: filtradas.filter((l) => l.temEntrega),
        retirada: filtradas.filter((l) => !l.temEntrega),
      };
    }
    const entregam = filtradas
      .filter((l) => l.dentroDoRaio)
      .sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0));
    const retirada = filtradas.filter((l) => !l.dentroDoRaio);
    return { entregam, retirada };
  }, [filtradas, coords]);

  const podeSubmit = () => {
    // Se busca casa exatamente 1 loja, navega direto.
    const termo = normalizarBusca(busca);
    if (!termo) return;
    const match = filtradas.find(
      (l) =>
        normalizarBusca(l.nome) === termo || normalizarBusca(l.slug) === termo,
    );
    if (match) {
      navigate(`/${match.slug}`);
      return;
    }
    if (filtradas.length === 1) navigate(`/${filtradas[0].slug}`);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-gradient-to-br from-purple-800 via-purple-700 to-fuchsia-600 px-4 pb-8 pt-10 text-white">
        <div className="mx-auto w-full max-w-5xl">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/30">
              <Store className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-bold">Cardápio Digital</h1>
          </div>
          <p className="mt-2 text-sm opacity-80">
            Escolha uma loja para ver o cardápio.
          </p>
          <div className="mt-5">
            <BuscaLojas value={busca} onChange={setBusca} onSubmit={podeSubmit} />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {coords ? (
              <button
                onClick={limpar}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 hover:bg-white/25"
              >
                <MapPin className="h-3 w-3" /> Localização ativa
                <X className="ml-1 h-3 w-3" />
              </button>
            ) : (
              <button
                onClick={pedir}
                disabled={geoStatus === "loading"}
                className="inline-flex items-center gap-1 rounded-full bg-yellow-400 px-3 py-1 font-medium text-black hover:bg-yellow-300 disabled:opacity-70"
              >
                {geoStatus === "loading" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <MapPin className="h-3 w-3" />
                )}
                Usar minha localização
              </button>
            )}
            {geoStatus === "denied" && (
              <span className="opacity-80">Permissão negada.</span>
            )}
            {geoStatus === "unavailable" && (
              <span className="opacity-80">Geolocalização indisponível.</span>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        {isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-neutral-400" />
          </div>
        )}
        {isError && (
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            Não consegui carregar as lojas. Tente novamente em instantes.
          </p>
        )}

        {!isLoading && !isError && (
          <>
            {!coords && (
              <p className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                Ative a localização para ver quem entrega no seu endereço.
              </p>
            )}

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {coords ? "Lojas perto de você" : "Lojas com entrega"}
              </h2>
              {entregam.length === 0 ? (
                <p className="rounded-lg bg-white p-6 text-center text-sm text-neutral-500 ring-1 ring-black/5">
                  {coords
                    ? "Nenhuma loja entrega no seu endereço."
                    : "Nenhuma loja com entrega ativa."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {entregam.map((l) => (
                    <LojaCard
                      key={l.id}
                      loja={l}
                      distanciaKm={l.distanciaKm}
                      onClick={() => navigate(`/${l.slug}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            {retirada.length > 0 && (
              <section className="mt-8">
                <button
                  onClick={() => setMostrarRetirada((v) => !v)}
                  className="mb-3 flex w-full items-center justify-between text-left"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
                    {coords ? "Somente retirada / fora do raio" : "Somente retirada"}
                    <span className="ml-2 text-xs font-normal text-neutral-400">
                      ({retirada.length})
                    </span>
                  </h2>
                  <span className="text-xs text-neutral-500">
                    {mostrarRetirada ? "Ocultar" : "Mostrar"}
                  </span>
                </button>
                {mostrarRetirada && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {retirada.map((l) => (
                      <LojaCard
                        key={l.id}
                        loja={l}
                        distanciaKm={l.distanciaKm}
                        onClick={() => navigate(`/${l.slug}`)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
