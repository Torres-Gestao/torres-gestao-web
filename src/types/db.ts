// Tipos manuais que espelham o schema Supabase.

export interface Loja {
  id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
  cor_primaria: string | null;
  cor_secundaria: string | null;
  telefone_contato: string | null;
  loja_aberta: boolean | null;
  created_at: string | null;
}

export interface Categoria {
  id: string;
  loja_id: string;
  pdv_categoria_id: string | null;
  nome: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

export interface Produto {
  id: string;
  loja_id: string;
  categoria_id: string | null;
  pdv_produto_id: string | null;
  nome: string;
  descricao: string | null;
  preco: number;
  imagem_url: string | null;
  ativo: boolean;
  disponivel: boolean;
  ordem: number;
  opcoes: unknown | null;
  created_at: string;
  updated_at: string;
}

export type Modalidade = "delivery" | "retirada";
export type FormaPagamento = "dinheiro" | "pix" | "cartao_credito";

export type StatusPedido =
  | "pendente"
  | "aceito"
  | "em_preparo"
  | "pronto"
  | "em_rota"
  | "concluido"
  | "cancelado";

// Compat com código anterior
export type StatusWeb = StatusPedido;

export interface EnderecoCliente {
  rua?: string | null;
  numero?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  uf?: string | null;
  cep?: string | null;
}

export interface Cliente {
  id: string;
  loja_id: string;
  nome: string;
  telefone: string;
  endereco: EnderecoCliente | null;
  created_at: string;
}

export interface PedidoItem {
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao?: string;
}

export interface Pedido {
  id: string;
  loja_id: string | null;
  cliente_id: string | null;
  numero_pedido: number;
  cliente_nome: string;
  cliente_telefone: string;
  modalidade: Modalidade;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  cidade: string | null;
  cep: string | null;
  uf: string | null;
  itens: PedidoItem[];
  total_produtos: number;
  taxa_entrega: number | null;
  total_general: number;
  forma_pagamento: FormaPagamento;
  observacao: string | null;
  status: StatusPedido;
  status_web: StatusWeb | null;
  created_at: string | null;
  agendado: boolean;
  data_agendada: string | null;
}

export interface Database {
  public: {
    Tables: {
      lojas: { Row: Loja; Insert: Partial<Loja>; Update: Partial<Loja> };
      categorias: { Row: Categoria; Insert: Partial<Categoria>; Update: Partial<Categoria> };
      produtos: { Row: Produto; Insert: Partial<Produto>; Update: Partial<Produto> };
      clientes: { Row: Cliente; Insert: Partial<Cliente>; Update: Partial<Cliente> };
      pedidos: {
        Row: Pedido;
        Insert: Omit<Partial<Pedido>, "itens"> & { itens: PedidoItem[] };
        Update: Partial<Pedido>;
      };
    };
  };
}
