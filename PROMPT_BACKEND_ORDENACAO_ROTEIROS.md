# PROMPT PARA ALTERAÇÕES NO BACKEND - ORDENAÇÃO DE LOJAS EM ROTEIROS

## 📋 OBJETIVO
Implementar funcionalidade de ordenação de lojas dentro dos roteiros, permitindo que o administrador defina a sequência de visitação, e exigindo justificativa do funcionário quando pular uma loja fora da ordem.

## 🗄️ ALTERAÇÕES NO BANCO DE DADOS (DBeaver)

### 1. Tabela `roteiros_lojas` (ou tabela de relacionamento)
Adicionar coluna para armazenar a ordem/posição da loja no roteiro:

```sql
-- Adicionar coluna de ordem na tabela de relacionamento roteiros_lojas
ALTER TABLE roteiros_lojas 
ADD COLUMN ordem INTEGER DEFAULT 0;

-- Atualizar registros existentes com ordem sequencial
UPDATE roteiros_lojas 
SET ordem = subquery.row_num - 1
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY roteiro_id ORDER BY created_at) as row_num
  FROM roteiros_lojas
) AS subquery
WHERE roteiros_lojas.id = subquery.id;
```

### 2. Tabela `movimentacoes`
Adicionar coluna para armazenar a justificativa quando o funcionário pula uma loja:

```sql
-- Adicionar coluna de justificativa na tabela movimentacoes
ALTER TABLE movimentacoes 
ADD COLUMN justificativa_ordem TEXT NULL;

-- Adicionar índice para melhorar consultas
CREATE INDEX idx_movimentacoes_justificativa ON movimentacoes(justificativa_ordem) 
WHERE justificativa_ordem IS NOT NULL;
```

### 3. Tabela `log_ordem_roteiro` (NOVA - opcional mas recomendada)
Criar tabela para log de justificativas de quebra de ordem:

```sql
-- Criar tabela de log para rastreamento de justificativas
CREATE TABLE log_ordem_roteiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  roteiro_id UUID NOT NULL REFERENCES roteiros(id),
  loja_id UUID NOT NULL REFERENCES lojas(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  loja_esperada_id UUID REFERENCES lojas(id),
  loja_selecionada_id UUID NOT NULL REFERENCES lojas(id),
  justificativa TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_roteiro FOREIGN KEY (roteiro_id) REFERENCES roteiros(id) ON DELETE CASCADE,
  CONSTRAINT fk_loja FOREIGN KEY (loja_id) REFERENCES lojas(id) ON DELETE CASCADE,
  CONSTRAINT fk_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);

-- Índices para melhorar performance
CREATE INDEX idx_log_ordem_roteiro_roteiro ON log_ordem_roteiro(roteiro_id);
CREATE INDEX idx_log_ordem_roteiro_created ON log_ordem_roteiro(created_at);
```

## 🔧 ALTERAÇÕES NO BACKEND (Node.js/Express)

### 1. Model `RoteiroLoja` ou relacionamento
Adicionar campo `ordem` no model/schema:

```javascript
// Se estiver usando Sequelize
RoteiroLoja.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  roteiroId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  lojaId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  ordem: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  }
}, {
  // ... configurações
});
```

### 2. Rota para REORDENAR lojas dentro do roteiro
Adicionar endpoint no arquivo de rotas de roteiros:

```javascript
// routes/roteiros.js ou similar

/**
 * PATCH /roteiros/:id/reordenar-loja
 * Reordena uma loja dentro do roteiro
 */
router.patch('/:id/reordenar-loja', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { lojaId, novaOrdem } = req.body;

    // Verificar se usuário é admin
    if (req.usuario.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Buscar a relação atual
    const relacaoAtual = await RoteiroLoja.findOne({
      where: { roteiroId: id, lojaId }
    });

    if (!relacaoAtual) {
      return res.status(404).json({ error: 'Loja não encontrada no roteiro' });
    }

    const ordemAntiga = relacaoAtual.ordem;

    // Buscar todas as lojas do roteiro ordenadas
    const todasLojas = await RoteiroLoja.findAll({
      where: { roteiroId: id },
      order: [['ordem', 'ASC']]
    });

    // Remover a loja da posição antiga
    const lojasFiltradas = todasLojas.filter(l => l.lojaId !== lojaId);
    
    // Inserir na nova posição
    lojasFiltradas.splice(novaOrdem, 0, relacaoAtual);

    // Atualizar todas as ordens
    for (let i = 0; i < lojasFiltradas.length; i++) {
      await RoteiroLoja.update(
        { ordem: i },
        { where: { id: lojasFiltradas[i].id } }
      );
    }

    res.json({ 
      success: true, 
      message: 'Loja reordenada com sucesso',
      ordemAntiga,
      ordemNova: novaOrdem
    });

  } catch (error) {
    console.error('Erro ao reordenar loja:', error);
    res.status(500).json({ error: 'Erro ao reordenar loja' });
  }
});
```

### 3. Atualizar rota de MOVER loja entre roteiros
Modificar para atribuir ordem automaticamente ao mover:

