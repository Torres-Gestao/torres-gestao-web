import type { Pergunta, Produto, RespostaOpcao } from "@/types/db";

export interface OpcaoNormalizada {
  nome: string;
  preco: number;
  produtoId?: string;
  imagem?: string | null;
  ativo: boolean;
}

// As respostas vêm em 3 formatos no jsonb do PDV; normaliza para um só.
export function normalizarResposta(r: RespostaOpcao): OpcaoNormalizada {
  if (typeof r === "string") {
    return { nome: r, preco: 0, ativo: true };
  }
  if (r.tipo === "produto") {
    return {
      nome: r.nome,
      preco: Number(r.preco) || 0,
      produtoId: r.produtoId,
      imagem: r.imagem ?? null,
      ativo: r.ativo !== false,
    };
  }
  return { nome: r.resposta, preco: 0, ativo: r.ativo !== false };
}

// Opções ativas de uma pergunta, já normalizadas.
export function opcoesAtivas(pergunta: Pergunta): OpcaoNormalizada[] {
  const lista = Array.isArray(pergunta.respostas) ? pergunta.respostas : [];
  return lista.map(normalizarResposta).filter((o) => o.ativo && o.nome);
}

// Perguntas vinculadas a um produto (match por pdv_produto_id), ordenadas.
export function perguntasDoProduto(
  perguntas: Pergunta[] | undefined,
  produto: Produto,
): Pergunta[] {
  const pdvId = produto.pdv_produto_id;
  if (!pdvId || !perguntas) return [];
  return perguntas
    .filter(
      (p) =>
        p.ativo &&
        Array.isArray(p.produtos_vinculados) &&
        p.produtos_vinculados.includes(pdvId),
    )
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}
