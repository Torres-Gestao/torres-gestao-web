# Cupons automáticos (sem código) com todas as regras respeitadas

Cupons sem `codigo` já são aplicados sozinhos no checkout hoje. O que falta é que eles respeitem, de fato, os campos que dependem de dados do banco: limite de uso total, limite por cliente e primeira compra. Hoje esses contadores só são buscados quando o cliente clica em "Aplicar" um código digitado — para os automáticos o motor assume "sem usos" e "primeira compra = sim", então esses limites nunca bloqueiam.

## O que muda para o cliente

- Promoções automáticas continuam entrando sozinhas no resumo, com o nome da promoção e o valor do desconto.
- Uma promoção que já atingiu o limite de usos (total ou por cliente) deixa de aparecer.
- Uma promoção marcada como "somente primeira compra" só aparece para quem ainda não fez pedido na loja (avaliada assim que o telefone estiver preenchido).
- Promoções de entrega grátis continuam riscando a taxa de entrega no resumo.

## Como fica tecnicamente

Em `src/hooks/useCupons.ts`:

- Carregar os contadores dos cupons automáticos em efeito próprio, logo após a lista de cupons chegar: uma chamada a `contar_usos_cupom` por cupom automático que tenha `limite_uso_total > 0` ou `tem_limite_por_cliente = true`. Cupons sem limite não geram chamada.
- Recarregar esses contadores quando o telefone (apenas dígitos, 10-11 caracteres) mudar, com debounce, já que `do_cliente` depende do telefone.
- Buscar `contar_pedidos_cliente` uma vez por telefone válido para definir `primeiraCompra`, em vez de só dentro de `aplicarCodigo`. Enquanto não houver telefone válido, tratar cupons com `primeira_compra = true` como ainda não elegíveis, para não mostrar um desconto que some depois.
- Extrair a lógica de contagem para uma função reutilizável, evitando duplicação com `aplicarCodigo` e evitando chamadas repetidas para o mesmo par (cupom, telefone) via cache em ref.

Nada muda em `src/lib/cupons.ts` (o motor já valida limites e primeira compra), no banco ou no payload do pedido: `cupons_aplicados` já grava os automáticos e `cupom_id`/`cupom_codigo` continuam priorizando o cupom digitado.
