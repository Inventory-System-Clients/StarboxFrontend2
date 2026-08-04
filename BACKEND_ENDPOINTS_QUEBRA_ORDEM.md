# 🔧 Backend: Endpoints Necessários para Página de Quebra de Ordem

## 📋 Contexto

Foi criada uma nova página **"Quebras de Ordem do Roteiro"** (`/quebra-ordem`) que mostra o histórico de lojas visitadas fora da ordem estabelecida. A página já está implementada no frontend, mas precisa de **3 endpoints específicos** retornando dados no formato correto.

---

## ❌ Problema Atual

A página está fazendo as seguintes chamadas, mas não está funcionando:

```javascript
// QuebraOrdemPage.jsx - carregarQuebrasOrdem()
const [movRes, lojasRes, roteirosRes] = await Promise.all([
  api.get("/movimentacoes"),       // ❌ Não retorna justificativa_ordem
  api.get("/lojas"),                // ❓ Pode não existir ou retornar dados incompletos
  api.get("/roteiros"),             // ❓ Não retorna as lojas dentro de cada roteiro
]);
```

**Sintomas:**
- Não aparece nenhuma quebra de ordem na lista (mesmo tendo feito algumas)
- Não está buscando as lojas corretamente
- Não está buscando os roteiros corretamente

---

## ✅ Endpoints Necessários

### ⚠️ **PROBLEMA CRÍTICO IDENTIFICADO**

A coluna `justificativa_ordem` no banco de dados está com `[NULL]` em todas as movimentações, mesmo após o funcionário ter digitado a justificativa. Isso significa que **o endpoint POST para salvar a justificativa não está funcionando corretamente**.

---

### 0️⃣ `POST /roteiros/:roteiroId/justificar-ordem` ⚠️ **ENDPOINT MAIS CRÍTICO**

**Este endpoint é chamado quando o funcionário pula uma loja e digita a justificativa no modal.**

**Payload enviado pelo frontend:**
```json
{
  "lojaId": "uuid-da-loja-pulada",
  "lojaIdEsperada": "uuid-da-loja-que-deveria-ser-visitada",
  "justificativa": "Cliente pediu para atender primeiro"
}
```

**O que o backend DEVE fazer:**

1. **Receber o `roteiroId` na URL** (`:roteiroId`) e os dados no body (`lojaId`, `lojaIdEsperada`, `justificativa`)
2. **SALVAR ambos os IDs** (loja visitada E loja esperada/pulada) para ser usado na PRÓXIMA movimentação
3. **Opção 1 - Salvar em sessão/contexto temporário:**
   ```javascript
   // Armazenar temporariamente (em memória, Redis, ou tabela auxiliar)
   justificativasPendentes[lojaId] = { 
     justificativa, 
     lojaIdEsperada 
   };
   ```

4. **Opção 2 - Criar registro de log (RECOMENDADO):**
   ```sql
   INSERT INTO log_ordem_roteiro (
     roteiroId, 
     lojaId, 
     lojaIdEsperada,  -- Qual loja deveria ser visitada (foi pulada)
     justificativa, 
     usuarioId,
     createdAt
   ) VALUES (...);
   ```

5. **Na próxima chamada de `POST /movimentacoes`:**
   ```javascript
   // Ao criar nova movimentação, verificar se há justificativa pendente
   const justificativaData = justificativasPendentes[req.body.lojaId];
   
   const movimentacao = await Movimentacao.create({
     maquinaId: req.body.maquinaId,
     lojaId: req.body.lojaId,
     totalPre: req.body.totalPre,
     sairam: req.body.sairam,
     abastecidas: req.body.abastecidas,
     fichas: req.body.fichas,
     observacoes: req.body.observacoes,
     justificativa_ordem: justificativaData?.justificativa || null,  // ✅ SALVAR AQUI
     lojaIdEsperada: justificativaData?.lojaIdEsperada || null,      // ✅ SALVAR AQUI
     // ... outros campos
   });
   
   // Limpar justificativa após usar
   delete justificativasPendentes[req.body.lojaId];
   ```

