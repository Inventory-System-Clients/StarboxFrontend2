# 🔧 BACKEND - Manutenções durante Execução de Roteiro

## 📋 Visão Geral

Este documento especifica as mudanças necessárias no backend para implementar a funcionalidade de **manutenções durante a execução de roteiros**. O sistema agora deve verificar manutenções pendentes quando um funcionário está executando um roteiro e permitir que ele resolva essas manutenções diretamente, com ou sem uso de peças do carrinho.

---

## 🎯 Requisitos Funcionais

### 1. Verificação de Manutenções Pendentes

Quando um funcionário executa um roteiro e seleciona uma loja, o sistema deve:
- Verificar se há manutenções pendentes para aquela loja
- Exibir um modal solicitando que o funcionário lide com a manutenção antes de finalizar a movimentação
- O funcionário pode escolher:
  - **Fazer a manutenção** (com ou sem peças)
  - **Não fazer a manutenção** (com explicação obrigatória)

### 2. Fazer Manutenção

Quando o funcionário escolhe **fazer a manutenção**:

#### 2.1. Com Uso de Peça
- O funcionário seleciona uma peça do seu carrinho
- A peça é descontada do carrinho do funcionário
- A manutenção é marcada como "feito"
- Registra qual funcionário concluiu e quando

#### 2.2. Sem Uso de Peça
- O funcionário seleciona "Não usar peças"
- **OBRIGATÓRIO**: Campo de explicação (máx. 100 caracteres) - `explicacao_sem_peca`
- A manutenção é marcada como "feito"
- Registra a explicação, qual funcionário concluiu e quando

### 3. Não Fazer Manutenção

Quando o funcionário escolhe **não fazer a manutenção**:
- **OBRIGATÓRIO**: Campo de explicação (máx. 100 caracteres) - `explicacao_nao_fazer`
- A manutenção NÃO é marcada como "feito", permanece "pendente"
- Registra a explicação, qual funcionário verificou e quando
- O funcionário pode prosseguir com o roteiro

---

## 🗄️ Alterações no Banco de Dados

### Tabela: `manutencoes`

Adicionar as seguintes colunas:

```sql
ALTER TABLE manutencoes 
ADD COLUMN explicacao_nao_fazer VARCHAR(100),
ADD COLUMN explicacao_sem_peca VARCHAR(100),
ADD COLUMN verificadoPorId INTEGER,
ADD COLUMN verificadoEm TIMESTAMP,
ADD COLUMN pecaUsadaId INTEGER,
ADD CONSTRAINT fk_manutencoes_verificado_por 
  FOREIGN KEY (verificadoPorId) REFERENCES usuarios(id),
ADD CONSTRAINT fk_manutencoes_peca_usada 
  FOREIGN KEY (pecaUsadaId) REFERENCES pecas(id);
```

#### Descrição das Colunas

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `explicacao_nao_fazer` | VARCHAR(100) | Explicação do funcionário de porque não fez a manutenção |
| `explicacao_sem_peca` | VARCHAR(100) | Explicação do funcionário de porque não usou peças ao fazer a manutenção |
| `verificadoPorId` | INTEGER | ID do funcionário que verificou/optou por não fazer |
| `verificadoEm` | TIMESTAMP | Data/hora que o funcionário optou por não fazer |
| `pecaUsadaId` | INTEGER | ID da peça usada para concluir a manutenção (se houver) |

**Nota**: As colunas existentes `concluidoPorId` e `concluidoEm` devem ser usadas quando a manutenção for marcada como "feito".

---

## 🔌 Endpoints da API

### 1. GET `/manutencoes`

**Modificar endpoint existente** para aceitar query params de filtro.

#### Query Parameters
```
lojaId (opcional) - Filtra manutenções por loja
status (opcional) - Filtra por status (ex: "pendente")
```

#### Exemplo de Request
```http
GET /manutencoes?lojaId=5&status=pendente
Authorization: Bearer <token>
```

#### Response Success (200)
```json
[
  {
    "id": 12,
    "descricao": "Trocar sensor de moeda",
    "status": "pendente",
    "lojaId": 5,
    "maquinaId": 23,
    "funcionarioId": 8,
    "createdAt": "2026-03-06T10:00:00.000Z",
    "loja": {
      "id": 5,
      "nome": "Loja Centro"
    },
    "maquina": {
      "id": 23,
      "nome": "Máquina A1"
    },
    "funcionario": {
      "id": 8,
      "nome": "João Silva"
    }
  }
]
```

---

### 2. PUT `/manutencoes/:id/concluir`

