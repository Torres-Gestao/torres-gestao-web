import { Routes, Route } from "react-router-dom";
import { CarrinhoProvider } from "@/hooks/useCarrinho";
import Home from "@/pages/Home";
import LojaShell from "@/components/loja/LojaShell";
import Vitrine from "@/pages/Vitrine";
import Carrinho from "@/pages/Carrinho";
import Checkout from "@/pages/Checkout";
import AcompanhamentoPedido from "@/pages/AcompanhamentoPedido";
import NotFound from "@/pages/NotFound";

export default function App() {
  return (
    <CarrinhoProvider>
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
    </CarrinhoProvider>
  );
}
