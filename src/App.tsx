import { Routes, Route } from "react-router-dom";
import { CarrinhoProvider } from "@/hooks/useCarrinho";
import { useTracking } from "@/hooks/useTracking";
import { useTenant } from "@/hooks/useTenant";
import Home from "@/pages/Home";
import LojaShell from "@/components/loja/LojaShell";
import Vitrine from "@/pages/Vitrine";
import Carrinho from "@/pages/Carrinho";
import Checkout from "@/pages/Checkout";
import AcompanhamentoPedido from "@/pages/AcompanhamentoPedido";
import NotFound from "@/pages/NotFound";

function DominioNaoConfigurado({ host }: { host: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-bold">Domínio não configurado</h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        O endereço <code className="rounded bg-muted px-1">{host}</code> ainda não está
        vinculado a nenhuma loja. Se você acabou de configurá-lo no sistema, aguarde alguns
        instantes e atualize a página.
      </p>
    </div>
  );
}

export default function App() {
  useTracking();
  const { isCustomDomain, naoConfigurado, host } = useTenant();

  if (naoConfigurado) return <DominioNaoConfigurado host={host} />;

  return (
    <CarrinhoProvider>
      {isCustomDomain ? (
        <Routes>
          <Route path="/" element={<LojaShell />}>
            <Route index element={<Vitrine />} />
            <Route path="carrinho" element={<Carrinho />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pedido/:id" element={<AcompanhamentoPedido />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/:slug" element={<LojaShell />}>
            <Route index element={<Vitrine />} />
            <Route path="carrinho" element={<Carrinho />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pedido/:id" element={<AcompanhamentoPedido />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      )}
    </CarrinhoProvider>
  );
}
