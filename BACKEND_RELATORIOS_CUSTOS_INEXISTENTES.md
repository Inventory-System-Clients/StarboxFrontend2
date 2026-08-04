# Prompt Backend - Correção de Custos Inexistentes nos Relatórios por Loja

## Problema reportado
Nos relatórios por ponto/loja, estão aparecendo custos fixos inexistentes.

Exemplo real:
- Loja: "Ponto reposição"
- Não há custo fixo cadastrado para a loja
- Mesmo assim, o relatório mostra custo elevado acima do custo de saída de produtos

## Regra de negócio obrigatória
Para relatório de loja/ponto, **todo custo deve vir apenas de**:
1. Gastos fixos cadastrados para aquela própria loja
2. Custo dos produtos que saíram no período
3. (Se existir no produto) custo unitário histórico aplicado à quantidade de saída

Não incluir custos globais, custos de outras lojas, nem agregações sem vínculo com loja.

## Suspeita técnica
Há forte indício de uma (ou mais) falhas no backend:
- `gastoTotalPeriodo` incluindo categorias não mapeadas para a loja
- Junção sem filtro por `lojaId` ao buscar gastos fixos
- Duplicidade por join (multiplicação de linhas) entre movimentações/produtos/gastos
- Fallback de custo total utilizando valor consolidado/global em vez de custo da loja

## Endpoints para revisar
- `GET /relatorios/impressao?lojaId=...&dataInicio=...&dataFim=...`
- `GET /relatorios/todas-lojas?dataInicio=...&dataFim=...`
- `GET /gastos-fixos-loja/:lojaId`

## Correções esperadas

### 1. Escopo estrito por loja
Todo cálculo deve filtrar por `lojaId` da requisição.

### 2. Custo fixo da loja
`custoFixoTotal` deve ser a soma apenas de gastos fixos ativos da loja solicitada.

### 3. Custo de produtos saídos
`custoProdutosSairam` deve ser calculado com base em saídas reais no período e custo unitário correspondente do produto.

### 4. Fórmula canônica do custo total da loja
Para resposta do relatório de loja:

- `custoTotal = custoFixoTotal + custoProdutosSairam`
- Se houver campo de quebra de caixa, manter separado (`custoQuebraCaixa`) e **não misturar silenciosamente** em `gastoTotalPeriodo` sem transparência.

### 5. Transparência de composição
Retornar também composição explícita para debug/auditoria:

```json
{
  "totais": {
    "custoFixoTotal": 0,
    "custoProdutosSairam": 120.50,
    "custoTotal": 120.50,
    "custoQuebraCaixa": 0,
    "gastoTotalPeriodo": 120.50,
    "custosNaoMapeados": 0
  }
}
```

Se `custosNaoMapeados > 0`, isso deve ser considerado bug e registrado em log com rastreio.

## Critérios de aceite

### Caso 1 - Loja sem gasto fixo cadastrado
Dado:
- loja sem registros em `gastos_fixos_loja`
- período com saídas de produto totalizando R$ 80,00

Esperado:
- `custoFixoTotal = 0`
- `custoProdutosSairam = 80,00`
- `custoTotal = 80,00`
- `custosNaoMapeados = 0`

### Caso 2 - Loja com gasto fixo cadastrado
Dado:
- gasto fixo da loja = R$ 50,00
- custo produtos saíram = R$ 80,00

Esperado:
- `custoTotal = 130,00`
- sem valores extras ocultos

### Caso 3 - Consolidado todas lojas
Esperado:
- cada loja calculada isoladamente
- total consolidado = soma exata das lojas
- sem vazamento de custo entre lojas

## SQL de verificação (exemplo)
```sql
-- 1) Gastos fixos da loja (apenas loja alvo)
SELECT COALESCE(SUM(gf.valor), 0) AS custo_fixo_loja
FROM gastos_fixos_loja gf
WHERE gf.loja_id = :lojaId
  AND gf.ativo = TRUE;

-- 2) Custo de produtos saídos no período da loja
SELECT COALESCE(SUM(ps.quantidade * ps.custo_unitario), 0) AS custo_produtos_sairam
FROM produtos_sairam ps
JOIN movimentacoes m ON m.id = ps.movimentacao_id
WHERE m.loja_id = :lojaId
  AND m.data_coleta::date BETWEEN :dataInicio AND :dataFim;
```

## Observações importantes
- Revisar joins para evitar multiplicação de linhas por relacionamento 1:N
- Revisar fallback de `gastoTotalPeriodo` para não usar dados globais
- Garantir testes de regressão por loja com e sem gastos fixos

## Resultado esperado final
Após a correção, uma loja sem gastos fixos cadastrados não pode exibir custo fixo no relatório. O custo total deve refletir apenas o que está cadastrado para a loja e o custo dos produtos que saíram no período.