**Novo endpoint** para concluir uma manutenção (marcar como "feito").

#### Request Body
```json
{
  "status": "feito",
  "concluidoPorId": 8,
  "pecaId": 15,  // Opcional - se usar peça do carrinho
  "explicacao_sem_peca": "Ajuste simples, não precisou trocar peça"  // Obrigatório se pecaId = null
}
```

#### Validações
- Se `pecaId` for `null`, `explicacao_sem_peca` é **obrigatório**
- `explicacao_sem_peca` deve ter no máximo 100 caracteres
- Se `pecaId` for fornecido:
  - Verificar se a peça existe no carrinho do funcionário
  - **Remover a peça do carrinho** após concluir
  - Registrar `pecaUsadaId` na manutenção

#### Regras de Negócio
1. Atualizar `status` para "feito"
2. Registrar `concluidoPorId` e `concluidoEm` (timestamp atual)
3. Se usou peça:
   - Registrar `pecaUsadaId`
   - Remover peça do carrinho do funcionário
4. Se não usou peça:
   - Registrar `explicacao_sem_peca`
   - `pecaUsadaId` = NULL

#### Response Success (200)
```json
{
  "message": "Manutenção concluída com sucesso",
  "manutencao": {
    "id": 12,
    "status": "feito",
    "concluidoPorId": 8,
    "concluidoEm": "2026-03-06T14:30:00.000Z",
    "pecaUsadaId": 15,
    "explicacao_sem_peca": null
  }
}
```

#### Response Error (400)
```json
{
  "error": "Explicação obrigatória quando não usar peças"
}
```

---

### 3. PUT `/manutencoes/:id/nao-fazer`

**Novo endpoint** para registrar que a manutenção não foi feita (permanece pendente).

#### Request Body
```json
{
  "explicacao_nao_fazer": "Não tinha a ferramenta necessária no momento",  // Obrigatório
  "verificadoPorId": 8
}
```

#### Validações
- `explicacao_nao_fazer` é **obrigatório**
- `explicacao_nao_fazer` deve ter no máximo 100 caracteres

#### Regras de Negócio
1. Status permanece "pendente" (não muda)
2. Registrar `verificadoPorId` e `verificadoEm` (timestamp atual)
3. Registrar `explicacao_nao_fazer`
4. Funcionário pode prosseguir com o roteiro sem bloquear a movimentação

#### Response Success (200)
```json
{
  "message": "Explicação registrada com sucesso",
  "manutencao": {
    "id": 12,
    "status": "pendente",
    "verificadoPorId": 8,
    "verificadoEm": "2026-03-06T14:30:00.000Z",
    "explicacao_nao_fazer": "Não tinha a ferramenta necessária no momento"
  }
}
```

#### Response Error (400)
```json
{
  "error": "Explicação obrigatória para não fazer manutenção"
}
```

---

## 📤 Retorno de Dados

### GET `/manutencoes/:id`

**Modificar endpoint existente** para incluir os novos campos e relações.

#### Response Success (200)
```json
{
  "id": 12,
  "descricao": "Trocar sensor de moeda",
  "status": "feito",
  "lojaId": 5,
  "maquinaId": 23,
  "funcionarioId": 8,
  "createdAt": "2026-03-06T10:00:00.000Z",
  "concluidoPorId": 8,
  "concluidoEm": "2026-03-06T14:30:00.000Z",
  "verificadoPorId": null,
  "verificadoEm": null,
  "pecaUsadaId": null,
  "explicacao_nao_fazer": null,
  "explicacao_sem_peca": "Ajuste simples, não precisou trocar peça",
  "loja": {
    "id": 5,
    "nome": "Loja Centro"
  },
  "maquina": {
    "id": 23,
    "nome": "Máquina A1"
  },
  "funcionario": {
    "id": 8,
    "nome": "João Silva"
  },
  "concluidoPor": {
    "id": 8,
    "nome": "João Silva"
  },
  "verificadoPor": null,
  "pecaUsada": null
}
```

---

## 🔄 Fluxo de Integração

### Cenário 1: Fazer Manutenção com Peça

1. Funcionário executa roteiro e seleciona loja
2. Frontend chama `GET /manutencoes?lojaId=5&status=pendente`
3. Se houver manutenção pendente, exibe modal
4. Funcionário escolhe "Fazer Manutenção"
5. Funcionário seleciona uma peça do carrinho (ex: pecaId=15)
6. Frontend chama `PUT /manutencoes/12/concluir`:
```json
{
  "status": "feito",
  "concluidoPorId": 8,
  "pecaId": 15,
  "explicacao_sem_peca": null
}
```
7. Backend:
   - Atualiza manutenção (status="feito", concluidoPorId=8, concluidoEm=now, pecaUsadaId=15)
   - Remove peça do carrinho: `DELETE /usuarios/8/carrinho/15`
