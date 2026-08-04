# 🔧 Correções: Carrinho de Peças para Funcionários

## 📋 Problema Identificado

Funcionários estavam recebendo **erro 403 (Forbidden)** ao tentar acessar seu próprio carrinho na aba "Peças":

```
GET /api/usuarios/06be16fa-9d45-4173-a667-db123ae2104d/carrinho
→ 403 Forbidden
Error: "Acesso negado. Você não tem permissão para esta ação."
```

## 🔍 Causa Raiz

### Problema 1: Comparação de Tipos Incompatíveis
No arquivo `backend/src/controllers/carrinhoPecaController.js`, o código comparava:
- `req.params.id` (string UUID)
- `req.usuario.id` (pode ser string ou número dependendo do JWT)

A comparação falhava porque os tipos não eram garantidos como iguais.

### Problema 2: Ordem das Rotas
No arquivo `backend/src/routes/index.js`, as rotas de carrinho estavam registradas **DEPOIS** das rotas de usuário, que têm um middleware global `autorizar(["ADMIN"])`, bloqueando qualquer role diferente de ADMIN.

---

## ✅ Correções Implementadas

### 1. Backend - `carrinhoPecaController.js`

**Arquivo:** `backend/src/controllers/carrinhoPecaController.js`

**Mudança:** Garantir que ambos os IDs sejam comparados como strings (UUID).

**Antes:**
```javascript
export const listarCarrinho = async (req, res) => {
  try {
    const usuarioId = req.params.id;  // ❌ Pode ser string ou número
    if (
      req.usuario.role !== "ADMIN" &&
      req.usuario.role !== "GERENCIADOR" &&
      req.usuario.id !== usuarioId  // ❌ Tipos podem ser diferentes
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    // ...
  }
}
```

**Depois:**
```javascript
export const listarCarrinho = async (req, res) => {
  try {
    const usuarioId = String(req.params.id);  // ✅ Garante string
    if (
      req.usuario.role !== "ADMIN" &&
      req.usuario.role !== "GERENCIADOR" &&
      String(req.usuario.id) !== usuarioId  // ✅ Compara string === string
    ) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    // ...
  }
}
```

**Por quê String()?** UUIDs são strings. Usar `String()` garante que ambos os lados da comparação sejam do mesmo tipo, independente de como o JWT armazena o ID do usuário.

**Aplicar em:**
- ✅ `listarCarrinho()`
- ✅ `adicionarAoCarrinho()`
- ✅ `removerDoCarrinho()`

---

### 2. Backend - `index.js` (Ordem das Rotas)

**Arquivo:** `backend/src/routes/index.js`

**Mudança:** Registrar rotas de carrinho **ANTES** das rotas de usuário.

**Antes:**
```javascript
router.use("/auth", authRoutes);
router.use("/usuarios", usuarioRoutes);  // ❌ Middleware autorizar(["ADMIN"]) primeiro
router.use("/usuarios", carrinhoPecaRoutes);  // ❌ Nunca alcançado para não-ADMIN
```

**Depois:**
```javascript
router.use("/auth", authRoutes);
// Carrinho deve vir ANTES de usuarioRoutes
router.use("/usuarios", carrinhoPecaRoutes);  // ✅ Processado primeiro
router.use("/usuarios", usuarioRoutes);  // ✅ Middleware ADMIN só afeta rotas próprias
```

**Por quê:** No Express, a ordem de registro importa. Rotas mais específicas (`/usuarios/:id/carrinho`) devem vir antes de rotas genéricas (`/usuarios/*`) com middlewares restritivos.

---

### 3. Frontend - Tratamento Temporário de Erros

**Arquivo:** `src/pages/PecasPage.jsx`

Adicionei tratamento para **modo degradado** enquanto o backend não estiver deployado:

**⚠️ IMPORTANTE:** Sempre use `/usuarios/${userId}/carrinho`. **NÃO existe** `/meu-carrinho` no backend.

**Mudanças:**
```javascript
// Estado para controlar disponibilidade do carrinho
const [carrinhoDisponivel, setCarrinhoDisponivel] = useState(true);

// Ignora erro 403 silenciosamente
useEffect(() => {
  async function fetchCarrinho() {
    try {
      // ✅ Rota correta: sempre /usuarios/{userId}/carrinho
      const res = await api.get(`/usuarios/${usuario.id}/carrinho`);
      setCarrinho(res.data || []);
      setCarrinhoDisponivel(true);
    } catch (err) {
      if (err.response?.status === 403) {
        setCarrinhoDisponivel(false);  // ✅ Não mostra erro
        console.log("⚠️ Carrinho indisponível (aguardando deploy)");
      }
    }
  }
  fetchCarrinho();
}, [usuario]);

// Botão desabilitado se carrinho indisponível
<button
  disabled={!carrinhoDisponivel}
  className={carrinhoDisponivel ? 'bg-blue-600' : 'bg-gray-300'}
>
  Adicionar ao Carrinho
</button>

// Aviso visual na seção do carrinho
{!carrinhoDisponivel ? (
  <div className="bg-yellow-50 border border-yellow-200 p-4">
    ⚠️ Funcionalidade de carrinho temporariamente indisponível.
  </div>
) : ...}
```

**Arquivo:** `src/components/ManutencaoModal.jsx`

