# Correção: cupom "não encontrado" (códigos com underscore)

## Causa confirmada

O cupom da loja é `FRETE_FREE` (ativo, canal `delivery`). Ao digitar, o site normaliza o código removendo tudo que não for letra, número ou hífen (`src/lib/cupons.ts:92-98`), transformando `FRETE_FREE` em `FRETEFREE`. A comparação com o cupom carregado usa o código original (`FRETE_FREE`), então nunca casa e cai na mensagem "cupom não encontrado".

## Correção

- Passar a aceitar underscore (e ponto) na normalização do código digitado: manter `A-Z 0-9 - _ .`.
- Normalizar dos dois lados: comparar o código digitado com o código do cupom passando ambos pela mesma função, em vez de só `trim().toUpperCase()` no lado do banco. Isso evita novas divergências (espaços, acentos, caracteres estranhos vindos do PDV).
- Aplicar essa comparação nos três pontos onde o código é procurado no hook (`aplicarCodigo`, cálculo do resultado e `revalidar`).

## Detalhes técnicos

- `src/lib/cupons.ts`: ajustar o regex de `normalizaCodigo` e exportar um helper de comparação.
- `src/hooks/useCupons.ts`: usar o helper nas três buscas por `codigo`.

Sem mudanças de banco ou de UI.
