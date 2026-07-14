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

// Métodos aceitos no pagamento online / na entrega
export type MetodoPagamento = "pix" | "cartao_credito" | "cartao_debito" | "dinheiro" | "na_entrega";

// Status do pagamento (espelha o enum status_pagamento no Postgres)
export type StatusPagamento =
  | "nao_aplicavel"
  | "pendente"
  | "em_processo"
  | "aprovado"
  | "recusado"
  | "estornado"
  | "cancelado";

export type PaymentProvider = "mercadopago" | "stone" | "cielo" | "pagarme" | "asaas";

export interface LojaPagamentoPublico {
  loja_id: string;
  provider: PaymentProvider;
  metodos_aceitos: MetodoPagamento[];
  aceita_na_entrega: boolean;
  ativo: boolean;
}

// ---------- Perguntas / complementos ----------
export type PerguntaTipo = "observacao" | "adicao_produto";

// Uma resposta possível pode vir em 3 formatos no jsonb do PDV.
export type RespostaOpcao =
  | string
  | { tipo: "observacao"; ativo?: boolean; resposta: string }
  | {
      tipo: "produto";
      nome: string;
      ativo?: boolean;
      preco: number;
      imagem?: string | null;
      produtoId?: string;
    };

export interface Pergunta {
  id: string;
  loja_id: string;
  pdv_pergunta_id: string | null;
  texto: string;
  tipo: PerguntaTipo;
  ordem: number;
  min_selections: number;
  max_selections: number;
  required: boolean;
  respostas: RespostaOpcao[];
  produtos_vinculados: string[]; // lista de pdv_produto_id
  ativo: boolean;
  created_at: string | null;
  updated_at: string | null;
}

// Escolha feita pelo cliente para uma pergunta (salva no pedido).
export interface EscolhaResposta {
  nome: string;
  preco?: number;
  produtoId?: string;
}

export interface RespostaSelecionada {
  pergunta_id: string;
  pdv_pergunta_id: string | null;
  texto: string;
  tipo: PerguntaTipo;
  escolhas: EscolhaResposta[];
}

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
  email: string | null;
  cpf: string | null;
  endereco: EnderecoCliente | null;
  created_at: string;
}

export interface PedidoItem {
  uid?: string; // identidade da linha no carrinho (produto + respostas)
  produto_id: string;
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  observacao?: string;
  respostas?: RespostaSelecionada[];
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
  // ---- Pagamento online ----
  status_pgto: StatusPagamento;
  metodo_pgto: MetodoPagamento | null;
  provider_preference_id: string | null;
  provider_payment_id: string | null;
  init_point: string | null;
  valor_pago: number | null;
  pago_em: string | null;
}




export interface Database {
  public: {
    Tables: {
      lojas: { Row: Loja; Insert: Partial<Loja>; Update: Partial<Loja> };
      categorias: { Row: Categoria; Insert: Partial<Categoria>; Update: Partial<Categoria> };
      produtos: { Row: Produto; Insert: Partial<Produto>; Update: Partial<Produto> };
      perguntas: { Row: Pergunta; Insert: Partial<Pergunta>; Update: Partial<Pergunta> };
      clientes: { Row: Cliente; Insert: Partial<Cliente>; Update: Partial<Cliente> };
      pedidos: {
        Row: Pedido;
        Insert: Omit<Partial<Pedido>, "itens"> & { itens: PedidoItem[] };
        Update: Partial<Pedido>;
      };
    };
    Functions: {
      get_pedido: {
        Args: { p_id: string };
        Returns: Pedido[];
      };
    };
  };
}
