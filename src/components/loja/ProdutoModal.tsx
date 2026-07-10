import { useEffect, useState } from "react";
import type { Produto } from "@/types/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Minus, Plus } from "lucide-react";
import { brl } from "@/lib/money";
import { useCarrinho } from "@/hooks/useCarrinho";
import { toast } from "sonner";

interface Props {
  produto: Produto | null;
  onClose: () => void;
}

export default function ProdutoModal({ produto, onClose }: Props) {
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  const { adicionar } = useCarrinho();

  useEffect(() => {
    setQuantidade(1);
    setObservacao("");
  }, [produto?.id]);

  if (!produto) return null;
  const total = Number((quantidade * Number(produto.preco)).toFixed(2));

  return (
    <Dialog open={!!produto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        {produto.imagem_url && (
          <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
            <img
              src={produto.imagem_url}
              alt={produto.nome}
              className="h-full w-full object-cover"
            />
          </div>
        )}
        <div className="space-y-4 p-5">
          <DialogHeader>
            <DialogTitle className="text-lg">{produto.nome}</DialogTitle>
          </DialogHeader>
          {produto.descricao && (
            <p className="text-sm text-muted-foreground">{produto.descricao}</p>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium">Observação (opcional)</label>
            <Textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex.: sem cebola, ponto da carne..."
              rows={2}
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-semibold">{quantidade}</span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setQuantidade((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button
              type="button"
              className="flex-1 ml-4"
              style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
              onClick={() => {
                adicionar(produto, quantidade, observacao || undefined);
                toast.success(`${quantidade}x ${produto.nome} adicionado`);
                onClose();
              }}
            >
              Adicionar · {brl(total)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
