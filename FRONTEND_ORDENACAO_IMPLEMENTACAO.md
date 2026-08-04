# Implementação de Ordenação de Lojas em Roteiros - Frontend

## 📝 Resumo das Alterações

Este documento descreve as alterações implementadas no frontend para adicionar funcionalidade de ordenação de lojas em roteiros.

## ✅ Arquivos Modificados

### 1. `/src/pages/Roteiros.jsx`

**Alterações implementadas:**

- ✅ Adicionado estado `draggedOverIndex` para controlar visual do drag and drop
- ✅ Implementada função `handleReordenarLoja()` para enviar requisição de reordenação ao backend
- ✅ Melhorado handlers de drag and drop:
  - `onDragOver` - mostra indicador visual ao arrastar sobre uma loja
  - `onDragLeave` - remove indicador visual
  - `onDrop` - diferencia entre reordenação (mesmo roteiro) e movimentação (roteiros diferentes)
- ✅ Modificada renderização das lojas:
  - Lojas são ordenadas pelo campo `ordem` antes de renderizar
  - Cada loja exibe um número de ordem visual (badge roxo com número)
  - Visual do drag and drop melhorado com border azul quando arrastar sobre
  - Permitido arrastar para reordenar dentro do mesmo roteiro

**Endpoints esperados do backend:**
```javascript
PATCH /roteiros/:id/reordenar-loja
Body: { lojaId, novaOrdem }
```

### 2. `/src/pages/RoteiroExecucao.jsx`

**Alterações implementadas:**

- ✅ Adicionado estado `modalJustificativa` para controlar modal de justificativa
- ✅ Implementada função `handleSelecionarLoja()` com validação de ordem:
  - Verifica se o funcionário está seguindo a ordem correta
  - Se pular uma loja, abre modal solicitando justificativa
  - Só permite continuar após preencher a justificativa
- ✅ Implementada função `confirmarSelecaoComJustificativa()`:
  - Valida se justificativa foi preenchida
  - Envia justificativa ao backend
  - Permite prosseguir com a loja selecionada após salvar
- ✅ Modificada renderização da lista de lojas:
  - Lojas são ordenadas pelo campo `ordem`
  - Exibe número sequencial (1, 2, 3...) com badge visual
  - Mantém indicadores de status (finalizada, selecionada)
- ✅ Adicionado Modal de Justificativa:
  - Aparece quando funcionário tenta pular ordem
  - Textarea para escrever motivo
  - Validação de campo obrigatório
  - Botões de cancelar e confirmar

**Endpoints esperados do backend:**
```javascript
POST /roteiros/:id/justificar-ordem
Body: { lojaId, justificativa }
```

## 🎯 Funcionalidades Implementadas

### Para Administradores (Gestão de Roteiros):

1. **Visualização da ordem**: Cada loja exibe seu número de ordem dentro do roteiro
2. **Drag and drop para reordenar**: 
   - Arraste uma loja para cima ou para baixo dentro do mesmo roteiro
   - Visual indica onde a loja será solta (borda azul)
   - Ao soltar, envia requisição ao backend para atualizar ordem
3. **Mover entre roteiros**: Continua funcionando - arraste loja para outro roteiro

### Para Funcionários (Execução de Roteiros):

1. **Ordem visual**: Vê a ordem de visitação das lojas (1ª, 2ª, 3ª...)
2. **Validação de sequência**: 
   - Sistema verifica se está seguindo a ordem
   - Se tentar pular uma loja, modal é exibido
3. **Justificativa obrigatória**:
   - Precisa explicar por que está pulando ordem
   - Exemplo: "Loja fechada", "Problema de acesso", etc.
   - Só consegue prosseguir após justificar

## 🔄 Fluxo de Uso

### Admin - Definindo ordem:
1. Acessa página de Roteiros
2. Vê lojas numeradas (1, 2, 3...)
3. Arrasta loja para nova posição
4. Sistema salva automaticamente no backend

### Funcionário - Executando roteiro:
1. Acessa execução do roteiro
2. Vê lojas na ordem definida pelo admin (1ª, 2ª, 3ª...)
3. Deve seguir a sequência:
   - Se selecionar 1ª loja → OK, prossegue normalmente
   - Se tentar selecionar 3ª antes da 1ª → Modal aparece pedindo justificativa
