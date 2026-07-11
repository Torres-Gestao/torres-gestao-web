import { useEffect, useMemo, useState } from "react";
import type { Produto, RespostaSelecionada } from "@/types/db";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Minus, Plus } from "lucide-react";
import { brl } from "@/lib/money";
import { useCarrinho } from "@/hooks/useCarrinho";
import { usePerguntas } from "@/hooks/useProdutos";
import { opcoesAtivas, perguntasDoProduto } from "@/lib/perguntas";
import { toast } from "sonner";

interface Props {
  produto: Produto | null;
  onClose: () => void;
}

export default function ProdutoModal({ produto, onClose }: Props) {
  const [quantidade, setQuantidade] = useState(1);
  const [observacao, setObservacao] = useState("");
  // seleções por pergunta: { [perguntaId]: nomes[] }
  const [selecoes, setSelecoes] = useState<Record<string, string[]>>({});
  const { adicionar } = useCarrinho();
  const { data: perguntas } = usePerguntas(produto?.loja_id);

  const perguntasProduto = useMemo(
    () => (produto ? perguntasDoProduto(perguntas, produto) : []),
    [perguntas, produto],
  );

  useEffect(() => {
    setQuantidade(1);
    setObservacao("");
    setSelecoes({});
  }, [produto?.id]);

  const adicionalTotal = useMemo(() => {
    let soma = 0;
    for (const p of perguntasProduto) {
      const opts = opcoesAtivas(p);
      for (const nome of selecoes[p.id] ?? []) {
        soma += opts.find((o) => o.nome === nome)?.preco ?? 0;
      }
    }
    return soma;
  }, [perguntasProduto, selecoes]);

  if (!produto) return null;

  const minimoDe = (p: (typeof perguntasProduto)[number]) =>
    p.required ? Math.max(1, p.min_selections || 0) : p.min_selections || 0;

  const podeAdicionar = perguntasProduto.every((p) => {
    const n = (selecoes[p.id] ?? []).length;
    const min = minimoDe(p);
    const max = p.max_selections || Infinity;
    return n >= min && n <= max;
  });

  function toggle(perguntaId: string, nome: string, checked: boolean, maxSel: number) {
    setSelecoes((prev) => {
      const atual = prev[perguntaId] ?? [];
      if (maxSel === 1) {
        return { ...prev, [perguntaId]: checked ? [nome] : [] };
      }
      let next = checked ? [...atual, nome] : atual.filter((x) => x !== nome);
      if (maxSel && next.length > maxSel) next = next.slice(0, maxSel);
      return { ...prev, [perguntaId]: next };
    });
  }

  function handleAdicionar() {
    if (!produto) return;
    if (!podeAdicionar) {
      toast.error("Responda as opções obrigatórias.");
      return;
    }
    const respostas: RespostaSelecionada[] = perguntasProduto
      .map((p) => {
        const opts = opcoesAtivas(p);
        const escolhas = (selecoes[p.id] ?? []).map((nome) => {
          const o = opts.find((x) => x.nome === nome);
          return { nome, preco: o?.preco || undefined, produtoId: o?.produtoId };
        });
        return {
          pergunta_id: p.id,
          pdv_pergunta_id: p.pdv_pergunta_id,
          texto: p.texto,
          tipo: p.tipo,
          escolhas,
        };
      })
      .filter((r) => r.escolhas.length > 0);

    adicionar(produto, quantidade, {
      observacao: observacao || undefined,
      respostas: respostas.length ? respostas : undefined,
    });
    toast.success(`${quantidade}x ${produto.nome} adicionado`);
    onClose();
  }

  const total = Number((quantidade * (Number(produto.preco) + adicionalTotal)).toFixed(2));

  return (
    <Dialog open={!!produto} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[90vh] max-w-md flex-col gap-0 overflow-y-auto p-0">
        {produto.imagem_url && (
          <div className="aspect-[16/10] w-full shrink-0 overflow-hidden bg-muted">
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
            <DialogDescription className="sr-only">
              Personalize o item, escolha os adicionais e confirme a quantidade.
            </DialogDescription>
          </DialogHeader>
          {produto.descricao && (
            <p className="text-sm text-muted-foreground">{produto.descricao}</p>
          )}

          {perguntasProduto.map((p) => {
            const opts = opcoesAtivas(p);
            if (opts.length === 0) return null;
            const selecionados = selecoes[p.id] ?? [];
            const min = minimoDe(p);
            const max = p.max_selections || Infinity;
            const unico = p.max_selections === 1;
            const invalido = selecionados.length < min;
            return (
              <div key={p.id} className="space-y-2 border-t pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{p.texto}</p>
                  {min > 0 ? (
                    <span
                      className={`text-[11px] font-medium ${
                        invalido ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      Obrigatório
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Opcional</span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {unico
                    ? "Escolha 1 opção"
                    : min === max && min > 0
                      ? `Escolha ${min}`
                      : `Escolha de ${min} até ${p.max_selections}`}
                </p>

                {unico ? (
                  <RadioGroup
                    value={selecionados[0] ?? ""}
                    onValueChange={(v) => toggle(p.id, v, true, 1)}
                    className="gap-1"
                  >
                    {opts.map((o) => (
                      <label
                        key={o.nome}
                        className="flex cursor-pointer items-center justify-between rounded-lg border p-2.5 text-sm"
                      >
                        <span className="flex items-center gap-2">
                          <RadioGroupItem value={o.nome} id={`${p.id}-${o.nome}`} />
                          <span>{o.nome}</span>
                        </span>
                        {o.preco > 0 && (
                          <span className="text-xs text-muted-foreground">+ {brl(o.preco)}</span>
                        )}
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-1">
                    {opts.map((o) => {
                      const checked = selecionados.includes(o.nome);
                      const bloqueado = !checked && selecionados.length >= max;
                      return (
                        <label
                          key={o.nome}
                          className={`flex items-center justify-between rounded-lg border p-2.5 text-sm ${
                            bloqueado ? "opacity-50" : "cursor-pointer"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Checkbox
                              checked={checked}
                              disabled={bloqueado}
                              onCheckedChange={(v) =>
                                toggle(p.id, o.nome, v === true, p.max_selections)
                              }
                            />
                            <span>{o.nome}</span>
                          </span>
                          {o.preco > 0 && (
                            <span className="text-xs text-muted-foreground">+ {brl(o.preco)}</span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="border-t pt-3">
            <Label className="mb-1 block text-xs font-medium">Observação (opcional)</Label>
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
              className="ml-4 flex-1"
              style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
              disabled={!podeAdicionar}
              onClick={handleAdicionar}
            >
              Adicionar · {brl(total)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