Tratamento similar para não quebrar o fluxo de manutenção:
```javascript
// Ignora erro 403 ao carregar carrinho
catch (err) {
  if (err?.response?.status === 403) {
    console.log("⚠️ Carrinho indisponível (aguardando deploy)");
  }
  setPecasCarrinho([]);
}

// Ignora erro 403 ao remover peça do carrinho após manutenção
if (pecaSelecionada && pecaSelecionada !== "nao-usar") {
  try {
    await api.delete(`/usuarios/${usuarioId}/carrinho/${pecaSelecionada}`);
  } catch (carrinhoErr) {
    if (carrinhoErr?.response?.status !== 403) {
      console.error("Erro ao remover peça:", carrinhoErr);
    }
  }
}
```

---

## 📦 Arquivos que Precisam Ser Deployados no Backend

### Prioridade ALTA (Bloqueia funcionalidade):
1. ✅ `backend/src/controllers/carrinhoPecaController.js`
   - Usar `String(req.params.id)` e `String(req.usuario.id)` nas 3 funções
   - Garante comparação correta de UUIDs (sempre strings)

2. ✅ `backend/src/routes/index.js`
   - Mover `router.use("/usuarios", carrinhoPecaRoutes)` ANTES de `usuarioRoutes`

### Arquivos Criados (Podem ser Ignorados):
- ❌ `backend/src/routes/meuCarrinho.routes.js` - **NÃO DEPLOY** (foi uma tentativa que não é necessária)
- ❌ Novas funções `listarMeuCarrinho`, `adicionarAoMeuCarrinho`, etc. - **NÃO NECESSÁRIO**

### ⚠️ Lembrete Importante:
- **NÃO existe rota `/meu-carrinho`** no backend
- Sempre use `/usuarios/{userId}/carrinho` no frontend

---

## 🧪 Como Testar Após Deploy

### 1. Teste via Navegador (Funcionário):
```
1. Login como FUNCIONARIO
2. Ir na aba "Peças"
3. Deve carregar sem erro 403
4. Clicar em "Adicionar ao Carrinho"
5. Deve adicionar com sucesso
6. Ver seção "Meu Carrinho" com a peça adicionada
```

### 2. Teste via Console do Navegador:
```javascript
// Após login como FUNCIONARIO
const userId = "06be16fa-9d45-4173-a667-db123ae2104d";
const token = localStorage.getItem("token");

// Deve retornar 200 OK
fetch(`https://starboxbackend.onrender.com/api/usuarios/${userId}/carrinho`, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);

// Deve retornar 201 Created
fetch(`https://starboxbackend.onrender.com/api/usuarios/${userId}/carrinho`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ pecaId: "algum-uuid", quantidade: 1 })
}).then(r => r.json()).then(console.log);
```

### 3. Verificar Logs do Backend:
```
✅ "[Carrinho] Usuario 123 acessando carrinho 123" (permitido)
❌ "[Carrinho] Acesso negado: usuario 123 !== '123'" (NÃO DEVE APARECER)
```

---

## 📊 Comparação: Antes vs Depois

| Cenário | Antes | Depois |
|---------|-------|--------|
| Funcionário vê seu carrinho | ❌ 403 Forbidden | ✅ 200 OK |
| Funcionário adiciona peça | ❌ 403 Forbidden | ✅ 201 Created |
| Funcionário remove peça | ❌ 403 Forbidden | ✅ 200 OK |
| Admin vê carrinho de outro usuário | ✅ Funciona | ✅ Funciona |
| Funcionário tenta ver carrinho de outro | ❌ 403 | ❌ 403 (correto) |

---

## 🔄 Fluxo de Deploy

1. **Fazer commit das mudanças:**
   ```bash
   git add backend/src/controllers/carrinhoPecaController.js
   git add backend/src/routes/index.js
   git commit -m "fix: permitir funcionarios acessarem proprio carrinho (String() + ordem rotas)"
   git push origin main
   ```

2. **Deploy no Render:**
   - Render detecta mudanças automaticamente
   - Aguardar rebuild (~2-5 minutos)

3. **Validar deploy:**
   - Testar endpoints via Postman ou console
   - Login como funcionário e testar aba Peças

4. **Remover tratamento temporário do frontend (opcional):**
   - Após confirmar que backend está OK
   - Remover variável `carrinhoDisponivel` e avisos visuais
   - Simplificar código de erro

---

## 🐛 Troubleshooting

### Se ainda der 403 após deploy:

**Verifique no código deployado:**
1. `carrinhoPecaController.js` tem `String(req.params.id)` e `String(req.usuario.id)` nas 3 funções?
2. `index.js` tem `carrinhoPecaRoutes` ANTES de `usuarioRoutes`?
3. Frontend está usando `/usuarios/${userId}/carrinho` (NÃO `/meu-carrinho`)?

**Verificar logs do Render:**
```bash
# No dashboard do Render
→ Selecionar serviço backend
→ Aba "Logs"
→ Procurar por: "Acesso negado" ou "403"
```

**Teste manual no Postman:**
```
GET https://starboxbackend.onrender.com/api/usuarios/{seu-user-id}/carrinho
Authorization: Bearer {seu-token}

Deve retornar 200, não 403
```

---

## 📞 Suporte

**Arquivos modificados:**
- `backend/src/controllers/carrinhoPecaController.js` (3 funções)
- `backend/src/routes/index.js` (linha 27-28)
- `src/pages/PecasPage.jsx` (tratamento temporário de erro)
- `src/components/ManutencaoModal.jsx` (tratamento temporário de erro)

**Documentação relacionada:**
- `IMPLEMENTACAO_CARRINHOS.md` (feature original)
- `BACKEND_MANUTENCOES_ROTEIRO.md` (uso de carrinho em manutenções)

---

**Data:** 06/03/2026  
**Status:** ✅ Código local corrigido, aguardando deploy no Render  
**Impacto:** 🟢 Baixo (melhoria de funcionalidade, não quebra nada existente)
