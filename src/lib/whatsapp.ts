import type { Pedido } from "@/types/db";
import { brl, onlyDigits } from "./money";

export function montarMensagemPedido(pedido: Pedido, nomeLoja: string): string {
  const linhas: string[] = [];
  linhas.push(`*Pedido #${pedido.numero_pedido} — ${nomeLoja}*`);
  linhas.push("");
  linhas.push(`*Cliente:* ${pedido.cliente_nome}`);
  linhas.push(`*Telefone:* ${pedido.cliente_telefone}`);
  linhas.push(
    `*Modalidade:* ${pedido.modalidade === "delivery" ? "Entrega" : "Retirada no local"}`,
  );

  if (pedido.modalidade === "delivery") {
    const end = [
      `${pedido.rua ?? ""}, ${pedido.numero ?? "s/n"}`,
      pedido.complemento ? `Compl.: ${pedido.complemento}` : "",
      `${pedido.bairro ?? ""} — ${pedido.cidade ?? ""}/${pedido.uf ?? ""}`,
      pedido.cep ? `CEP ${pedido.cep}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    linhas.push(`*Endereço:*\n${end}`);
  }

  linhas.push("");
  linhas.push("*Itens:*");
  for (const it of pedido.itens) {
    linhas.push(`• ${it.quantidade}x ${it.nome} — ${brl(it.subtotal)}`);
    for (const r of it.respostas ?? []) {
      if (r.escolhas.length > 0) {
        linhas.push(`  ${r.texto}: ${r.escolhas.map((e) => e.nome).join(", ")}`);
      }
    }
    if (it.observacao) linhas.push(`  _obs: ${it.observacao}_`);
  }

  linhas.push("");
  linhas.push(`Subtotal: ${brl(pedido.total_produtos)}`);
  if (pedido.taxa_entrega && pedido.taxa_entrega > 0) {
    linhas.push(`Taxa de entrega: ${brl(pedido.taxa_entrega)}`);
  }
  linhas.push(`*Total: ${brl(pedido.total_general)}*`);

  const pgto: Record<string, string> = {
    dinheiro: "Dinheiro",
    pix: "PIX",
    cartao_credito: "Cartão de crédito (na entrega)",
  };
  linhas.push(`*Pagamento:* ${pgto[pedido.forma_pagamento] ?? pedido.forma_pagamento}`);

  if (pedido.observacao) {
    linhas.push("");
    linhas.push(`*Observação:* ${pedido.observacao}`);
  }

  return linhas.join("\n");
}

export function whatsappUrl(telefone: string, mensagem: string): string {
  const numero = onlyDigits(telefone);
  const withCountry = numero.startsWith("55") ? numero : `55${numero}`;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(mensagem)}`;
}
