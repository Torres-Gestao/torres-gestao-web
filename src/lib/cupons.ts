// Motor de cupons — porte da lógica do PDV para o cardápio digital.
// Puro (sem I/O) para ficar testável: recebe cupons + contexto e devolve descontos.

import type { Cupom, CupomAplicado } from "@/types/db";

export type MotivoInvalido =
  | "inexistente"
  | "inativo"
  | "canal"
  | "vigencia"
  | "valor_minimo"
  | "qtd_minima"
  | "primeira_compra"
  | "limite_total"
  | "limite_cliente"
  | "sem_itens_alvo"
  | "sem_desconto";

export const MENSAGENS: Record<MotivoInvalido, string> = {
  inexistente: "Cupom não encontrado.",
  inativo: "Este cupom não está mais ativo.",
  canal: "Este cupom não é válido para pedidos pelo site.",
  vigencia: "Este cupom está fora do período de validade.",
  valor_minimo: "Seu pedido não atingiu o valor mínimo do cupom.",
  qtd_minima: "Seu pedido não atingiu a quantidade mínima de itens do cupom.",
  primeira_compra: "Este cupom é válido apenas na primeira compra.",
  limite_total: "Este cupom atingiu o limite de usos.",
  limite_cliente: "Você já usou este cupom o número máximo de vezes.",
  sem_itens_alvo: "Nenhum item do carrinho é elegível para este cupom.",
  sem_desconto: "Este cupom não gera desconto neste pedido.",
};

export interface ItemCtx {
  produtoId: string;
  categoriaId: string | null;
  qtd: number;
  preco: number; // unitário
}

export interface UsosCupom {
  total: number;
  doCliente: number;
}

export interface CupomCtx {
  canal: string; // "delivery"
  itens: ItemCtx[];
  subtotal: number;
  taxaEntrega: number;
  primeiraCompra: boolean;
  usos: Record<string, UsosCupom>;
  dataHora: Date;
}

export type Validacao =
  | { ok: true; desconto: number; sobreEntrega: boolean }
  | { ok: false; motivo: MotivoInvalido };

const num = (v: unknown, fallback = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

function asArray(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return p && typeof p === "object" && !Array.isArray(p) ? p : {};
    } catch {
      return {};
    }
  }
  return {};
}

export function normalizaCodigo(codigo: string): string {
  return codigo
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9\-_.]/g, "")
    .slice(0, 40);
}

// Compara códigos normalizando os dois lados (evita divergência com o PDV).
export function mesmoCodigo(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizaCodigo(a ?? "");
  const nb = normalizaCodigo(b ?? "");
  return na.length > 0 && na === nb;
}


// ---------- Vigência ----------
function minutosDoDia(d: Date) {
  return d.getHours() * 60 + d.getMinutes();
}

