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

---

# Ajustes adicionais no checkout

## 1. Nome e telefone obrigatórios

- Marcar visualmente os campos "Nome completo" e "WhatsApp / Telefone" como obrigatórios (asterisco + `required`/`aria-required`).
- Validar antes de enviar: nome com pelo menos 3 caracteres e telefone com 10 ou 11 dígitos. Hoje só se checa se estão vazios, então "a" e "1" passam.
- Mostrar erro embaixo do campo (além do toast) e manter o botão Finalizar bloqueado enquanto qualquer um dos dois for inválido.

## 2. Confirmação de endereço no mapa como etapa obrigatória

- Renomear a seção/bloco do mapa para "Confirmação de endereço" e trocar o texto auxiliar para algo como "Arraste o pin até a porta da sua casa e confirme — é assim que o entregador te encontra."
- O mapa passa a aparecer sempre que a modalidade for entrega, o frete estiver ativo e já houver uma coordenada (geocodificada ou padrão), não apenas quando o Mapbox falha ou quando o cliente clica em "Ajustar no mapa". O botão "Ajustar no mapa" deixa de existir.
- Novo estado no checkout: `enderecoConfirmado` (boolean). Começa `false`, e volta a `false` sempre que o endereço mudar (rua, número, bairro, cidade, UF, CEP), quando o geocode rodar de novo ou quando o pin for arrastado.
- Abaixo do mapa, um botão "Confirmar este local" que marca `enderecoConfirmado = true` e exibe a confirmação com o endereço do reverse geocode.
- Finalizar fica bloqueado enquanto `enderecoConfirmado` for `false` na modalidade entrega com frete ativo; o rótulo do botão passa a "Confirme o endereço no mapa".
- A coordenada confirmada continua sendo a usada no cálculo do frete e é gravada em `clientes.endereco` (`latitude`/`longitude`), como já acontece hoje.

Retirada no local segue sem mapa e sem essa obrigatoriedade.
