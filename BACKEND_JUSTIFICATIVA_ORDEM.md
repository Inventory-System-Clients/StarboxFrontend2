# 🔧 Backend: Retornar Campo `justificativa_ordem` na API de Movimentações

## 📋 Contexto

O frontend **já está implementado e funcionando** para exibir a justificativa de quebra de ordem do roteiro. A justificativa aparece em **3 locais diferentes**:

1. **Dashboard.jsx** - Card laranja abaixo dos contadores
2. **LojaDetalhes.jsx** - Histórico de movimentações da máquina selecionada  
3. **MaquinaDetalhes.jsx** - Tabela de movimentações da máquina

Porém, o campo **`justificativa_ordem` não está sendo retornado pelo backend** na API de movimentações.

---

## ❌ Problema Atual

Quando o frontend faz chamadas para buscar movimentações:

```javascript
// Exemplo 1 - Dashboard e outras páginas
api.get('/movimentacoes')

// Exemplo 2 - LojaDetalhes filtrando por máquina
api.get('/movimentacoes?maquinaId=${maquinaId}')

// Exemplo 3 - Filtros de data
api.get('/movimentacoes?dataInicio=...&dataFim=...')
```

O backend está retornando objetos de movimentação **SEM** o campo `justificativa_ordem`:

```json
{
  "id": "uuid...",
  "maquinaId": "uuid...",
  "lojaId": "uuid...",
  "totalPre": 50,
  "sairam": 10,
  "abastecidas": 15,
  "fichas": 20,
  "observacoes": "Tudo normal",
  "createdAt": "2026-03-09T10:30:00Z"
  // ❌ justificativa_ordem está faltando!
}
```

---

## ✅ Solução Necessária

O backend precisa **incluir o campo `justificativa_ordem`** em todas as respostas da API de movimentações.

### 1️⃣ Verificar se a coluna existe no banco

Execute no DBeaver ou cliente PostgreSQL:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'movimentacoes' 
  AND column_name = 'justificativa_ordem';
```

**Se não retornar nada**, a coluna não existe. Execute:

```sql
ALTER TABLE movimentacoes 
ADD COLUMN justificativa_ordem TEXT NULL;
```

### 2️⃣ Incluir o campo no SELECT das queries

Localize todas as queries de SELECT no backend que retornam movimentações e **adicione `justificativa_ordem`**:

**❌ Query incompleta atual:**
```sql
SELECT 
  id, 
  maquinaId, 
  lojaId, 
  totalPre, 
  sairam, 
  abastecidas, 
  fichas, 
  observacoes,
  createdAt, 
  updatedAt
FROM movimentacoes
WHERE ...
```

**✅ Query correta com justificativa_ordem:**
```sql
SELECT 
  id, 
  maquinaId, 
  lojaId, 
  totalPre, 
  sairam, 
  abastecidas, 
  fichas, 
  observacoes,
  justificativa_ordem,  -- ⬅️ ADICIONAR ESTA LINHA
  createdAt, 
  updatedAt
FROM movimentacoes
WHERE ...
```

### 3️⃣ Exemplo com Sequelize (se estiver usando)

**Modelo Movimentacao:**
```javascript
module.exports = (sequelize, DataTypes) => {
  const Movimentacao = sequelize.define('Movimentacao', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    // ... outros campos
    observacoes: DataTypes.TEXT,
    justificativa_ordem: DataTypes.TEXT, // ⬅️ ADICIONAR ESTE CAMPO
  }, {
    tableName: 'movimentacoes',
    timestamps: true
  });
  
  return Movimentacao;
};
```

**Controller que retorna movimentações:**
```javascript
// routes/movimentacoes.js ou controllers/movimentacoesController.js

