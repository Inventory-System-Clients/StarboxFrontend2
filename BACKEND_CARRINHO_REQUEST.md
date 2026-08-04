# Solicitação de Melhorias no Backend - Gestão de Carrinhos de Peças

## Contexto
Estamos implementando uma funcionalidade para que administradores possam gerenciar os carrinhos de peças dos funcionários. O objetivo é permitir que o admin adicione peças aos carrinhos dos funcionários e visualize o que cada um possui.

## Endpoints Existentes (Já Funcionando)

Os seguintes endpoints já estão implementados e funcionando:

### 1. Listar carrinho de um usuário
```
GET /usuarios/:id/carrinho
```
- **Autenticação**: Requerida
- **Permissões**: ADMIN, GERENCIADOR ou o próprio usuário
- **Resposta**: Array de itens do carrinho com informações da peça

### 2. Adicionar peça ao carrinho
```
POST /usuarios/:id/carrinho
```
- **Autenticação**: Requerida
- **Permissões**: ADMIN, GERENCIADOR ou o próprio usuário
- **Body**:
  ```json
  {
    "pecaId": "string",
    "quantidade": number
  }
  ```
- **Comportamento**: 
  - Se a peça já existe no carrinho, incrementa a quantidade
  - Caso contrário, cria novo item

### 3. Remover peça do carrinho
```
DELETE /usuarios/:id/carrinho/:pecaId
```
- **Autenticação**: Requerida
- **Permissões**: ADMIN, GERENCIADOR ou o próprio usuário
- **Comportamento**: Remove completamente o item do carrinho

## Endpoint Adicional Recomendado (Opcional)

Para melhorar a experiência do administrador, seria útil ter um endpoint que retorne um resumo de todos os funcionários e seus carrinhos:

### 4. Listar todos os carrinhos (visão consolidada)
```
GET /admin/carrinhos-funcionarios
```
- **Autenticação**: Requerida
- **Permissões**: ADMIN apenas
- **Resposta sugerida**:
  ```json
  [
    {
      "usuarioId": "uuid",
      "usuarioNome": "João Silva",
      "usuarioEmail": "joao@exemplo.com",
      "totalItens": 5,
      "carrinho": [
        {
          "id": "uuid",
          "pecaId": "uuid",
          "quantidade": 2,
          "Peca": {
            "id": "uuid",
            "nome": "Parafuso M10",
            "codigo": "PAR-M10",
            "quantidade": 50
          }
        }
      ]
    }
  ]
  ```
- **Descrição**: Este endpoint facilitaria a visualização geral dos carrinhos sem precisar fazer múltiplas requisições.

## Validações e Regras de Negócio Importantes

### Controle de Estoque
**IMPORTANTE**: Ao adicionar peças ao carrinho, o sistema deve:
1. Verificar se há quantidade disponível em estoque
2. Decrementar o estoque da peça quando ela for adicionada ao carrinho
3. Incrementar o estoque quando a peça for removida do carrinho

### Exemplo de fluxo:
```javascript
// Ao adicionar ao carrinho
1. Buscar peça no estoque
2. Verificar se quantidade disponível >= quantidade solicitada
3. Se sim:
   - Adicionar ao carrinho
   - Decrementar estoque: pecaEstoque.quantidade -= quantidadeSolicitada
   - Salvar alteração
4. Se não: retornar erro "Estoque insuficiente"

// Ao remover do carrinho
1. Buscar item no carrinho
2. Remover item do carrinho
3. Incrementar estoque: pecaEstoque.quantidade += item.quantidade
4. Salvar alteração
```

## Permissões e Segurança

### Níveis de Acesso:
- **ADMIN**: Pode gerenciar carrinhos de todos os usuários
- **GERENCIADOR**: Pode gerenciar apenas carrinhos de usuários com role FUNCIONARIO
- **FUNCIONARIO**: Pode gerenciar apenas seu próprio carrinho
- **MANUTENCAO**: Pode gerenciar apenas seu próprio carrinho

### Validações de Segurança:
```javascript
// Exemplo de validação no controller
if (req.usuario.role !== "ADMIN") {
  // Se não for admin, verificar se é o próprio usuário
  if (req.usuario.id !== usuarioId) {
    // Se for gerenciador, verificar se o alvo é funcionário
    if (req.usuario.role === "GERENCIADOR") {
      const usuarioAlvo = await Usuario.findByPk(usuarioId);
      if (!usuarioAlvo || usuarioAlvo.role !== "FUNCIONARIO") {
        return res.status(403).json({ error: "Permissão negada" });
      }
    } else {
      return res.status(403).json({ error: "Permissão negada" });
    }
  }
}
```

