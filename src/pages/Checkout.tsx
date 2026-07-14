import { useEffect, useState } from "react";
import { useOutletContext, useNavigate, Link } from "react-router-dom";
import type {
  Cliente,
  FormaPagamento,
  Loja,
  LojaPagamentoPublico,
  MetodoPagamento,
  Modalidade,
} from "@/types/db";
import { useCarrinho } from "@/hooks/useCarrinho";
import { supabase } from "@/lib/supabase";
import { brl, formatPhone, onlyDigits } from "@/lib/money";
import { buscarCep, formatCep } from "@/lib/cep";
import { formatCpf, isValidCpf, isValidEmail } from "@/lib/validators";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowLeft, Loader2, CreditCard, Banknote, QrCode, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Mapeia método online -> forma_pagamento legada (para preservar compat).
function metodoToFormaLegada(m: MetodoPagamento): FormaPagamento {
  if (m === "pix") return "pix";
  if (m === "cartao_credito" || m === "cartao_debito") return "cartao_credito";
  return "dinheiro";
}

const METODO_LABELS: Record<MetodoPagamento, { label: string; icon: typeof QrCode }> = {
  pix: { label: "PIX", icon: QrCode },
  cartao_credito: { label: "Cartão de crédito", icon: CreditCard },
  cartao_debito: { label: "Cartão de débito", icon: CreditCard },
  dinheiro: { label: "Dinheiro", icon: Banknote },
  na_entrega: { label: "Pagar na entrega/retirada", icon: Banknote },
};

