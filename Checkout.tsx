import { useState } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import type { Cliente, FormaPagamento, Loja, Modalidade } from "@/types/db";
import { useCarrinho } from "@/hooks/useCarrinho";
import { supabase } from "@/lib/supabase";
import { brl, formatPhone, onlyDigits } from "@/lib/money";
import { buscarCep, formatCep } from "@/lib/cep";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function Checkout() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const navigate = useNavigate();
  const { itens, subtotal, limpar } = useCarrinho();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade>("delivery");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [complemento, setComplemento] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [observacao, setObservacao] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [enviando, setEnviando] = useState(false);

  if (itens.length === 0) {
    return (
      <div className="py-16 text-center">
        <p className="text-muted-foreground">Adicione itens antes de finalizar.</p>
        <Link to={`/${loja.slug}`} className="mt-4 inline-block text-sm underline">
          Voltar ao cardápio
        </Link>
      </div>
    );
  }

  async function handleCepBlur() {
    if (onlyDigits(cep).length !== 8) return;
    setLoadingCep(true);
    const r = await buscarCep(cep);
    setLoadingCep(false);
    if (!r) {
      toast.error("CEP não encontrado");
      return;
    }
    setRua(r.logradouro);
    setBairro(r.bairro);
    setCidade(r.localidade);
    setUf(r.uf);
  }

  async function upsertCliente(telefoneDigits: string): Promise<Cliente> {
    const endereco =
      modalidade === "delivery"
        ? { rua, numero, bairro, complemento, cidade, uf, cep: formatCep(cep) }
        : null;

    // Tenta encontrar cliente existente pela loja + telefone
    const { data: existente, error: selErr } = await supabase
      .from("clientes")
      .select("*")
      .eq("loja_id", loja.id)
      .eq("telefone", telefoneDigits)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existente) {
      const { data: upd, error: updErr } = await supabase
        .from("clientes")
        .update({ nome: nome.trim(), endereco: endereco ?? (existente as Cliente).endereco } as never)
        .eq("id", (existente as Cliente).id)
        .select("*")
        .single();
      if (updErr) throw updErr;
      return upd as Cliente;
    }

    const { data: novo, error: insErr } = await supabase
      .from("clientes")
      .insert({
        loja_id: loja.id,
        nome: nome.trim(),
        telefone: telefoneDigits,
        endereco,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("*")
      .single();
    if (insErr) throw insErr;
    return novo as Cliente;
  }

  async function enviar() {
    if (!nome.trim() || !telefone.trim()) {
      toast.error("Preencha seu nome e telefone");
      return;
    }
    if (modalidade === "delivery" && (!rua || !numero || !bairro)) {
      toast.error("Preencha o endereço de entrega");
      return;
    }

    setEnviando(true);
    try {
      const telefoneDigits = onlyDigits(telefone);
      const cliente = await upsertCliente(telefoneDigits);

      // id gerado no cliente: assim não dependemos de RETURNING (SELECT em
      // pedidos foi revogado para o anônimo por privacidade).
      const novoPedidoId = crypto.randomUUID();

      const payload = {
        id: novoPedidoId,
        loja_id: loja.id,
        cliente_id: cliente.id,
        cliente_nome: nome.trim(),
        cliente_telefone: telefoneDigits,
        modalidade,
        rua: modalidade === "delivery" ? rua : null,
        numero: modalidade === "delivery" ? numero : null,
        bairro: modalidade === "delivery" ? bairro : null,
        complemento: modalidade === "delivery" ? complemento || null : null,
        cidade: modalidade === "delivery" ? cidade : null,
        uf: modalidade === "delivery" ? uf : null,
        cep: modalidade === "delivery" ? formatCep(cep) : null,
        itens,
        total_produtos: subtotal,
        taxa_entrega: 0,
        total_general: subtotal,
        forma_pagamento: formaPagamento,
        observacao: observacao.trim() || null,
        status: "pendente" as const,
        status_web: "pendente" as const,
        agendado: false,
        data_agendada: null,
      };

      const { error } = await supabase
        .from("pedidos")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(payload as any);

      if (error) throw error;

      limpar();
      toast.success("Pedido enviado com sucesso!");
      navigate(`/${loja.slug}/pedido/${novoPedidoId}`, { replace: true });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="pb-10">
      <div className="mb-4 flex items-center gap-2">
        <Link to={`/${loja.slug}/carrinho`} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h2 className="text-lg font-bold">Finalizar pedido</h2>
      </div>

      <div className="space-y-6">
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Seus dados
          </h3>
          <div>
            <Label htmlFor="nome">Nome completo</Label>
            <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tel">WhatsApp / Telefone</Label>
            <Input
              id="tel"
              value={telefone}
              onChange={(e) => setTelefone(formatPhone(e.target.value))}
              placeholder="(00) 00000-0000"
              inputMode="tel"
            />
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Entrega
          </h3>
          <RadioGroup
            value={modalidade}
            onValueChange={(v) => setModalidade(v as Modalidade)}
            className="grid grid-cols-2 gap-2"
          >
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="delivery" />
              Entrega
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem value="retirada" />
              Retirar no local
            </label>
          </RadioGroup>

          {modalidade === "delivery" && (
            <div className="grid gap-3 pt-2">
              <div>
                <Label htmlFor="cep">CEP</Label>
                <div className="relative">
                  <Input
                    id="cep"
                    value={cep}
                    onChange={(e) => setCep(formatCep(e.target.value))}
                    onBlur={handleCepBlur}
                    placeholder="00000-000"
                    inputMode="numeric"
                  />
                  {loadingCep && (
                    <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_100px] gap-2">
                <div>
                  <Label htmlFor="rua">Rua</Label>
                  <Input id="rua" value={rua} onChange={(e) => setRua(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="num">Número</Label>
                  <Input id="num" value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
              </div>
              <div>
                <Label htmlFor="compl">Complemento</Label>
                <Input
                  id="compl"
                  value={complemento}
                  onChange={(e) => setComplemento(e.target.value)}
                  placeholder="Apto, referência..."
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div className="grid grid-cols-[1fr_60px] gap-2">
                  <div>
                    <Label htmlFor="cid">Cidade</Label>
                    <Input id="cid" value={cidade} onChange={(e) => setCidade(e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="uf">UF</Label>
                    <Input
                      id="uf"
                      value={uf}
                      onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Pagamento{" "}
            <span className="ml-1 font-normal normal-case text-xs">(na entrega/retirada)</span>
          </h3>
          <RadioGroup
            value={formaPagamento}
            onValueChange={(v) => setFormaPagamento(v as FormaPagamento)}
            className="grid gap-2"
          >
            {[
              { v: "pix", l: "PIX" },
              { v: "dinheiro", l: "Dinheiro" },
              { v: "cartao_credito", l: "Cartão de crédito" },
            ].map((o) => (
              <label
                key={o.v}
                className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
              >
                <RadioGroupItem value={o.v} />
                {o.l}
              </label>
            ))}
          </RadioGroup>
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4">
          <Label htmlFor="obs">Observação do pedido</Label>
          <Textarea
            id="obs"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Alguma observação para o restaurante?"
            rows={2}
          />
        </section>

        <section className="space-y-2 rounded-xl border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{brl(subtotal)}</span>
          </div>
          <div className="flex justify-between text-base font-bold">
            <span>Total</span>
            <span>{brl(subtotal)}</span>
          </div>
        </section>

        <Button
          className="h-12 w-full text-base"
          style={{ backgroundColor: "var(--brand-primary, #6B21A8)" }}
          disabled={enviando}
          onClick={enviar}
        >
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar Pedido"}
        </Button>
      </div>
    </div>
  );
}