function parseHora(h: unknown): number | null {
  if (typeof h !== "string") return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(h.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function mesmaData(iso: unknown, d: Date): boolean {
  if (typeof iso !== "string" || !iso) return false;
  const alvo = iso.slice(0, 10);
  const atual = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  return alvo === atual;
}

function dentroDoIntervaloDeDatas(ag: Record<string, unknown>, d: Date): boolean {
  const ini = typeof ag.data_inicio === "string" ? ag.data_inicio : null;
  const fim = typeof ag.data_fim === "string" ? ag.data_fim : null;
  const hoje = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  if (ini && hoje < ini.slice(0, 10)) return false;
  if (fim && hoje > fim.slice(0, 10)) return false;
  return true;
}

export function dentroDaVigencia(cupom: Cupom, agora: Date): boolean {
  const ag = asRecord(cupom.agendamento);
  const tipo = (typeof ag.tipo === "string" ? ag.tipo : "sempre").toLowerCase();

  // Faixa de horário opcional, comum a todos os tipos.
  const hIni = parseHora(ag.hora_inicio);
  const hFim = parseHora(ag.hora_fim);
  if (hIni != null && hFim != null) {
    const m = minutosDoDia(agora);
    const dentroHora = hIni <= hFim ? m >= hIni && m <= hFim : m >= hIni || m <= hFim;
    if (!dentroHora) return false;
  }

  switch (tipo) {
    case "unica": {
      const data = ag.data ?? ag.data_inicio;
      if (data) return mesmaData(data, agora);
      return dentroDoIntervaloDeDatas(ag, agora);
    }
    case "diaria":
      return dentroDoIntervaloDeDatas(ag, agora);
    case "semanal": {
      const dias = asArray(ag.dias).map((x) => Number(x));
      if (dias.length > 0 && !dias.includes(agora.getDay())) return false;
      return dentroDoIntervaloDeDatas(ag, agora);
    }
    case "mensal": {
      const dia = num(ag.dia, 0);
      if (dia > 0 && agora.getDate() !== dia) return false;
      return dentroDoIntervaloDeDatas(ag, agora);
    }
    case "anual": {
      const data = typeof ag.data === "string" ? ag.data : null;
      if (data) {
        const md = data.slice(5, 10);
        const atual = `${String(agora.getMonth() + 1).padStart(2, "0")}-${String(
          agora.getDate(),
        ).padStart(2, "0")}`;
        if (md !== atual) return false;
      }
      return dentroDoIntervaloDeDatas(ag, agora);
    }
    case "sempre":
    default:
      return dentroDoIntervaloDeDatas(ag, agora);
  }
}

// ---------- Base de cálculo ----------
function itensAlvo(cupom: Cupom, itens: ItemCtx[]): ItemCtx[] {
  const produtos = asArray(cupom.produtos_alvo).map(String);
  const categorias = asArray(cupom.categorias_alvo).map(String);
  if (produtos.length === 0 && categorias.length === 0) return itens;
  return itens.filter(
    (i) =>
      produtos.includes(String(i.produtoId)) ||
      (i.categoriaId != null && categorias.includes(String(i.categoriaId))),
  );
}

function somaItens(itens: ItemCtx[]): number {
  return itens.reduce((acc, i) => acc + i.preco * i.qtd, 0);
}

// leve X pague Y: os itens mais baratos da seleção viram grátis.
function descontoLeveXPagueY(itens: ItemCtx[], x: number, y: number): number {
  if (x <= 0 || y < 0 || y >= x) return 0;
  const unidades: number[] = [];
  itens.forEach((i) => {
    for (let k = 0; k < i.qtd; k++) unidades.push(i.preco);
  });
  if (unidades.length < x) return 0;
  unidades.sort((a, b) => a - b);
  const grupos = Math.floor(unidades.length / x);
  const gratis = grupos * (x - y);
  return unidades.slice(0, gratis).reduce((a, b) => a + b, 0);
}

function calcularDesconto(cupom: Cupom, ctx: CupomCtx): { desconto: number; sobreEntrega: boolean } {
  const escopo = (cupom.escopo ?? "pedido").toLowerCase();
  const tipo = (cupom.tipo ?? "percentual").toLowerCase();
  const regra = asRecord(cupom.regra);
  const valor = num(cupom.valor);

  if (escopo === "entrega") {
    const base = ctx.taxaEntrega;
    if (base <= 0) return { desconto: 0, sobreEntrega: true };
    let d = 0;
    if (tipo === "percentual") d = (base * valor) / 100;
    else d = valor; // valor_fixo e demais tipos abatem valor do frete
    return { desconto: round2(Math.min(Math.max(d, 0), base)), sobreEntrega: true };
  }

  const alvo = escopo === "itens" ? itensAlvo(cupom, ctx.itens) : ctx.itens;
  const base = escopo === "itens" ? somaItens(alvo) : ctx.subtotal;
  if (base <= 0) return { desconto: 0, sobreEntrega: false };

  let d = 0;
  switch (tipo) {
    case "percentual":
      d = (base * valor) / 100;
      break;
    case "valor_fixo":
      d = regra.por_item === true ? valor * alvo.reduce((a, i) => a + i.qtd, 0) : valor;
      break;
    case "leve_x_pague_y":
      d = descontoLeveXPagueY(alvo, num(regra.leve ?? regra.x, 0), num(regra.pague ?? regra.y, 0));
      break;
    case "item_gratis": {
      const qtdGratis = Math.max(1, num(regra.quantidade, 1));
      const unidades: number[] = [];
      alvo.forEach((i) => {
        for (let k = 0; k < i.qtd; k++) unidades.push(i.preco);
      });
      unidades.sort((a, b) => a - b);
      d = unidades.slice(0, qtdGratis).reduce((a, b) => a + b, 0);
      break;
    }
    case "compre_x_ganhe_desconto": {
      const qtdMin = num(regra.compre ?? regra.qtd, 0);
      const qtdAlvo = alvo.reduce((a, i) => a + i.qtd, 0);
      if (qtdMin > 0 && qtdAlvo < qtdMin) return { desconto: 0, sobreEntrega: false };
      const percentual = num(regra.percentual, 0);
      d = percentual > 0 ? (base * percentual) / 100 : num(regra.desconto, valor);
      break;
    }
    default:
      d = (base * valor) / 100;
  }

  return { desconto: round2(Math.min(Math.max(d, 0), base)), sobreEntrega: false };
}

// ---------- Validação ----------
export function validarCupom(cupom: Cupom, ctx: CupomCtx): Validacao {
  if (!cupom.ativo) return { ok: false, motivo: "inativo" };

  const canais = asArray(cupom.canais).map((c) => String(c).toLowerCase());
  if (canais.length > 0 && !canais.includes(ctx.canal)) return { ok: false, motivo: "canal" };

  if (!dentroDaVigencia(cupom, ctx.dataHora)) return { ok: false, motivo: "vigencia" };

  if (num(cupom.valor_minimo) > 0 && ctx.subtotal < num(cupom.valor_minimo)) {
    return { ok: false, motivo: "valor_minimo" };
  }

  const qtdTotal = ctx.itens.reduce((a, i) => a + i.qtd, 0);
  if (num(cupom.qtd_minima) > 0 && qtdTotal < num(cupom.qtd_minima)) {
    return { ok: false, motivo: "qtd_minima" };
  }

  if (cupom.primeira_compra && !ctx.primeiraCompra) {
    return { ok: false, motivo: "primeira_compra" };
  }

  const usos = ctx.usos[cupom.id];
  const limiteTotal = num(cupom.limite_uso_total);
  if (limiteTotal > 0 && usos && usos.total >= limiteTotal) {
    return { ok: false, motivo: "limite_total" };
  }
  if (cupom.tem_limite_por_cliente) {
    const limiteCliente = num(cupom.limite_por_cliente);
    if (limiteCliente > 0 && usos && usos.doCliente >= limiteCliente) {
      return { ok: false, motivo: "limite_cliente" };
    }
  }

  const escopo = (cupom.escopo ?? "pedido").toLowerCase();
  if (escopo === "itens" && itensAlvo(cupom, ctx.itens).length === 0) {
    return { ok: false, motivo: "sem_itens_alvo" };
  }

  const { desconto, sobreEntrega } = calcularDesconto(cupom, ctx);
  if (desconto <= 0) return { ok: false, motivo: "sem_desconto" };

  return { ok: true, desconto, sobreEntrega };
}

// ---------- Aplicação (automáticos + digitado) ----------
export interface ResultadoCupons {
  descontoProdutos: number;
  descontoEntrega: number;
  entregaGratis: boolean;
  aplicados: CupomAplicado[];
  principal: CupomAplicado | null;
}

export const RESULTADO_VAZIO: ResultadoCupons = {
  descontoProdutos: 0,
  descontoEntrega: 0,
  entregaGratis: false,
  aplicados: [],
  principal: null,
};

/**
 * Recebe os cupons já validados (com o desconto calculado) e resolve o
 * empilhamento: acumuláveis somam; não-acumuláveis disputam entre si pelo
 * maior `prioridade` e, no empate, pelo maior desconto.
 */
export function combinar(
  candidatos: { cupom: Cupom; desconto: number; sobreEntrega: boolean }[],
  ctx: CupomCtx,
): ResultadoCupons {
  if (candidatos.length === 0) return RESULTADO_VAZIO;

  const acumulaveis = candidatos.filter((c) => c.cupom.acumulavel);
  const exclusivos = candidatos.filter((c) => !c.cupom.acumulavel);

  const melhorExclusivo =
    exclusivos.length > 0
      ? exclusivos.reduce((a, b) =>
          num(b.cupom.prioridade) > num(a.cupom.prioridade) ||
          (num(b.cupom.prioridade) === num(a.cupom.prioridade) && b.desconto > a.desconto)
            ? b
            : a,
        )
      : null;

  const escolhidos = [...acumulaveis, ...(melhorExclusivo ? [melhorExclusivo] : [])];

  let descontoProdutos = 0;
  let descontoEntrega = 0;
  const aplicados: CupomAplicado[] = [];

  for (const c of escolhidos) {
    if (c.sobreEntrega) descontoEntrega += c.desconto;
    else descontoProdutos += c.desconto;
    aplicados.push({
      id: c.cupom.id,
      codigo: c.cupom.codigo ?? null,
      nome: c.cupom.nome ?? null,
      desconto: round2(c.desconto),
      escopo: (c.cupom.escopo ?? "pedido") as CupomAplicado["escopo"],
    });
  }

  descontoProdutos = round2(Math.min(descontoProdutos, ctx.subtotal));
  descontoEntrega = round2(Math.min(descontoEntrega, ctx.taxaEntrega));

  const principal =
    aplicados.find((a) => !!a.codigo) ?? (aplicados.length > 0 ? aplicados[0] : null);

  return {
    descontoProdutos,
    descontoEntrega,
    entregaGratis: ctx.taxaEntrega > 0 && descontoEntrega >= ctx.taxaEntrega,
    aplicados,
    principal: principal ?? null,
  };
}
