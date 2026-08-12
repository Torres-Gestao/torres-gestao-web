import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Cupom } from "@/types/db";
import {
  MENSAGENS,
  RESULTADO_VAZIO,
  combinar,
  mesmoCodigo,
  normalizaCodigo,
  validarCupom,
  type CupomCtx,
  type ItemCtx,
  type ResultadoCupons,
  type UsosCupom,
} from "@/lib/cupons";

interface Params {
  lojaId: string;
  itens: ItemCtx[];
  subtotal: number;
  taxaEntrega: number;
  telefone: string; // apenas dígitos
}

export function useCupons({ lojaId, itens, subtotal, taxaEntrega, telefone }: Params) {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [codigoAplicado, setCodigoAplicado] = useState<string | null>(null);
  const [validando, setValidando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usos, setUsos] = useState<Record<string, UsosCupom>>({});
  // Só sabemos que é primeira compra depois de consultar; antes disso
  // tratamos como "ainda não elegível" para não mostrar desconto que some.
  const [primeiraCompra, setPrimeiraCompra] = useState(false);
  const telefoneRef = useRef(telefone);
  telefoneRef.current = telefone;
  // Evita refazer a mesma contagem para o par (cupom, telefone).
  const contagensFeitas = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!lojaId) return;
    let ativo = true;
    (async () => {
      const { data } = await supabase
        .from("cupons" as never)
        .select("*")
        .eq("loja_id", lojaId)
        .eq("ativo", true);
      if (!ativo) return;
      setCupons(((data as unknown) as Cupom[] | null) ?? []);
    })();
    return () => {
      ativo = false;
    };
  }, [lojaId]);


  const ctxBase = useMemo<Omit<CupomCtx, "dataHora">>(
    () => ({
      canal: "delivery",
      itens,
      subtotal,
      taxaEntrega,
      primeiraCompra,
      usos,
    }),
    [itens, subtotal, taxaEntrega, primeiraCompra, usos],
  );

  // Promoções automáticas: cupons sem código.
  const automaticos = useMemo(
    () => cupons.filter((c) => !c.codigo || !c.codigo.trim()),
    [cupons],
  );

  const resultado = useMemo<ResultadoCupons>(() => {
    const ctx: CupomCtx = { ...ctxBase, dataHora: new Date() };
    const candidatos: { cupom: Cupom; desconto: number; sobreEntrega: boolean }[] = [];

    for (const c of automaticos) {
      const v = validarCupom(c, ctx);
      if (v.ok) candidatos.push({ cupom: c, desconto: v.desconto, sobreEntrega: v.sobreEntrega });
    }

    if (codigoAplicado) {
      const cupom = cupons.find((c) => mesmoCodigo(c.codigo, codigoAplicado));
      if (cupom) {
        const v = validarCupom(cupom, ctx);
        if (v.ok) candidatos.push({ cupom, desconto: v.desconto, sobreEntrega: v.sobreEntrega });
      }
    }

    if (candidatos.length === 0) return RESULTADO_VAZIO;
    return combinar(candidatos, ctx);
  }, [automaticos, codigoAplicado, cupons, ctxBase]);

  // Conta usos de um cupom (total e do cliente atual) via RPC security definer.
  const contarUsos = useCallback(async (cupomId: string): Promise<UsosCupom> => {
    const tel = telefoneRef.current || null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase.rpc as any)("contar_usos_cupom", {
      p_cupom_id: cupomId,
      p_telefone: tel,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = ((data as any[] | null) ?? [])[0];
    const u: UsosCupom = {
      total: Number(row?.total ?? 0),
      doCliente: Number(row?.do_cliente ?? 0),
    };
    contagensFeitas.current.add(`${cupomId}|${tel ?? ""}`);
    setUsos((prev) => ({ ...prev, [cupomId]: u }));
    return u;
  }, []);

  // Primeira compra depende só do telefone: consulta uma vez por telefone válido.
  useEffect(() => {
    const tel = telefone;
    if (!lojaId || tel.length < 8) {
      setPrimeiraCompra(false);
      return;
    }
    let ativo = true;
    const t = window.setTimeout(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase.rpc as any)("contar_pedidos_cliente", {
        p_loja_id: lojaId,
        p_telefone: tel,
      });
      if (ativo) setPrimeiraCompra(Number(data ?? 0) === 0);
    }, 500);
    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [lojaId, telefone]);

  // Promoções automáticas com limite também precisam dos contadores,
  // senão o limite nunca bloqueia (o motor assumiria "sem usos").
  useEffect(() => {
    const comLimite = automaticos.filter(
      (c) => Number(c.limite_uso_total ?? 0) > 0 || c.tem_limite_por_cliente,
    );
    if (comLimite.length === 0) return;
    let ativo = true;
    const t = window.setTimeout(() => {
      comLimite.forEach((c) => {
        const chave = `${c.id}|${telefone || ""}`;
        if (contagensFeitas.current.has(chave)) return;
        contagensFeitas.current.add(chave);
        if (ativo) void contarUsos(c.id);
      });
    }, 500);
    return () => {
      ativo = false;
      window.clearTimeout(t);
    };
  }, [automaticos, telefone, contarUsos]);


  const aplicarCodigo = useCallback(
    async (codigoBruto: string): Promise<boolean> => {
      const codigo = normalizaCodigo(codigoBruto);
      if (!codigo) {
        setErro("Digite um código de cupom.");
        return false;
      }
      setValidando(true);
      setErro(null);
      try {
        const cupom = cupons.find((c) => mesmoCodigo(c.codigo, codigo));
        if (!cupom) {
          setErro(MENSAGENS.inexistente);
          return false;
        }
        const u = await contarUsos(cupom.id);
        const ctx: CupomCtx = {
          ...ctxBase,
          usos: { ...ctxBase.usos, [cupom.id]: u },
          dataHora: new Date(),
        };
        const v = validarCupom(cupom, ctx);
        if (!v.ok) {
          setErro(MENSAGENS[v.motivo]);
          return false;
        }
        setCodigoAplicado(codigo);
        return true;
      } finally {
        setValidando(false);
      }
    },
    [cupons, ctxBase, contarUsos],
  );

  const remover = useCallback(() => {
    setCodigoAplicado(null);
    setErro(null);
  }, []);

  // Revalida no envio: o cupom pode ter expirado entre aplicar e finalizar.
  const revalidar = useCallback((): { ok: boolean; mensagem?: string } => {
    if (!codigoAplicado) return { ok: true };
    const cupom = cupons.find((c) => mesmoCodigo(c.codigo, codigoAplicado));
    if (!cupom) return { ok: false, mensagem: MENSAGENS.inexistente };
    const v = validarCupom(cupom, { ...ctxBase, dataHora: new Date() });
    if (!v.ok) return { ok: false, mensagem: MENSAGENS[v.motivo] };
    return { ok: true };
  }, [codigoAplicado, cupons, ctxBase]);

  return {
    codigoAplicado,
    aplicarCodigo,
    remover,
    revalidar,
    validando,
    erro,
    resultado,
  };
}
