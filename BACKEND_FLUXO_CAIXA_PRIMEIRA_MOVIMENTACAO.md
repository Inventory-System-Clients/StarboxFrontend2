# Prompt Backend - Correção de Valor Esperado no Fluxo de Caixa (Primeira Movimentação)

## Objetivo
Corrigir a geração do `valorEsperado` no fluxo de caixa quando a **primeira movimentação da máquina** cria 2 registros de movimentação (um inicial com contador menor e outro com contador maior na sequência).

Hoje, em alguns cenários, mesmo com duas movimentações criadas, o valor esperado no fluxo de caixa fica incorreto.

## Cenário do Problema
Na primeira coleta de uma máquina:
1. É criada uma movimentação base (contador anterior)
2. É criada a movimentação atual (contador maior)

Exemplo de contadores IN:
- Movimento A (base): `contadorIn = 1000`
- Movimento B (atual): `contadorIn = 1200`

Valor da jogada (`valorFicha`) = `2.00`

Esperado para retirada do movimento B:
- Diferenca de IN = `1200 - 1000 = 200`
- `valorEsperado = 200 / 2.00 = 100.00`

## Suspeita Técnica
A lógica backend provavelmente está:
- Pegando contador anterior errado (ou nulo), ou
- Processando em ordem não determinística quando timestamps são iguais/muito próximos, ou
- Não tratando corretamente o par de movimentações da primeira coleta.

## Requisitos de Correção

### 1. Ordem determinística por máquina
Ao calcular `valorEsperado`/`ultimoContador...`, ordenar as movimentações da máquina com regra estável:
1. `dataColeta ASC` (ou campo oficial de data da coleta)
2. `createdAt ASC`
3. `contadorIn ASC` (nulos por último)
4. `contadorOut ASC` (nulos por último)
5. `id ASC`

Isso evita inversão quando dois registros da primeira movimentação têm mesma data.

### 2. Regra para contador anterior
Para cada movimentação candidata a retirada:
- Prioridade 1: usar `contadorInAnterior`/`contadorOutAnterior` persistidos na própria movimentação (se existirem e forem válidos)
- Prioridade 2: usar último contador atual válido da movimentação anterior da mesma máquina
- Nunca sobrescrever último contador válido com `null`

### 3. Cálculo do valor esperado
Para cada fluxo de caixa:
- `deltaIn = max(0, contadorInAtual - contadorInAnterior)`
- `valorEsperado = deltaIn / valorFicha` (quando `valorFicha > 0`)
- fallback para `deltaOut` apenas se regra de negócio permitir explicitamente

### 4. Primeira movimentação (duplo registro)
Quando detectar cenário de primeira movimentação com dois registros no mesmo contexto de coleta:
- Garantir que o registro com menor IN seja tratado como base
- Garantir que o registro com maior IN gere o fluxo com valor esperado usando a diferença entre ambos

### 5. Compatibilidade
Não quebrar fluxos já conferidos manualmente:
- Se `valorEsperado` foi ajustado manualmente por admin, manter ajuste
- Atualizar apenas `valorEsperadoCalculado` (ou campo técnico equivalente) para novos cálculos

## Endpoint(s) afetados
- `GET /fluxo-caixa`
- `GET /fluxo-caixa/resumo` (se usa os mesmos cálculos)
- Qualquer serviço interno que calcula `valorEsperado`, `valorEsperadoCalculado`, `ultimoContadorInRetirada`, `ultimoContadorOutRetirada`

## Critérios de Aceite

### Caso 1 - Primeira movimentação com dois registros
Dado:
- Mov A: IN=1000
- Mov B: IN=1200
- valorFicha=2.00

Resultado esperado:
- Fluxo do mov B com `valorEsperado = 100.00`
- `ultimoContadorInRetirada` do mov B = 1000

### Caso 2 - Mesmo timestamp
Dado dois registros com mesmo `dataColeta`,
Resultado esperado:
- Ordem final correta pelo desempate (`createdAt`, `contadorIn`, `contadorOut`, `id`)
- Cálculo estável e repetível

### Caso 3 - Campo anterior nulo
Se movimentação atual vier sem `contadorInAnterior`,
Resultado esperado:
- Backend usa último contador atual válido anterior da máquina
- Não perde referência por sobrescrita com nulo

### Caso 4 - Fluxo já conferido manualmente
Resultado esperado:
- `valorEsperado` manual permanece
- Campo calculado técnico pode ser atualizado sem perder histórico

## Testes Recomendados
1. Teste unitário do serviço de cálculo com dataset da primeira movimentação em duplicidade
2. Teste de integração do endpoint `GET /fluxo-caixa` validando `valorEsperadoCalculado`
3. Teste com timestamps iguais
4. Teste com nulos em `contadorInAnterior`/`contadorOutAnterior`
5. Teste de regressão para fluxos antigos e conferidos

## Consulta de apoio (exemplo SQL)
```sql
SELECT
  m.id,
  m.maquina_id,
  m.data_coleta,
  m.created_at,
  m.contador_in,
  m.contador_in_anterior,
  m.contador_out,
  m.contador_out_anterior,
  fc.id AS fluxo_id,
  fc.valor_esperado,
  fc.valor_esperado_calculado
FROM movimentacoes m
LEFT JOIN fluxo_caixa fc ON fc.movimentacao_id = m.id
WHERE m.maquina_id = :maquinaId
ORDER BY
  m.data_coleta ASC,
  m.created_at ASC,
  m.contador_in ASC NULLS LAST,
  m.contador_out ASC NULLS LAST,
  m.id ASC;
```

## Resultado Esperado Final
Após a correção, toda primeira movimentação que gerar dois registros deve refletir corretamente o valor esperado no fluxo de caixa, sem depender de ajuste manual no frontend/admin.