```javascript
// routes/roteiros.js

/**
 * POST /roteiros/mover-loja
 * Move uma loja de um roteiro para outro (ou adiciona nova)
 */
router.post('/mover-loja', authMiddleware, async (req, res) => {
  try {
    const { lojaId, roteiroOrigemId, roteiroDestinoId } = req.body;

    // Verificar se usuário é admin
    if (req.usuario.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    // Se tem origem, remover de lá
    if (roteiroOrigemId) {
      await RoteiroLoja.destroy({
        where: { roteiroId: roteiroOrigemId, lojaId }
      });

      // Reorganizar ordens do roteiro origem
      const lojasOrigem = await RoteiroLoja.findAll({
        where: { roteiroId: roteiroOrigemId },
        order: [['ordem', 'ASC']]
      });
      
      for (let i = 0; i < lojasOrigem.length; i++) {
        await RoteiroLoja.update(
          { ordem: i },
          { where: { id: lojasOrigem[i].id } }
        );
      }
    }

    // Adicionar no destino
    // Buscar a maior ordem atual no roteiro destino
    const maxOrdem = await RoteiroLoja.max('ordem', {
      where: { roteiroId: roteiroDestinoId }
    });

    const novaOrdem = (maxOrdem || -1) + 1;

    await RoteiroLoja.create({
      roteiroId: roteiroDestinoId,
      lojaId,
      ordem: novaOrdem
    });

    res.json({ 
      success: true, 
      message: 'Loja movida com sucesso',
      novaOrdem
    });

  } catch (error) {
    console.error('Erro ao mover loja:', error);
    res.status(500).json({ error: 'Erro ao mover loja' });
  }
});
```

### 4. Rota para SALVAR justificativa de quebra de ordem
Novo endpoint para registrar quando funcionário pula uma loja:

```javascript
// routes/roteiros.js

/**
 * POST /roteiros/:id/justificar-ordem
 * Registra justificativa quando funcionário pula ordem de loja
 */
router.post('/:id/justificar-ordem', authMiddleware, async (req, res) => {
  try {
    const { id: roteiroId } = req.params;
    const { lojaId, justificativa } = req.body;
    const usuarioId = req.usuario.id;

    if (!justificativa || justificativa.trim() === '') {
      return res.status(400).json({ error: 'Justificativa é obrigatória' });
    }

    // Buscar lojas do roteiro ordenadas
    const lojasRoteiro = await RoteiroLoja.findAll({
      where: { roteiroId },
      include: [{
        model: Loja,
        include: [{ model: Maquina }]
      }],
      order: [['ordem', 'ASC']]
    });

    // Encontrar qual seria a próxima loja esperada
    let lojaEsperadaId = null;
    for (const rel of lojasRoteiro) {
      const loja = rel.Loja;
      const todasFinalizadas = loja.Maquinas.every(m => m.status === 'finalizado');
      if (!todasFinalizadas) {
        lojaEsperadaId = loja.id;
        break;
      }
    }

    // Salvar no log
    await LogOrdemRoteiro.create({
      roteiroId,
      lojaId,
      usuarioId,
      lojaEsperadaId,
      lojaSelecionadaId: lojaId,
      justificativa
    });

    res.json({ 
      success: true, 
      message: 'Justificativa registrada com sucesso' 
    });

  } catch (error) {
    console.error('Erro ao salvar justificativa:', error);
    res.status(500).json({ error: 'Erro ao salvar justificativa' });
  }
});
```

### 5. Atualizar endpoint `/roteiros/:id/executar`
Modificar para retornar lojas ORDENADAS:

```javascript
// routes/roteiros.js ou controller

/**
 * GET /roteiros/:id/executar
 * Busca roteiro com lojas para execução
 */
router.get('/:id/executar', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;

    const roteiro = await Roteiro.findByPk(id, {
      include: [
        {
          model: Loja,
          through: {
            attributes: ['ordem'], // Incluir ordem no resultado
          },
          include: [
            {
              model: Maquina,
              // ... incluir status de maquinas
            }
          ]
        }
      ]
    });

    if (!roteiro) {
      return res.status(404).json({ error: 'Roteiro não encontrado' });
    }

    // Ordenar lojas pela ordem definida
    if (roteiro.Lojas) {
      roteiro.Lojas.sort((a, b) => {
        const ordemA = a.RoteiroLoja?.ordem || 0;
        const ordemB = b.RoteiroLoja?.ordem || 0;
        return ordemA - ordemB;
      });

      // Adicionar campo ordem diretamente nas lojas para facilitar no frontend
      roteiro.Lojas = roteiro.Lojas.map(loja => ({
        ...loja.toJSON(),
        ordem: loja.RoteiroLoja?.ordem || 0
      }));
    }

    res.json(roteiro);

  } catch (error) {
    console.error('Erro ao buscar roteiro:', error);
    res.status(500).json({ error: 'Erro ao buscar roteiro' });
  }
});
```

### 6. Atualizar endpoint `/roteiros/com-status`
Também deve retornar lojas ordenadas:

