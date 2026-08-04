# Solicitação Backend - Alertas de Contas Financeiras

## Contexto
Foi adicionado um novo conjunto de 3 cards no dashboard financeiro para mostrar alertas sobre contas a pagar.

## Endpoint Afetado

### GET `/api/reports/dashboard` (ou similar)

O endpoint que retorna os dados do dashboard financeiro precisa incluir os seguintes campos adicionais no objeto de resposta:

## Novos Campos Necessários

```javascript
{
  // ... campos existentes ...
  total_paid: number,
  total_open: number,
  upcoming_bills: number,
  overdue_bills: number,
  bills_by_category: [...],
  bills_by_date: [...],
  
  // 🆕 NOVOS CAMPOS
  // Contas que vencem HOJE
  bills_due_today: number,        // Quantidade de contas com vencimento hoje
  amount_due_today: number,       // Valor total das contas que vencem hoje
  
  // Contas que vencem nos próximos 3 dias (incluindo hoje)
  bills_due_3_days: number,       // Quantidade de contas com vencimento em até 3 dias
  amount_due_3_days: number,      // Valor total das contas que vencem em até 3 dias
  
  // Contas em dia (pagas ou com vencimento > 3 dias)
  bills_up_to_date: number,       // Quantidade de contas em dia
  amount_up_to_date: number       // Valor total das contas em dia
}
```

## Lógica de Cálculo

### 1. bills_due_today / amount_due_today
Contas com status "pending" (ou "aberto") onde:
```sql
data_vencimento = CURRENT_DATE
```

### 2. bills_due_3_days / amount_due_3_days
Contas com status "pending" onde:
```sql
data_vencimento BETWEEN CURRENT_DATE AND (CURRENT_DATE + INTERVAL 3 DAYS)
```

### 3. bills_up_to_date / amount_up_to_date
Tem duas categorias:
- **Contas pagas**: `status = 'paid'`
- **Contas com vencimento distante**: `status = 'pending' AND data_vencimento > (CURRENT_DATE + INTERVAL 3 DAYS)`

## Exemplo de Resposta Esperada

```json
{
  "total_paid": 15000.50,
  "total_open": 8500.75,
  "upcoming_bills": 12,
  "overdue_bills": 3,
  "bills_due_today": 2,
  "amount_due_today": 1500.00,
  "bills_due_3_days": 5,
  "amount_due_3_days": 3200.00,
  "bills_up_to_date": 45,
  "amount_up_to_date": 12000.00,
  "bills_by_category": [
    {
      "category": "Aluguel",
      "total": 5000.00
    }
  ],
  "bills_by_date": [
    {
      "date": "2026-03-01",
      "count": 8
    }
  ]
}
```

## Casos de Teste

### Cenário 1: Conta vencendo hoje
```
Data atual: 2026-03-06
Conta: vencimento = 2026-03-06, status = "pending"
Resultado: Deve aparecer em bills_due_today ✅
```

### Cenário 2: Conta vencendo em 2 dias
```
Data atual: 2026-03-06
Conta: vencimento = 2026-03-08, status = "pending"
Resultado: Deve aparecer em bills_due_3_days ✅
```

### Cenário 3: Conta vencendo em 4 dias
```
Data atual: 2026-03-06
Conta: vencimento = 2026-03-10, status = "pending"
Resultado: Deve aparecer em bills_up_to_date ✅
```

### Cenário 4: Conta já paga
```
Data atual: 2026-03-06
Conta: vencimento = qualquer data, status = "paid"
Resultado: Deve aparecer em bills_up_to_date ✅
```

### Cenário 5: Conta atrasada
```
Data atual: 2026-03-06
Conta: vencimento = 2026-03-01, status = "pending"
Resultado: NÃO deve aparecer em bills_due_today nem bills_due_3_days
(Continua sendo contabilizada em overdue_bills que já existe) ✅
```

## Interface Frontend

Os novos cards são exibidos assim:

```
┌──────────────┬──────────────┬──────────────┐
│ 🔴 Contas a  │ 🟡 Contas a  │ 🟢 Contas    │
│ Pagar HOJE!  │ Pagar em 3   │ em Dia       │
│              │ Dias!        │              │
│ 2 contas     │ 5 contas     │ 45 contas    │
│ R$ 1.500,00  │ R$ 3.200,00  │ R$ 12.000,00 │
└──────────────┴──────────────┴──────────────┘
```

## Observações Importantes

1. **Timezone**: Usar a timezone local do sistema ou UTC consistentemente
2. **Performance**: Considerar criar índices nas colunas `data_vencimento` e `status`
3. **Cache**: Se o dashboard for muito acessado, considerar cache de alguns minutos
4. **Filtros**: Os cálculos devem respeitar os filtros de usuário (se houver separação por empresa ou usuário)

## Prioridade

**MÉDIA-ALTA**: Funcionalidade importante para gestão proativa das contas, mas não bloqueia o uso básico do sistema.

## Questões

1. As contas atrasadas devem ser incluídas em "Contas a pagar HOJE"?
   - **Sugestão**: Não, manter separado. Já existe o card de "Atrasadas" para isso.

2. Considerar apenas contas não pagas (pending) ou incluir outros status?
   - **Sugestão**: Apenas contas com status "pending" ou equivalente (não pagas).

3. O cálculo deve considerar algum filtro por tipo de conta (pessoal/empresarial)?
   - **Depende**: Se houver separação no backend, sim. Caso contrário, mostrar todas.

---

**Resumo**: Adicionar 6 novos campos numéricos no response do endpoint do dashboard para alimentar os cards de alerta de vencimento de contas. Frontend já está implementado e aguardando os dados! 🚀