export default function Checkout() {
  const { loja } = useOutletContext<{ loja: Loja }>();
  const navigate = useNavigate();
  const { itens, subtotal, limpar } = useCarrinho();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [modalidade, setModalidade] = useState<Modalidade>("delivery");
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [complemento, setComplemento] = useState("");
  const [observacao, setObservacao] = useState("");
  const [loadingCep, setLoadingCep] = useState(false);
  const [enviando, setEnviando] = useState(false);

  // Estado da "sala de espera" enquanto o poller gera o init_point no Asaas.
  const [aguardando, setAguardando] = useState<null | {
    pedidoId: string;
    status: "polling" | "timeout" | "erro";
  }>(null);

  // Config de pagamento da loja (view pública). Fallback: só "na_entrega".
  const [pagCfg, setPagCfg] = useState<LojaPagamentoPublico | null>(null);
  const [cfgLoading, setCfgLoading] = useState(true);
  const [metodo, setMetodo] = useState<MetodoPagamento>("na_entrega");

  useEffect(() => {
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("loja_pagamento_publico" as never)
        .select("*")
        .eq("loja_id", loja.id)
        .maybeSingle();
      if (!ativo) return;
      const cfg = (data as LojaPagamentoPublico | null) ?? null;
      setPagCfg(cfg);
      // Escolha padrão: primeiro método online se aceita; senão na entrega.
      if (cfg?.metodos_aceitos?.length) {
        setMetodo(cfg.metodos_aceitos[0]);
      } else {
        setMetodo("na_entrega");
      }
      setCfgLoading(false);
    })();
    return () => {
      ativo = false;
    };
  }, [loja.id]);

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

    const emailTrim = email.trim() || null;
    const cpfDigits = onlyDigits(cpf) || null;

    const { data: existente, error: selErr } = await supabase
      .from("clientes")
      .select("*")
      .eq("loja_id", loja.id)
      .eq("telefone", telefoneDigits)
      .maybeSingle();
    if (selErr) throw selErr;

    if (existente) {
      const ex = existente as Cliente;
      const { data: upd, error: updErr } = await supabase
        .from("clientes")
        .update({
          nome: nome.trim(),
          endereco: endereco ?? ex.endereco,
          email: emailTrim ?? ex.email,
          cpf: cpfDigits ?? ex.cpf,
        } as never)
        .eq("id", ex.id)
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
        email: emailTrim,
        cpf: cpfDigits,
        endereco,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .select("*")
      .single();
    if (insErr) throw insErr;
    return novo as Cliente;
  }

  // Faz polling no pedido até que o poller on-premise grave init_point.
  // Timeout: 60s (~30 tentativas de 2s).
  async function aguardarInitPoint(pedidoId: string) {
    const inicio = Date.now();
    const LIMITE_MS = 60_000;
    while (Date.now() - inicio < LIMITE_MS) {
      const { data } = await supabase
        .from("pedidos")
        .select("init_point,provider_preference_id,status_pgto")
        .eq("id", pedidoId)
        .maybeSingle();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = data as any;
      if (row?.init_point) {
        window.location.href = row.init_point as string;
        return;
      }
      if (row?.provider_preference_id) {
        window.location.href = `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=${row.provider_preference_id}`;
        return;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    setAguardando({ pedidoId, status: "timeout" });
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
    const isOnline = metodo !== "na_entrega" && metodo !== "dinheiro";
    if (isOnline) {
      if (!isValidEmail(email)) {
        toast.error("Informe um email válido para o pagamento online");
        return;
      }
      if (!isValidCpf(cpf)) {
        toast.error("Informe um CPF válido para o pagamento online");
        return;
      }
    }

    setEnviando(true);
    try {
      const telefoneDigits = onlyDigits(telefone);
      const cliente = await upsertCliente(telefoneDigits);
      const novoPedidoId = crypto.randomUUID();

      // O front só grava o pedido. O serviço on-premise (poller) detecta pedido
      // com status_pgto='pendente' e sem init_point, cria a cobrança no Asaas
      // e grava init_point. Aqui aguardamos esse init_point ANTES de mostrar
      // qualquer tela de acompanhamento — fluxo "pague primeiro".
      const payload = {
        id: novoPedidoId,
        loja_id: loja.id,
        cliente_id: cliente.id,
        cliente_nome: nome.trim(),
        cliente_telefone: telefoneDigits,
        cliente_email: email.trim() || null,
        cliente_cpf: onlyDigits(cpf) || null,
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
        forma_pagamento: metodoToFormaLegada(metodo),
        metodo_pgto: metodo,
        status_pgto: isOnline ? ("pendente" as const) : ("nao_aplicavel" as const),
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

      if (isOnline) {
        setAguardando({ pedidoId: novoPedidoId, status: "polling" });
        aguardarInitPoint(novoPedidoId);
      } else {
        toast.success("Pedido enviado com sucesso!");
        navigate(`/${loja.slug}/pedido/${novoPedidoId}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setEnviando(false);
    }
  }

  // Monta lista de métodos exibidos.
  const metodosOnline = pagCfg?.ativo ? pagCfg.metodos_aceitos : [];
  const mostraNaEntrega = !pagCfg || pagCfg.aceita_na_entrega;
  const metodosDisponiveis: MetodoPagamento[] = [
    ...metodosOnline,
    ...(mostraNaEntrega ? (["na_entrega"] as MetodoPagamento[]) : []),
  ];

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
          <div>
            <Label htmlFor="email">
              Email {metodoOnlineSelecionado && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              inputMode="email"
            />
            {metodoOnlineSelecionado && (
              <p className="mt-1 text-xs text-muted-foreground">
                Necessário para receber o comprovante do pagamento.
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="cpf">
              CPF {metodoOnlineSelecionado && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id="cpf"
              value={cpf}
              onChange={(e) => setCpf(formatCpf(e.target.value))}
              placeholder="000.000.000-00"
              inputMode="numeric"
            />
            {metodoOnlineSelecionado && (
              <p className="mt-1 text-xs text-muted-foreground">
                Exigido pelo Asaas para gerar o pagamento.
              </p>
            )}
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
            Como você quer pagar?
          </h3>
          {cfgLoading ? (
            <div className="flex justify-center py-3">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : metodosDisponiveis.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum método de pagamento disponível para esta loja.
            </p>
          ) : (
            <RadioGroup
              value={metodo}
              onValueChange={(v) => setMetodo(v as MetodoPagamento)}
              className="grid gap-2"
            >
              {metodosDisponiveis.map((m) => {
                const { label, icon: Icon } = METODO_LABELS[m];
                const online = m !== "na_entrega";
                return (
                  <label
                    key={m}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                  >
                    <RadioGroupItem value={m} />
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">
                        {online
                          ? "Pagamento online, seguro pelo Mercado Pago"
                          : "Pague ao receber o pedido"}
                      </p>
                    </div>
                  </label>
                );
              })}
            </RadioGroup>
          )}
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
          disabled={enviando || metodosDisponiveis.length === 0}
          onClick={enviar}
        >
          {enviando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : metodo !== "na_entrega" && metodo !== "dinheiro" ? (
            "Ir para o pagamento"
          ) : (
            "Finalizar Pedido"
          )}
        </Button>
      </div>
    </div>
  );
}
