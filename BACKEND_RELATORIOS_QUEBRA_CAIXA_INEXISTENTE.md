# Prompt Backend - Correção de Quebra de Caixa Inexistente em Relatórios

## Problema
No relatório da loja selecionada está aparecendo `custoQuebraCaixa` mesmo quando não existe quebra real no período.

## Regra de negócio
Só existe quebra de caixa quando:
1. Há conferência efetiva da retirada (valor retirado informado), e
2. `valorRetirado < valorEsperado`, ou
3. Status/conferência explícita de `nao_bateu` com valores válidos.

Se não houver conferência/retirada válida, quebra deve ser `0`.

## Suspeitas no backend
- Fluxos pendentes sendo tratados como retirada `0`
- Cálculo usando fallback sem `valorRetirado` preenchido
- Inclusão de registros sem `valorEsperado`/`valorRetirado` no somatório da quebra

## Endpoints para revisar
- `GET /fluxo-caixa`
- `GET /relatorios/impressao`
- `GET /relatorios/todas-lojas`
- (se houver) serviço interno de agregação de quebra de caixa por período

## Correção esperada

### 1. Filtrar registros elegíveis para quebra
Somente considerar no cálculo de quebra registros com:
- `valorRetirado` não nulo, e
- `valorEsperado` (ou `valorEsperadoCalculado`) não nulo

### 2. Regras de status
- `conferencia = pendente` sem valor retirado: não entra no cálculo
- `conferencia = bateu`: quebra = 0
- `conferencia = nao_bateu`: só calcular se houver valores válidos

### 3. Fórmula
```text
diferenca = valorRetirado - valorEsperado
quebra = abs(diferenca) somente quando diferenca < 0
```

### 4. Composição transparente no payload
Retornar no relatório:
- `custoQuebraCaixa`
- `quantidadeFluxosConsideradosQuebra`
- `quantidadeFluxosIgnoradosQuebra`

Isso facilita auditoria no frontend.

## Critérios de aceite

### Caso 1 - Sem conferência
- Fluxos pendentes sem valor retirado
- Esperado: `custoQuebraCaixa = 0`

### Caso 2 - Conferência bateu
- Valor retirado igual ou maior que esperado
- Esperado: `custoQuebraCaixa = 0`

### Caso 3 - Conferência não bateu real
- Valor retirado menor que esperado
- Esperado: `custoQuebraCaixa > 0` com valor correto

### Caso 4 - Loja sem quebra no período
- Esperado: `custoQuebraCaixa = 0` em todos os endpoints de relatório

## SQL de verificação (exemplo)
```sql
SELECT
  COUNT(*) FILTER (
    WHERE fc.valor_retirado IS NOT NULL
      AND COALESCE(fc.valor_esperado, fc.valor_esperado_calculado) IS NOT NULL
  ) AS fluxos_validos,
  COALESCE(SUM(
    CASE
      WHEN fc.valor_retirado < COALESCE(fc.valor_esperado, fc.valor_esperado_calculado)
      THEN COALESCE(fc.valor_esperado, fc.valor_esperado_calculado) - fc.valor_retirado
      ELSE 0
    END
  ), 0) AS quebra_total
FROM fluxo_caixa fc
JOIN movimentacoes m ON m.id = fc.movimentacao_id
WHERE m.loja_id = :lojaId
  AND m.data_coleta::date BETWEEN :dataInicio AND :dataFim;
```

## Resultado esperado final
A loja só deve apresentar quebra de caixa quando houver conferência real com retirada abaixo do esperado. Em qualquer outro caso, o custo de quebra deve ser zero.