```javascript
// routes/roteiros.js

/**
 * GET /roteiros/com-status
 * Lista todos os roteiros com status
 */
router.get('/com-status', authMiddleware, async (req, res) => {
  try {
    const roteiros = await Roteiro.findAll({
      include: [
        {
          model: Loja,
          through: {
            attributes: ['ordem'],
          },
          include: [{ model: Maquina }]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Ordenar lojas de cada roteiro
    const roteirosFormatados = roteiros.map(roteiro => {
      const roteiroJson = roteiro.toJSON();
      
      if (roteiroJson.Lojas) {
        roteiroJson.Lojas.sort((a, b) => {
          const ordemA = a.RoteiroLoja?.ordem || 0;
          const ordemB = b.RoteiroLoja?.ordem || 0;
          return ordemA - ordemB;
        });

        roteiroJson.Lojas = roteiroJson.Lojas.map(loja => ({
          ...loja,
          ordem: loja.RoteiroLoja?.ordem || 0
        }));
      }

      return roteiroJson;
    });

    res.json(roteirosFormatados);

  } catch (error) {
    console.error('Erro ao buscar roteiros:', error);
    res.status(500).json({ error: 'Erro ao buscar roteiros' });
  }
});
```

### 7. Salvar justificativa nas movimentações (OPCIONAL)
Quando o funcionário registrar a movimentação após pular ordem, salvar a justificativa:

```javascript
// No controller de movimentações, adicionar:

// Quando criar uma movimentação, verificar se há justificativa pendente
const ultimaJustificativa = await LogOrdemRoteiro.findOne({
  where: {
    roteiroId,
    lojaId,
    usuarioId: req.usuario.id
  },
  order: [['created_at', 'DESC']]
});

if (ultimaJustificativa) {
  // Adicionar justificativa na movimentação
  movimentacao.justificativa_ordem = ultimaJustificativa.justificativa;
  await movimentacao.save();
}
```

## 📊 MODELS ADICIONAIS (se necessário)

### Model para LogOrdemRoteiro

```javascript
// models/logOrdemRoteiro.js

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const LogOrdemRoteiro = sequelize.define('LogOrdemRoteiro', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    roteiroId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'roteiro_id'
    },
    lojaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'loja_id'
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'usuario_id'
    },
    lojaEsperadaId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'loja_esperada_id'
    },
    lojaSelecionadaId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'loja_selecionada_id'
    },
    justificativa: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  }, {
    tableName: 'log_ordem_roteiro',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });

  return LogOrdemRoteiro;
};
```

## 🧪 TESTES RECOMENDADOS

1. **Teste de reordenação:**
   - Criar roteiro com 3 lojas
   - Reordenar: mover última para primeira posição
   - Verificar se ordem foi atualizada corretamente

2. **Teste de justificativa:**
   - Funcionário tenta acessar 3ª loja sem finalizar a 1ª
   - Sistema deve exigir justificativa
   - Verificar se justificativa foi salva no banco

3. **Teste de movimentação entre roteiros:**
   - Mover loja do roteiro A para B
   - Verificar se ordem foi ajustada em ambos

## 📝 OBSERVAÇÕES IMPORTANTES

1. **Performance:** Ao reordenar, evite fazer múltiplos updates. Considere usar transações.

2. **Validações:** Validar sempre se usuário tem permissão (ADMIN para reordenar).

3. **Logs:** Manter log de todas as alterações de ordem para auditoria.

4. **Frontend já implementado:** O frontend já está esperando:
   - Campo `ordem` nas lojas
   - Endpoint `PATCH /roteiros/:id/reordenar-loja`
   - Endpoint `POST /roteiros/:id/justificar-ordem`

5. **Migrations:** Se usar sistema de migrations, criar arquivos de migration apropriados ao invés de executar SQL diretamente.

## ✅ CHECKLIST DE IMPLEMENTAÇÃO

- [ ] Adicionar coluna `ordem` na tabela `roteiros_lojas`
- [ ] Adicionar coluna `justificativa_ordem` na tabela `movimentacoes`
- [ ] Criar tabela `log_ordem_roteiro` (opcional)
- [ ] Criar model `LogOrdemRoteiro`
- [ ] Implementar endpoint `PATCH /roteiros/:id/reordenar-loja`
- [ ] Atualizar endpoint `POST /roteiros/mover-loja`
- [ ] Implementar endpoint `POST /roteiros/:id/justificar-ordem`
- [ ] Atualizar endpoint `GET /roteiros/:id/executar` para retornar lojas ordenadas
- [ ] Atualizar endpoint `GET /roteiros/com-status` para retornar lojas ordenadas
- [ ] Adicionar índices no banco para otimização
- [ ] Testar reordenação de lojas
- [ ] Testar justificativa de quebra de ordem
- [ ] Testar movimentação entre roteiros mantendo ordem

## 🚀 DEPLOY

Após implementar todas as alterações:
1. Rodar migrations no banco de dados de produção
2. Fazer deploy do backend
3. Testar em ambiente de staging antes de produção
4. Monitorar logs nas primeiras horas
