import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";
import { useCarrinho } from "@/hooks/useCarrinho";
import { brl } from "@/lib/money";

export default function FloatingCart({ slug }: { slug: string }) {
  const { quantidadeTotal, subtotal } = useCarrinho();
  if (quantidadeTotal === 0) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <Link
        to={`/${slug}/carrinho`}
        className="mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-xl px-4 py-3 text-white shadow-lg transition-transform active:scale-[0.98]"
        style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
      >
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingBag className="h-5 w-5" />
            <span className="absolute -right-2 -top-2 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[11px] font-bold text-black">
              {quantidadeTotal}
            </span>
          </div>
          <span className="font-semibold">Ver carrinho</span>
        </div>
        <span className="font-bold">{brl(subtotal)}</span>
      </Link>
    </div>
  );
}
