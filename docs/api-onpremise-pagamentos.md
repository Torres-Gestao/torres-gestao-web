# Contrato — API On-Premise (Pagamentos)

O storefront (GitHub Pages) NUNCA fala direto com o Mercado Pago. Todo o fluxo
passa pelo seu backend on-premise, que:

1. valida o pedido,
2. lê as credenciais criptografadas em `loja_pagamento_config`,
3. cria a preferência no gateway (Mercado Pago hoje; Stone/Cielo/... depois),
4. insere o pedido no Supabase com `status_pgto='pendente'`,
5. devolve `init_point` (URL de checkout) para o front redirecionar.

O webhook do gateway também é recebido pelo on-premise, que atualiza
`pedidos.status_pgto` (+ `provider_payment_id`, `valor_pago`, `pago_em`) e
grava um registro em `pagamento_eventos`.

---

## Variável de ambiente (front)

```
VITE_ONPREMISE_API_URL=https://api.suaempresa.com
```

Configure no `.env` local e nos Secrets do repositório para o GitHub Actions.

---

## POST `/api/pedidos`

Criar um pedido e (se online) gerar a preferência de pagamento.

### Request body

```json
{
  "pedido_id": "uuid-gerado-pelo-front",
  "loja_id": "uuid",
  "loja_slug": "torres-gestao-web",
  "cliente": {
    "id": "uuid",
    "nome": "Fulano",
    "telefone": "11999998888"
  },
  "modalidade": "delivery",
  "endereco": {
    "rua": "...", "numero": "...", "bairro": "...",
    "complemento": null, "cidade": "...", "uf": "SP", "cep": "00000-000"
  },
  "itens": [ /* array ItemCarrinho */ ],
  "total_general": 79.90,
  "observacao": null,
  "metodo_pgto": "pix",
  "return_url": "https://.../#/torres-gestao-web/pedido/<pedido_id>"
}
```

### Response 200

```json
{
  "pedido_id": "uuid",
  "provider": "mercadopago",
  "provider_preference_id": "1234567890-abc",
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=..."
}
```

### Response de erro

```json
{ "error": "mensagem legível" }
```

---

## POST `/api/webhooks/mercadopago`

Endpoint do on-premise que recebe notificações do MP. Não é chamado pelo front.
Ele deve:

- validar assinatura,
- buscar o pagamento em `/v1/payments/{id}` com o token da loja,
- atualizar em `pedidos`: `status_pgto`, `provider_payment_id`, `valor_pago`, `pago_em`,
- inserir em `pagamento_eventos`.

---

## Segurança

- Credenciais das lojas ficam em `loja_pagamento_config.credenciais` **criptografadas**
  (AES-GCM com chave em cofre do on-premise). Nunca retornar credenciais na API.
- O front só lê `loja_pagamento_publico` (view sem credenciais).
- CORS: liberar apenas o domínio do storefront (github.io ou custom domain).

---

## Campos consumidos pelo poller Asaas (v2)

A partir da migration 003, o front grava dados do pagador diretamente em `pedidos`.
O poller on-premise deve mapear:

| Coluna no `pedidos`     | Campo Asaas (customer) |
|-------------------------|------------------------|
| `cliente_nome`          | `name`                 |
| `cliente_telefone`      | `mobilePhone`          |
| `cliente_email`         | `email`                |
| `cliente_cpf`           | `cpfCnpj`              |

Também presentes em `clientes` (para reuso entre pedidos):
- `clientes.email`
- `clientes.cpf`

### Fluxo "pague antes"

O front agora **aguarda** o `init_point` ser gravado antes de sair do checkout
(polling a cada 2s, timeout 60s). Portanto o poller deve:

1. Detectar pedidos com `status_pgto='pendente'` e `init_point IS NULL`.
2. Criar a cobrança no Asaas.
3. Gravar `pedidos.init_point` (URL de pagamento) o mais rápido possível — idealmente < 10s.

Se o `init_point` demorar mais que 60s, o cliente vê uma tela de fallback com opção de tentar de novo ou abrir a tela de acompanhamento.