## Estrutura do Model CarrinhoPeca

O model já deve estar implementado, mas para referência:

```javascript
// CarrinhoPeca.js
{
  id: UUID (PK),
  usuarioId: UUID (FK -> Usuario),
  pecaId: UUID (FK -> Peca),
  quantidade: INTEGER,
  createdAt: TIMESTAMP,
  updatedAt: TIMESTAMP
}

// Relações:
CarrinhoPeca.belongsTo(Usuario, { foreignKey: "usuarioId" });
CarrinhoPeca.belongsTo(Peca, { foreignKey: "pecaId" });
```

## Testes Recomendados

### Cenários de Teste:
1. **Admin adiciona peça ao carrinho de funcionário** ✅
2. **Admin remove peça do carrinho de funcionário** ✅
3. **Funcionário adiciona peça ao próprio carrinho** ✅
4. **Funcionário tenta adicionar peça ao carrinho de outro** ❌ (Deve ser negado)
5. **Tentativa de adicionar peça sem estoque** ❌ (Deve retornar erro)
6. **Estoque é atualizado corretamente ao adicionar/remover** ✅
7. **Gerenciador adiciona peça ao carrinho de funcionário** ✅
8. **Gerenciador tenta adicionar peça ao carrinho de admin** ❌ (Deve ser negado)

## Possíveis Melhorias Futuras

1. **Histórico de Movimentações**: Registrar quando peças são adicionadas/removidas e por quem
2. **Limite de Itens**: Implementar limite máximo de itens por funcionário
3. **Notificações**: Notificar funcionário quando admin adiciona/remove peças do carrinho
4. **Reserva de Estoque**: Implementar um sistema de reserva temporária ao adicionar ao carrinho
5. **Devolução em Lote**: Endpoint para devolver todas as peças de um carrinho de uma vez

## Integração Frontend

O frontend está consumindo os seguintes endpoints:

### Na página de Gerenciar Carrinhos:
```javascript
// Buscar funcionários
GET /usuarios?role=FUNCIONARIO&ativo=true

// Buscar peças disponíveis
GET /pecas

// Buscar carrinho de funcionário específico
GET /usuarios/:funcionarioId/carrinho

// Adicionar peça ao carrinho
POST /usuarios/:funcionarioId/carrinho
Body: { pecaId: "uuid", quantidade: 1 }

// Remover peça do carrinho
DELETE /usuarios/:funcionarioId/carrinho/:pecaId
```

## Questões para o Backend

1. **Transações**: As operações de adicionar/remover do carrinho estão usando transações do banco para garantir atomicidade da atualização de estoque?
   
2. **Validação de Quantidade**: Há validação para evitar quantidade negativa no estoque?

3. **Concorrência**: Como o sistema lida com múltiplas requisições simultâneas tentando adicionar a mesma peça?

4. **Soft Delete**: Estamos usando soft delete para itens do carrinho ou delete físico?

5. **Logs de Auditoria**: Há um sistema de logs para rastrear quem manipulou os carrinhos?

## Prioridade

- **ALTA**: Endpoints 1, 2, 3 (já implementados) ✅
- **MÉDIA**: Endpoint 4 (visão consolidada)
- **BAIXA**: Melhorias futuras (histórico, notificações, etc.)

---

## Resumo Rápido

**O que o backend precisa garantir:**
1. ✅ Endpoints básicos de CRUD do carrinho (já existem)
2. ✅ Controle de permissões por role (já existe)
3. ⚠️ Atualização correta do estoque ao adicionar/remover peças
4. ⚠️ Validação de quantidade disponível antes de adicionar
5. 🆕 [OPCIONAL] Endpoint consolidado de visão geral dos carrinhos

**O que o frontend já está fazendo:**
- Interface para admin gerenciar carrinhos
- Busca e filtro de funcionários
- Busca e filtro de peças
- Adicionar/remover peças dos carrinhos
- Visualização do carrinho de cada funcionário
- Tabela resumo com todos os funcionários

Se os endpoints existentes já fazem o controle de estoque corretamente, o sistema está pronto para uso! 🎉