**Estrutura esperada de resposta:**
```json
{
  "success": true,
  "message": "Justificativa registrada com sucesso"
}
```

**Exemplo de implementação completa:**

```javascript
// routes/roteiros.js

// Armazenamento temporário (idealmente usar Redis em produção)
const justificativasPendentes = new Map();

// POST /roteiros/:roteiroId/justificar-ordem
router.post('/:roteiroId/justificar-ordem', async (req, res) => {
  try {
    const { roteiroId } = req.params;
    const { lojaId, lojaIdEsperada, justificativa } = req.body;
    
    // Validações
    if (!lojaId || !justificativa) {
      return res.status(400).json({ 
        error: 'lojaId e justificativa são obrigatórios' 
      });
    }
    
    // Salvar justificativa para ser usada na próxima movimentação
    justificativasPendentes.set(lojaId, {
      justificativa,
      lojaIdEsperada,
      roteiroId,
      timestamp: new Date()
    });
    
    // OPCIONAL: Salvar também em tabela de log
    await LogOrdemRoteiro.create({
      roteiroId,
      lojaId,
      lojaIdEsperada,
      justificativa,
      usuarioId: req.user?.id,  // Se tiver autenticação
    });
    
    res.json({ 
      success: true, 
      message: 'Justificativa registrada com sucesso' 
    });
  } catch (error) {
    console.error('Erro ao salvar justificativa:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /movimentacoes (ou endpoint que cria movimentação)
router.post('/movimentacoes', async (req, res) => {
  try {
    const { lojaId, maquinaId, totalPre, sairam, abastecidas, fichas, observacoes } = req.body;
    
    // Buscar justificativa pendente desta loja
    const justificativaData = justificativasPendentes.get(lojaId);
    const justificativa = justificativaData?.justificativa || null;
    const lojaIdEsperada = justificativaData?.lojaIdEsperada || null;
    
    // Criar movimentação COM a justificativa e lojaIdEsperada
    const movimentacao = await Movimentacao.create({
      maquinaId,
      lojaId,
      totalPre,
      sairam,
      abastecidas,
      fichas,
      observacoes,
      justificativa_ordem: justificativa,  // ✅ SALVAR AQUI
      lojaIdEsperada: lojaIdEsperada,      // ✅ SALVAR AQUI
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    // Limpar justificativa após usar
    if (justificativa) {
      justificativasPendentes.delete(lojaId);
    }
    
    res.status(201).json(movimentacao);
  } catch (error) {
    console.error('Erro ao criar movimentação:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**⚠️ Fluxo esperado:**

1. Funcionário tenta selecionar Loja B quando deveria ser Loja A
2. Modal aparece pedindo justificativa
3. Funcionário digita: "Cliente pediu atendimento urgente"
4. Frontend chama: `POST /roteiros/:roteiroId/justificar-ordem` com `{ lojaId: "loja-B", lojaIdEsperada: "loja-A", justificativa: "..." }`
5. Backend salva justificativa E lojaIdEsperada em memória/cache/log
6. Funcionário vai para tela de movimentação da Loja B
7. Funcionário registra movimentação da máquina
8. Frontend chama: `POST /movimentacoes` com dados da movimentação
9. **Backend busca justificativa e lojaIdEsperada pendentes e salva junto com a movimentação**
10. Campos `justificativa_ordem` e `lojaIdEsperada` ficam preenchidos no banco ✅

---

### 1️⃣ `GET /movimentacoes`

**Deve retornar:** Array de todas as movimentações, **incluindo o campo `justificativa_ordem`**

**Estrutura de resposta esperada:**
```json
[
  {
    "id": "uuid-123",
    "maquinaId": "uuid-456",
    "lojaId": "uuid-789",               // ✅ OBRIGATÓRIO
    "lojaIdEsperada": "uuid-abc",       // ✅ Qual loja deveria ter sido visitada (se houver quebra)
    "roteiroId": "uuid-roteiro",        // ⚠️ OPCIONAL mas ajuda
    "totalPre": 50,
    "sairam": 10,
    "abastecidas": 15,
    "fichas": 20,
    "observacoes": "Tudo ok",
    "justificativa_ordem": "Cliente pediu para atender primeiro",  // ✅ CAMPO CRÍTICO
    "createdAt": "2026-03-09T10:30:00.000Z",
    "updatedAt": "2026-03-09T10:30:00.000Z"
  },
  {
    "id": "uuid-124",
    "maquinaId": "uuid-457",
    "lojaId": "uuid-790",
    "lojaIdEsperada": null,              // ✅ NULL quando não houve quebra de ordem
    "totalPre": 30,
    "sairam": 5,
    "abastecidas": 10,
    "fichas": 15,
    "observacoes": null,
    "justificativa_ordem": null,        // ✅ Movimentações normais têm NULL aqui
    "createdAt": "2026-03-09T11:00:00.000Z",
    "updatedAt": "2026-03-09T11:00:00.000Z"
  }
]
```

**⚠️ CRÍTICO:** Os campos **`justificativa_ordem`** e **`lojaIdEsperada`** DEVEM estar presentes em TODAS as movimentações (mesmo que sejam `null`). São usados para filtrar e exibir informações sobre quebras de ordem.

**Se o endpoint atual não se chama `/movimentacoes`**, informe qual é o endpoint correto:
- Pode ser `/movimentacao`?
- Pode ser `/movimentacoes-maquinas`?
- Precisa de query params? Ex: `/movimentacoes?incluirTodos=true`

---

### 2️⃣ `GET /lojas`

**Deve retornar:** Array de todas as lojas cadastradas

**Estrutura de resposta esperada:**
```json
[
  {
    "id": "uuid-loja-1",
    "nome": "Supermercado ABC",       // ✅ OBRIGATÓRIO - Usado para exibir nome
    "endereco": "Rua X, 123",
    "cidade": "São Paulo",
    "estado": "SP",
    "ativo": true,
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "uuid-loja-2",
    "nome": "Shopping XYZ",
    "endereco": "Av Y, 456",
    "cidade": "Rio de Janeiro",
    "estado": "RJ",
    "ativo": true,
    "createdAt": "2026-01-02T00:00:00.000Z"
  }
]
```

**Se o endpoint atual não se chama `/lojas`**, informe qual é o endpoint correto:
- Pode ser `/loja`?
- Pode ser `/lojas/ativas`?
- Precisa de filtros?

---

### 3️⃣ `GET /roteiros`

**Deve retornar:** Array de todos os roteiros, **incluindo as lojas** dentro de cada roteiro

**Estrutura de resposta esperada:**
```json
[
  {
    "id": "uuid-roteiro-1",
    "nome": "Roteiro Centro",          // ✅ OBRIGATÓRIO - Usado para exibir nome
    "descricao": "Lojas do centro da cidade",
    "ativo": true,
    "lojas": [                          // ✅ CAMPO CRÍTICO - Array de lojas do roteiro
      {
        "id": "uuid-loja-1",
        "nome": "Supermercado ABC",
        "ordem": 1                      // ⚠️ Ordem da loja no roteiro (se tiver)
      },
      {
        "id": "uuid-loja-2",
        "nome": "Shopping XYZ",
        "ordem": 2
      }
    ],
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "uuid-roteiro-2",
    "nome": "Roteiro Zona Sul",
    "descricao": "Lojas da zona sul",
    "ativo": true,
    "lojas": [
      {
        "id": "uuid-loja-3",
        "nome": "Padaria 123",
        "ordem": 1
      }
    ],
    "createdAt": "2026-01-02T00:00:00.000Z"
  }
]
```

**⚠️ CRÍTICO:** O campo **`lojas`** DEVE ser um array com as lojas que fazem parte daquele roteiro. O frontend usa isso para descobrir qual roteiro cada loja pertence.

**Se o endpoint não retorna as lojas:**
```javascript
// Código atual no frontend que vai FALHAR se lojas não vier:
const roteiro = roteirosRes.data.find((rot) => 
  rot.lojas?.some((l) => l.id === mov.lojaId)  // ❌ Vai sempre dar undefined
);
```

**Possíveis formatos alternativos aceitos:**

Formato com relacionamento Sequelize:
```json
{
  "id": "uuid-roteiro-1",
  "nome": "Roteiro Centro",
  "RoteirosLojas": [           // ← Nome pode variar (RoteirosLojas, RoteiroLoja, etc)
    {
      "lojaId": "uuid-loja-1",
      "ordem": 1,
      "Loja": {                // ← Pode incluir objeto loja completo
        "id": "uuid-loja-1",
        "nome": "Supermercado ABC"
      }
    }
  ]
}
```

**Se o endpoint atual não se chama `/roteiros`**, informe qual é o endpoint correto:
- Pode ser `/roteiro`?
- Pode ser `/roteiros/ativos`?
- Pode ser `/roteiros/com-lojas`?
- Precisa de query params? Ex: `/roteiros?incluirLojas=true`

---

## 🔍 Como Testar os Endpoints

### Teste 1: Verificar estrutura do endpoint `/movimentacoes`

No Postman/Insomnia:
```
GET http://localhost:3000/movimentacoes
```

**Verificar:**
1. ✅ Retorna array de movimentações?
2. ✅ Cada movimentação tem campo `lojaId`?
3. ✅ Cada movimentação tem campo `justificativa_ordem` (mesmo que null)?
4. ✅ Movimentações com quebra de ordem têm texto na `justificativa_ordem`?

### Teste 2: Verificar estrutura do endpoint `/lojas`

```
GET http://localhost:3000/lojas
```

**Verificar:**
1. ✅ Retorna array de lojas?
2. ✅ Cada loja tem `id` e `nome`?

### Teste 3: Verificar estrutura do endpoint `/roteiros`

```
GET http://localhost:3000/roteiros
```

**Verificar:**
1. ✅ Retorna array de roteiros?
2. ✅ Cada roteiro tem `id` e `nome`?
3. ✅ Cada roteiro tem campo `lojas` (array)?
4. ✅ Cada item dentro de `lojas` tem pelo menos `id`?

---

## 🛠️ Possíveis Implementações no Backend

### Exemplo 1: Endpoint `/roteiros` com Sequelize

```javascript
// routes/roteiros.js
router.get('/roteiros', async (req, res) => {
  try {
    const roteiros = await Roteiro.findAll({
      where: { ativo: true },
      include: [
        {
          model: Loja,
          through: {
            attributes: ['ordem']  // Incluir campo ordem da tabela pivot
          },
          attributes: ['id', 'nome']
        }
      ],
      order: [
        [Loja, RoteirosLojas, 'ordem', 'ASC']  // Ordenar lojas por ordem
      ]
    });
    
    // Transformar para formato esperado pelo frontend
    const roteirosFormatados = roteiros.map(rot => ({
      id: rot.id,
      nome: rot.nome,
      descricao: rot.descricao,
      ativo: rot.ativo,
      lojas: rot.Lojas.map(loja => ({
        id: loja.id,
        nome: loja.nome,
        ordem: loja.RoteirosLojas.ordem
      })),
      createdAt: rot.createdAt
    }));
    
    res.json(roteirosFormatados);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Exemplo 2: Endpoint `/movimentacoes` incluindo justificativa_ordem

```javascript
// routes/movimentacoes.js
router.get('/movimentacoes', async (req, res) => {
  try {
    const movimentacoes = await Movimentacao.findAll({
      attributes: [
        'id',
        'maquinaId',
        'lojaId',
        'roteiroId',        // Se tiver
        'totalPre',
        'sairam',
        'abastecidas',
        'fichas',
        'observacoes',
        'justificativa_ordem',  // ✅ ADICIONAR ESTE CAMPO
        'createdAt',
        'updatedAt'
      ],
      order: [['createdAt', 'DESC']]
    });
    
    res.json(movimentacoes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 📝 Checklist de Verificação

- [ ] Endpoint `GET /movimentacoes` existe e está acessível
- [ ] Movimentações retornam campo `lojaId` (obrigatório)
- [ ] Movimentações retornam campo `justificativa_ordem` (pode ser null)
- [ ] Endpoint `GET /lojas` existe e retorna array de lojas com `id` e `nome`
- [ ] Endpoint `GET /roteiros` existe e retorna array de roteiros
- [ ] Cada roteiro no array tem campo `lojas` (array de lojas)
- [ ] Campo `lojas` dentro do roteiro contém pelo menos `id` de cada loja
- [ ] Verificar no banco: `SELECT id, lojaId, justificativa_ordem FROM movimentacoes WHERE justificativa_ordem IS NOT NULL;`
- [ ] Testar endpoints manualmente no Postman/Insomnia

---

## 🔧 Se os Endpoints Tiverem Nomes Diferentes

**Por favor, informe:**

1. **Endpoint de movimentações:**
   - Qual é o endpoint correto? (ex: `/movimentacao`, `/movimentacoes-maquinas`)
   - Precisa de query params?
   - Retorna o campo `justificativa_ordem`?

2. **Endpoint de lojas:**
   - Qual é o endpoint correto? (ex: `/loja`, `/lojas/todas`)
   - Retorna `id` e `nome`?

3. **Endpoint de roteiros:**
   - Qual é o endpoint correto? (ex: `/roteiro`, `/roteiros/com-lojas`)
   - Retorna as lojas dentro de cada roteiro?
   - Qual o nome do campo que contém as lojas? (`lojas`, `Lojas`, `RoteirosLojas`)

---

## 🎯 Resumo

A página **Quebras de Ordem** precisa de:

1. ✅ `/movimentacoes` retornando **`justificativa_ordem`**
2. ✅ `/lojas` retornando array com `id` e `nome`
3. ✅ `/roteiros` retornando array com `lojas` (array) dentro de cada roteiro

**Sem esses 3 endpoints no formato correto, a página não consegue:**
- Filtrar quais movimentações são quebras de ordem
- Mostrar o nome da loja visitada
- Mostrar qual roteiro estava sendo executado

---

## 🐛 DEBUG: Como Descobrir por que a Justificativa Não Está Sendo Salva

### Passo 1: Verificar se o endpoint POST existe

**Teste no Postman/Insomnia:**
```
POST http://localhost:3000/roteiros/qualquer-uuid/justificar-ordem
Content-Type: application/json

{
  "lojaId": "uuid-qualquer",
  "justificativa": "Teste de justificativa"
}
```

**Resultados possíveis:**
- ✅ **200/201 com sucesso** → Endpoint existe, vá para Passo 2
- ❌ **404 Not Found** → Endpoint não existe, precisa ser criado
- ❌ **500 Internal Server Error** → Endpoint existe mas tem erro

### Passo 2: Verificar se o modelo tem o campo

Execute no console do backend ou no terminal:
```javascript
// Verificar estrutura do modelo Movimentacao
console.log(Movimentacao.rawAttributes);

// Procurar por 'justificativa_ordem'
// Se não aparecer, o campo não foi adicionado ao modelo
```

Ou direto no banco:
```sql
-- Ver estrutura da tabela
\d movimentacoes;

-- Ou
DESCRIBE movimentacoes;

-- Verificar se coluna existe
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'movimentacoes' 
  AND column_name = 'justificativa_ordem';
```

### Passo 3: Adicionar logs no backend

No endpoint `POST /roteiros/:roteiroId/justificar-ordem`:
```javascript
router.post('/:roteiroId/justificar-ordem', async (req, res) => {
  console.log('🔍 Justificar ordem chamado!');
  console.log('  roteiroId:', req.params.roteiroId);
  console.log('  body:', req.body);
  console.log('  lojaId:', req.body.lojaId);
  console.log('  justificativa:', req.body.justificativa);
  
  // ... resto do código
  
  console.log('✅ Justificativa salva com sucesso!');
  res.json({ success: true });
});
```

No endpoint `POST /movimentacoes`:
```javascript
router.post('/movimentacoes', async (req, res) => {
  console.log('🔍 Criar movimentação chamado!');
  console.log('  lojaId:', req.body.lojaId);
  
  const justificativa = justificativasPendentes.get(req.body.lojaId)?.justificativa;
  console.log('  justificativa encontrada:', justificativa);
  
  const movimentacao = await Movimentacao.create({
    // ... campos
    justificativa_ordem: justificativa,
  });
  
  console.log('✅ Movimentação criada:', movimentacao.id);
  console.log('   justificativa_ordem salva:', movimentacao.justificativa_ordem);
  
  res.json(movimentacao);
});
```

### Passo 4: Verificar se frontend está chamando

No navegador (F12 → Console), adicione breakpoint ou veja logs da chamada:
```javascript
// Em RoteiroExecucao.jsx
const confirmarSelecaoComJustificativa = async () => {
  console.log('🔍 Enviando justificativa:', {
    roteiroId: roteiro.id,
    lojaId: modalJustificativa.lojaId,
    justificativa: modalJustificativa.justificativa
  });
  
  const response = await api.post(`/roteiros/${roteiro.id}/justificar-ordem`, {
    lojaId: modalJustificativa.lojaId,
    justificativa: modalJustificativa.justificativa,
  });
  
  console.log('✅ Resposta do backend:', response.data);
  // ...
};
```

### Passo 5: Testar fluxo completo

1. Abra DevTools (F12) no navegador
2. Execute um roteiro e pule uma loja
3. Digite justificativa no modal
4. **Veja no console do navegador** se aparece:
   ```
   🔍 Enviando justificativa: { roteiroId: "...", lojaId: "...", justificativa: "..." }
   ✅ Resposta do backend: { success: true }
   ```
5. **Veja no console do backend/servidor** se aparece:
   ```
   🔍 Justificar ordem chamado!
   ✅ Justificativa salva com sucesso!
   ```
6. Faça uma movimentação da máquina
7. **Veja no console do backend** se aparece:
   ```
   🔍 Criar movimentação chamado!
     justificativa encontrada: "Cliente pediu..."
   ✅ Movimentação criada: uuid-123
      justificativa_ordem salva: "Cliente pediu..."
   ```
8. **Verifique no banco de dados:**
   ```sql
   SELECT id, lojaId, justificativa_ordem, createdAt 
   FROM movimentacoes 
   ORDER BY createdAt DESC 
   LIMIT 5;
   ```

---

## 🚨 Possíveis Causas do Problema

### Causa 1: Endpoint POST não existe
**Sintoma:** Erro 404 ao chamar `/roteiros/:id/justificar-ordem`  
**Solução:** Criar o endpoint conforme exemplo acima

### Causa 2: Campo não está no modelo
**Sintoma:** `justificativa_ordem` sempre `null` mesmo após salvar  
**Solução:** Adicionar campo no modelo:
```javascript
justificativa_ordem: DataTypes.TEXT
```

### Causa 3: Endpoint existe mas não salva
**Sintoma:** Retorna 200 OK mas não salva no banco  
**Solução:** Verificar se está realmente inserindo na tabela ou apenas retornando resposta fake

### Causa 4: Justificativa não é associada à movimentação
**Sintoma:** Endpoint salva, mas quando cria movimentação não usa a justificativa  
**Solução:** Implementar sistema de cache/memória ou tabela auxiliar para vincular justificativa à próxima movimentação daquela loja

### Causa 5: Coluna não existe no banco
**Sintoma:** Erro SQL ao tentar inserir  
**Solução:** Executar migration:
```sql
ALTER TABLE movimentacoes 
ADD COLUMN justificativa_ordem TEXT NULL;
```

---

**Frontend já está pronto! ✅**  
**Só precisa confirmar os endpoints e ajustar formato dos dados retornados.** 🚀