router.get('/movimentacoes', async (req, res) => {
  try {
    const movimentacoes = await Movimentacao.findAll({
      attributes: [
        'id',
        'maquinaId', 
        'lojaId',
        'totalPre',
        'sairam',
        'abastecidas',
        'fichas',
        'observacoes',
        'justificativa_ordem', // ⬅️ ADICIONAR AQUI
        'createdAt',
        'updatedAt'
      ],
      where: { /* filtros */ },
      order: [['createdAt', 'DESC']],
      include: [ /* associações */ ]
    });
    
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### 4️⃣ Exemplo com Query Nativa (SQL puro)

```javascript
router.get('/movimentacoes', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        m.id,
        m."maquinaId",
        m."lojaId",
        m."totalPre",
        m.sairam,
        m.abastecidas,
        m.fichas,
        m.observacoes,
        m.justificativa_ordem,    -- ⬅️ ADICIONAR ESTE CAMPO
        m."createdAt",
        m."updatedAt",
        maq.nome as "maquinaNome",
        l.nome as "lojaNome"
      FROM movimentacoes m
      LEFT JOIN maquinas maq ON m."maquinaId" = maq.id
      LEFT JOIN lojas l ON m."lojaId" = l.id
      WHERE m."deletedAt" IS NULL
      ORDER BY m."createdAt" DESC
    `);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🧪 Como Testar

### Teste 1: Verificar campo no banco
```sql
-- Buscar movimentações que têm justificativa registrada
SELECT 
  id, 
  "maquinaId", 
  justificativa_ordem, 
  "createdAt"
FROM movimentacoes 
WHERE justificativa_ordem IS NOT NULL
ORDER BY "createdAt" DESC
LIMIT 10;
```

### Teste 2: Testar endpoint manualmente

No Postman, Insomnia ou navegador:

```
GET http://localhost:3000/movimentacoes
```

**Resposta esperada:**
```json
[
  {
    "id": "uuid-123",
    "maquinaId": "uuid-456",
    "lojaId": "uuid-789",
    "totalPre": 50,
    "sairam": 10,
    "abastecidas": 15,
    "fichas": 20,
    "observacoes": "Tudo ok",
    "justificativa_ordem": "Cliente pediu para atender primeiro", // ✅ DEVE APARECER
    "createdAt": "2026-03-09T10:30:00.000Z",
    "updatedAt": "2026-03-09T10:30:00.000Z"
  }
]
```

### Teste 3: Verificar no frontend

Após corrigir o backend:

1. Abra o navegador (F12 para console)
2. Navegue até **Dashboard** ou **Lojas > [Selecione uma loja] > [Clique em uma máquina]**
3. Verifique se aparece o card laranja com a justificativa:

```
⚠️ ORDEM DO ROTEIRO ALTERADA
Justificativa: [texto que foi digitado]
```

---

## 📝 Resumo do Checklist

- [ ] Verificar se coluna `justificativa_ordem` existe na tabela `movimentacoes`
- [ ] Se não existir, executar `ALTER TABLE movimentacoes ADD COLUMN justificativa_ordem TEXT NULL;`
- [ ] Adicionar campo no modelo Sequelize (se aplicável)
- [ ] Adicionar campo em TODOS os SELECT queries de movimentações
- [ ] Adicionar campo nos atributos do `findAll()` (se Sequelize)
- [ ] Testar endpoint manualmente (Postman/Insomnia)
- [ ] Verificar no banco se há registros com justificativa preenchida
- [ ] Testar no frontend (deve aparecer card laranja quando houver justificativa)

---

## 🔍 Locais no Backend Para Verificar

Procure por estes arquivos/trechos:

- `models/movimentacao.js` ou `models/movimentacoes.js`
- `controllers/movimentacoesController.js`
- `routes/movimentacoes.js`
- Qualquer controller que faça `Movimentacao.findAll()` ou queries SQL com `SELECT * FROM movimentacoes`

**Buscar por:**
```bash
grep -r "SELECT.*FROM movimentacoes" backend/
grep -r "Movimentacao.findAll" backend/
grep -r "movimentacoes.find" backend/
```

---

## ❓ Dúvidas?

Se após implementar a correção o campo ainda não aparecer:

1. Verifique o console do navegador (F12) - deve mostrar a estrutura da resposta da API
2. Execute query SQL diretamente no banco para confirmar que os dados existem
3. Adicione `console.log()` no backend antes de enviar a resposta:
   ```javascript
   console.log('Movimentações sendo enviadas:', movimentacoes);
   res.json(movimentacoes);
   ```

---

**Frontend já está pronto! ✅**  
**Só falta o backend retornar o campo `justificativa_ordem` na API.** 🚀