4. Preenche justificativa e prossegue
5. Justificativa é salva no banco para auditoria

## 📊 Estrutura de Dados Esperada

### Objeto Loja (retornado pela API):
```javascript
{
  id: "uuid",
  nome: "Nome da Loja",
  cidade: "Cidade",
  estado: "UF",
  ordem: 0,  // ← NOVO CAMPO
  status: "pendente" | "finalizado",
  maquinas: [...]
}
```

### Objeto Roteiro com Lojas:
```javascript
{
  id: "uuid",
  nome: "Roteiro Norte",
  lojas: [
    { id: "uuid-1", nome: "Loja A", ordem: 0, ... },
    { id: "uuid-2", nome: "Loja B", ordem: 1, ... },
    { id: "uuid-3", nome: "Loja C", ordem: 2, ... }
  ]
}
```

## 🔧 Integrações Necessárias no Backend

Consulte o arquivo `PROMPT_BACKEND_ORDENACAO_ROTEIROS.md` para instruções detalhadas de implementação no backend.

### Resumo dos endpoints necessários:

1. ✅ `PATCH /roteiros/:id/reordenar-loja` - Reordena loja dentro do roteiro
2. ✅ `POST /roteiros/:id/justificar-ordem` - Salva justificativa de quebra de ordem
3. ✅ `GET /roteiros/:id/executar` - Deve retornar lojas com campo `ordem`
4. ✅ `GET /roteiros/com-status` - Deve retornar lojas com campo `ordem`
5. ✅ `POST /roteiros/mover-loja` - Deve atribuir ordem ao mover loja

### Tabelas do banco que precisam modificação:

1. ✅ `roteiros_lojas` - Adicionar coluna `ordem INTEGER`
2. ✅ `movimentacoes` - Adicionar coluna `justificativa_ordem TEXT`
3. ✅ `log_ordem_roteiro` - Nova tabela para logs (opcional)

## 🎨 Componentes Visuais

### Badge de Ordem:
```jsx
<span className="bg-[#24094E] text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
  {index + 1}
</span>
```

### Indicador de Drag:
- Borda azul quando arrasta sobre a loja
- Cursor `move` para indicar que pode arrastar

### Modal de Justificativa:
- Título: "Justificar alteração de ordem"
- Textarea para justificativa
- Botões: Cancelar e Confirmar

## 🚀 Como Testar

### Teste 1 - Reordenação (Admin):
1. Login como admin
2. Ir para página de Roteiros
3. Criar roteiro com 3 lojas
4. Arrastar última loja para primeira posição
5. Verificar se ordem visual mudou
6. Recarregar página e verificar se persistiu

### Teste 2 - Validação de Ordem (Funcionário):
1. Login como funcionário
2. Executar roteiro com 3 lojas
3. Tentar selecionar 3ª loja diretamente
4. Modal deve aparecer pedindo justificativa
5. Preencher e confirmar
6. Deve permitir prosseguir

### Teste 3 - Seguir Ordem Normal (Funcionário):
1. Login como funcionário
2. Executar roteiro
3. Selecionar 1ª loja → OK, sem modal
4. Finalizar 1ª loja
5. Selecionar 2ª loja → OK, sem modal
6. Finalizar 2ª loja
7. Selecionar 3ª loja → OK, sem modal

## 📝 Notas Importantes

- Frontend já está pronto e funcional
- Backend precisa implementar os endpoints listados
- Campo `ordem` deve ser retornado pela API em todas as requisições de lojas
- Justificativas ficam salvas para auditoria futura
- Reordenação é exclusiva para administradores
- Funcionários apenas seguem a ordem, não podem alterar

## 🔗 Arquivos Relacionados

- `/src/pages/Roteiros.jsx` - Gestão de roteiros (admin)
- `/src/pages/RoteiroExecucao.jsx` - Execução de roteiros (funcionário)
- `/src/components/UIComponents.jsx` - Componente Modal utilizado
- `PROMPT_BACKEND_ORDENACAO_ROTEIROS.md` - Instruções para backend