8. Frontend exibe sucesso e recarrega roteiro

### Cenário 2: Fazer Manutenção sem Peça

1. Funcionário escolhe "Fazer Manutenção"
2. Funcionário seleciona "Não usar peças"
3. Funcionário digita explicação: "Ajuste simples, não precisou trocar peça"
4. Frontend chama `PUT /manutencoes/12/concluir`:
```json
{
  "status": "feito",
  "concluidoPorId": 8,
  "pecaId": null,
  "explicacao_sem_peca": "Ajuste simples, não precisou trocar peça"
}
```
5. Backend:
   - Atualiza manutenção (status="feito", concluidoPorId=8, concluidoEm=now, explicacao_sem_peca="...")
6. Frontend exibe sucesso

### Cenário 3: Não Fazer Manutenção

1. Funcionário escolhe "Não Fazer Agora"
2. Funcionário digita explicação: "Não tinha a ferramenta necessária"
3. Frontend chama `PUT /manutencoes/12/nao-fazer`:
```json
{
  "explicacao_nao_fazer": "Não tinha a ferramenta necessária",
  "verificadoPorId": 8
}
```
4. Backend:
   - Atualiza manutenção (verificadoPorId=8, verificadoEm=now, explicacao_nao_fazer="...")
   - Status permanece "pendente"
5. Frontend permite que funcionário prossiga com o roteiro

---

## 🎨 Visualização na Página de Manutenções

Quando um admin ou funcionário clica em uma manutenção para ver detalhes, o modal deve exibir:

### Seção "Explicações dos Funcionários"

Exibida apenas se houver `explicacao_nao_fazer` OU `explicacao_sem_peca`.

#### Explicação de "Não Fez"
```
📝 Explicações dos Funcionários

Por que não foi feita:
"Não tinha a ferramenta necessária no momento"
- João Silva (06/03/2026 14:30)
```

#### Explicação de "Sem Peças"
```
Por que não usou peças:
"Ajuste simples, não precisou trocar peça"
- João Silva (06/03/2026 14:30)
```

---

## ✅ Checklist de Implementação

### Banco de Dados
- [ ] Adicionar coluna `explicacao_nao_fazer` VARCHAR(100)
- [ ] Adicionar coluna `explicacao_sem_peca` VARCHAR(100)
- [ ] Adicionar coluna `verificadoPorId` INTEGER (FK para usuarios)
- [ ] Adicionar coluna `verificadoEm` TIMESTAMP
- [ ] Adicionar coluna `pecaUsadaId` INTEGER (FK para pecas)
- [ ] Criar foreign keys e constraints

### API Endpoints
- [ ] Modificar `GET /manutencoes` para aceitar query params (lojaId, status)
- [ ] Criar `PUT /manutencoes/:id/concluir`
  - [ ] Validar campos obrigatórios
  - [ ] Lógica de uso de peças (remover do carrinho)
  - [ ] Registrar timestamps
- [ ] Criar `PUT /manutencoes/:id/nao-fazer`
  - [ ] Validar explicação obrigatória
  - [ ] Registrar verificação sem mudar status
- [ ] Modificar `GET /manutencoes/:id` para incluir novos campos e relações (include: concluidoPor, verificadoPor, pecaUsada)

### Validações
- [ ] Validar máximo 100 caracteres nas explicações
- [ ] Validar que explicacao_sem_peca é obrigatória quando pecaId é null
- [ ] Validar que explicacao_nao_fazer é sempre obrigatória
- [ ] Validar que peça existe no carrinho do funcionário antes de usar

### Testes
- [ ] Testar concluir manutenção com peça
- [ ] Testar concluir manutenção sem peça (com explicação)
- [ ] Testar não fazer manutenção (com explicação)
- [ ] Testar validações de campos obrigatórios
- [ ] Testar remoção automática de peça do carrinho
- [ ] Testar filtros de manutenções (lojaId, status)

---

## 📞 Contato

Se houver dúvidas sobre a implementação, consulte o código frontend em:
- `src/components/ManutencaoModal.jsx`
- `src/pages/RoteiroExecucao.jsx`
- `src/pages/Manutencoes.jsx`

---

**Última atualização**: 06/03/2026  
**Prioridade**: Alta  
**Status**: Aguardando implementação backend
