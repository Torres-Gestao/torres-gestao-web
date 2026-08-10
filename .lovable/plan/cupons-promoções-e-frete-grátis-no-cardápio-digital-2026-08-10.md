# Cupons, promoções e frete grátis no cardápio digital

Implementação da PARTE B (site). O PDV publica os cupons na tabela `cupons` e lê o pedido já resolvido; o site aplica, calcula e grava.

## O que o cliente vê

- No checkout, um campo "Cupom de desconto" com botão Aplicar (e "remover" depois de aplicado).
- Feedback claro por erro: cupom inexistente, expirado, fora do canal delivery, valor mínimo não atingido, limite atingido, só para primeira compra.
- Promoções automáticas (cupons sem código) aplicadas sozinhas, com o nome da promoção no resumo.
- Resumo do pedido passa a ter 4 linhas: Subtotal, Desconto, Taxa de entrega (riscada quando entrega grátis), Total.
- Botão Finalizar continua bloqueado enquanto o frete calcula, e agora também enquanto o cupom valida.

## Banco de dados

Migration 009:

- Tabela `cupons` exatamente com o contrato acordado (colunas, `unique (loja_id, pdv_cupom_id)`, RLS de leitura pública com `ativo = true`), mais `GRANT SELECT ... TO anon, authenticated` e `GRANT ALL ... TO service_role` — sem o grant o site não lê a tabela.
- Colunas novas em `pedidos`: `cupom_id`, `cupom_codigo`, `valor_desconto`, `entrega_gratis`, `cupons_aplicados`.
- RPC `contar_usos_cupom(p_cupom_id uuid, p_telefone text)` — SECURITY DEFINER, retorna `{ total, do_cliente }` contando pedidos não cancelados. Necessária porque `SELECT` em `pedidos` está revogado para o anônimo (migration 001), então o site não consegue contar usos direto; a RPC devolve só números, sem expor dados de outros clientes.
- `GRANT EXECUTE` da RPC para `anon`.

## Motor de cupons no site

`src/lib/cupons.ts` — porte da lógica do PDV, puro e testável:

- Vigência via `agendamento`: `sempre | unica | diaria | semanal | mensal | anual`, com faixa de horário opcional.
- Elegibilidade: canal `delivery`, `valor_minimo`, `qtd_minima`, `primeira_compra`, `limite_uso_total`, e `limite_por_cliente` apenas quando `tem_limite_por_cliente = true`.
- Tipos: `percentual`, `valor_fixo` (com opção `por_item` em `regra`), `leve_x_pague_y`, `item_gratis`, `compre_x_ganhe_desconto`.
- Escopos: `pedido` (base = subtotal), `itens` (base = itens em `produtos_alvo`/`categorias_alvo`), `entrega` (base = taxa de entrega; `percentual` 100 = entrega grátis).
- Empilhamento: soma os `acumulavel`; senão aplica o de maior `prioridade` e, em empate, o de maior desconto.
- Desconto nunca ultrapassa a base (produtos ou frete), e o total nunca fica negativo.

`src/hooks/useCupons.ts` — carrega cupons ativos da loja e expõe `aplicarCodigo`, `remover`, `promocoesAutomaticas` e o resultado calculado.

## Checkout

- Reage a mudanças de itens, modalidade e frete: quando o frete muda, o cupom é recalculado (importante para o escopo `entrega`).
- Grava no pedido: `cupom_id`, `cupom_codigo`, `valor_desconto`, `entrega_gratis`, `cupons_aplicados`, `taxa_entrega` já zerada em caso de entrega grátis e `total_general = total_produtos + taxa_entrega − valor_desconto`.
- Pagamento online (Asaas) continua usando `total_general` — o desconto entra na cobrança automaticamente, sem tocar no on-premise.
- Tela de acompanhamento (`AcompanhamentoPedido`) mostra a linha de desconto e o selo de entrega grátis.

## Detalhes técnicos

- Tipos novos em `src/types/db.ts`: `Cupom`, `CupomAplicado`, `ResultadoCupom`, campos novos em `Pedido`, entrada `cupons` no `Database`.
- Validação de entrada do código: trim, uppercase, máx. 40 caracteres, apenas alfanumérico/hífen.
- O cupom aplicado fica em memória do checkout (não no `localStorage`), revalidado no clique de Finalizar para evitar cupom vencido entre o Aplicar e o envio.

## Nota de segurança

Com o site como fonte da verdade e chave anônima, um usuário técnico consegue forjar `valor_desconto`/`total_general` no insert. Blindagem futura sem mexer no resto: mover o insert do pedido para uma Edge Function que recalcula desconto e total no servidor. Não incluído nesta etapa.
