import React, { useState } from "react";
import api from "../services/api";
import { useEffect } from "react";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";

export default function PecasPage() {
  const { usuario } = useAuth();
  const isFuncionarioComum =
    usuario?.role === "FUNCIONARIO" ||
    usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
    usuario?.role === "ABASTECEDOR";
  const [pecas, setPecas] = useState([]);
  const [pecaEditando, setPecaEditando] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  
  // Buscar peças reais do backend ao carregar a página
  useEffect(() => {
    async function fetchPecas() {
      try {
        const res = await api.get("/pecas");
        setPecas(res.data);
      } catch (err) {
        setPecas([]);
        console.error("Erro ao buscar peças do backend:", err);
      }
    }
    fetchPecas();
  }, []);
  const [carrinho, setCarrinho] = useState([]);

  // Carregar carrinho do backend ao atualizar a página
  useEffect(() => {
    async function fetchCarrinho() {
      if (usuario && usuario.id) {
        try {
          const res = await api.get(`/usuarios/${usuario.id}/carrinho`);
          console.log("[PecasPage] Carrinho recebido:", res.data);
          setCarrinho(res.data || []);
        } catch (err) {
          setCarrinho([]);
          console.error("Erro ao buscar carrinho do backend:", err);
        }
      }
    }
    fetchCarrinho();
  }, [usuario]);

  // Adiciona peça ao carrinho do usuário
  const adicionarAoCarrinho = async (peca) => {
    if (isFuncionarioComum) {
      alert("Seu perfil não possui permissão para adicionar peças ao carrinho.");
      return;
    }

    if (!peca || peca.quantidade === 0) {
      alert(
        "Não é possível adicionar ao carrinho: peça sem estoque disponível.",
      );
      return;
    }

    if (!usuario || !usuario.id) {
      alert("Usuário não autenticado");
      return;
    }

    try {
      await api.post(`/usuarios/${usuario.id}/carrinho`, {
        pecaId: peca.id,
        quantidade: 1,
      });

      // Atualizar listas após adicionar
      const [resPecas, resCarrinho] = await Promise.all([
        api.get("/pecas"),
        api.get(`/usuarios/${usuario.id}/carrinho`),
      ]);
      setPecas(resPecas.data || []);
      setCarrinho(resCarrinho.data || []);
      alert("Peça adicionada ao carrinho com sucesso!");
    } catch (err) {
      console.error("[adicionarAoCarrinho] Erro:", err.response?.data || err);
      alert(err.response?.data?.error || "Erro ao adicionar peça ao carrinho");

      // Recarregar peças para garantir estado correto
      try {
        const resPecas = await api.get("/pecas");
        setPecas(resPecas.data || []);
      } catch (e) {
        console.error("Erro ao recarregar peças:", e);
      }
    }
  };

  // Remove peça do carrinho do usuário e devolve ao estoque (backend)
  const removerDoCarrinho = async (itemId) => {
    const item = carrinho.find((i) => i.pecaId === itemId || i.id === itemId);
    if (!item) {
      console.warn("[removerDoCarrinho] Peça não encontrada no carrinho", {
        itemId,
        carrinho,
      });
      return;
    }

    // Usa o pecaId correto do item encontrado
    const pecaId = item.pecaId || item.id;
    if (!usuario || !usuario.id || !pecaId) {
      console.error("[removerDoCarrinho] Dados insuficientes", {
        usuario,
        pecaId,
      });
      return;
    }

    if (
      !window.confirm(
        "Deseja realmente remover esta peça do carrinho? Ela será devolvida ao estoque.",
      )
    ) {
      return;
    }

    const url = `/usuarios/${usuario.id}/carrinho/${pecaId}`;
    console.log("[removerDoCarrinho] DELETE", {
      url,
      usuarioId: usuario.id,
      pecaId,
      item,
    });
    try {
      await api.delete(url);
      // Atualiza lista de peças e carrinho após devolução
      const [resPecas, resCarrinho] = await Promise.all([
        api.get("/pecas"),
        api.get(`/usuarios/${usuario.id}/carrinho`),
      ]);
      setPecas(resPecas.data || []);
      setCarrinho(resCarrinho.data || []);
      alert("Peça removida e devolvida ao estoque!");
    } catch (err) {
      console.error("[removerDoCarrinho] Erro ao chamar DELETE", {
        url,
        pecaId,
        item,
        error: err,
        response: err?.response,
      });
      alert(err.response?.data?.error || "Erro ao remover peça do carrinho");
    }
  };

  const carrinhoPorPecaId = carrinho.reduce((acc, item) => {
    const pecaId = String(item.pecaId || item.id || "");
    if (!pecaId) return acc;
    acc[pecaId] = (acc[pecaId] || 0) + Number(item.quantidade || 0);
    return acc;
  }, {});

  const pecasNoCarrinhoComZero = pecas.map((peca) => ({
    ...peca,
    quantidadeCarrinho: carrinhoPorPecaId[String(peca.id)] || 0,
  }));

  const itensCarrinho = isFuncionarioComum
    ? carrinho.map((item) => {
        const pecaId = item.pecaId || item.id || item.Peca?.id;
        const quantidadeCarrinho = Number(item.quantidade || 0);
        return {
          id: pecaId,
          nome:
            item.nome ||
            item.Peca?.nome ||
            item.peca?.nome ||
            `Peça ${pecaId}`,
          categoria:
            item.categoria || item.Peca?.categoria || item.peca?.categoria,
          quantidadeCarrinho,
        };
      })
    : pecasNoCarrinhoComZero;

  // Editar peça
  const handleEditar = (peca) => {
    setPecaEditando(peca);
    setShowEditModal(true);
  };

  // Excluir peça
  const handleExcluir = async (pecaId, nomePeca) => {
    if (!window.confirm(`Tem certeza que deseja excluir a peça "${nomePeca}"?`)) {
      return;
    }

    try {
      await api.delete(`/pecas/${pecaId}`);
      alert("✅ Peça excluída com sucesso!");
      
      // Recarregar lista de peças
      const resPecas = await api.get("/pecas");
      setPecas(resPecas.data || []);
    } catch (err) {
      console.error("Erro ao excluir peça:", err);
      alert(err.response?.data?.error || "Erro ao excluir peça");
    }
  };

  // Salvar edição da peça
  const handleSalvarEdicao = async (formData) => {
    try {
      // Preparar dados para envio ao backend
      const dadosParaEnviar = {
        nome: formData.nome,
        categoria: formData.categoria,
        quantidade: parseInt(formData.quantidade) || 0,
        descricao: formData.descricao || '',
        ativo: formData.ativo === true || formData.ativo === 'true'
      };

      // Adicionar preço apenas se tiver valor
      if (formData.preco && formData.preco !== '' && formData.preco !== '0') {
        dadosParaEnviar.preco = parseFloat(formData.preco);
      }

      console.log('📤 Enviando para o backend:', dadosParaEnviar);

      await api.put(`/pecas/${pecaEditando.id}`, dadosParaEnviar);
      alert("✅ Peça atualizada com sucesso!");
      
      setShowEditModal(false);
      setPecaEditando(null);
      
      // Recarregar lista de peças
      const resPecas = await api.get("/pecas");
      setPecas(resPecas.data || []);
    } catch (err) {
      console.error("Erro ao salvar peça:", err);
      console.error("Detalhes do erro:", err.response?.data);
      alert(err.response?.data?.error || err.response?.data?.message || "Erro ao salvar peça");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            🛠️ Peças
          </h1>
          {(usuario?.role === "ADMIN" ||
            usuario?.role === "GERENCIADOR" ||
            usuario?.role === "CONTROLADOR_ESTOQUE") && (
            <button
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded font-semibold shadow text-sm"
              onClick={() => (window.location.href = "/pecas/nova")}
            >
              + Nova Peça
            </button>
          )}
        </div>
        <p className="text-gray-600 mb-4">
          Aqui você pode visualizar, cadastrar e gerenciar peças do estoque.
          Perfis autorizados podem adicionar peças ao carrinho para uso em roteiros.
        </p>

        {!isFuncionarioComum && (
          <div className="overflow-x-auto bg-white rounded-xl shadow p-4 border border-gray-100 mb-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Nome
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Categoria
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Quantidade
                  </th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pecas.map((peca) => (
                  <tr key={peca.id}>
                    <td className="px-4 py-2 font-semibold text-gray-800">
                      {peca.nome}
                    </td>
                    <td className="px-4 py-2 text-gray-700">
                      {peca.categoria}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`font-semibold ${
                          peca.quantidade === 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {peca.quantidade}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-center gap-2">
                        {(usuario?.role === "CONTROLADOR_ESTOQUE" ||
                          usuario?.role === "MANUTENCAO" ||
                          usuario?.role === "ADMIN" ||
                          usuario?.role === "GERENCIADOR") && (
                          <button
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs font-semibold"
                            onClick={() => adicionarAoCarrinho(peca)}
                            title="Adicionar peça ao carrinho"
                          >
                            🛒 Carrinho
                          </button>
                        )}

                        {(usuario?.role === "ADMIN" ||
                          usuario?.role === "GERENCIADOR" ||
                          usuario?.role === "CONTROLADOR_ESTOQUE") && (
                          <>
                            <button
                              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
                              onClick={() => handleEditar(peca)}
                              title="Editar peça"
                            >
                              ✏️ Editar
                            </button>
                            <button
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs font-semibold flex items-center gap-1"
                              onClick={() => handleExcluir(peca.id, peca.nome)}
                              title="Excluir peça"
                            >
                              🗑️ Excluir
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Carrinho do usuário */}
        {(usuario?.role === "FUNCIONARIO" ||
          usuario?.role === "FUNCIONARIO_TODAS_LOJAS" ||
          usuario?.role === "ABASTECEDOR" ||
          usuario?.role === "CONTROLADOR_ESTOQUE" ||
          usuario?.role === "MANUTENCAO" ||
          usuario?.role === "ADMIN" ||
          usuario?.role === "GERENCIADOR") && (
          <div className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              🛒 Meu Carrinho
            </h2>

            {itensCarrinho.length === 0 ? (
              <p className="text-gray-500">Nenhuma peça cadastrada.</p>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Categoria
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                      Qtd
                    </th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {itensCarrinho.map((peca) => {
                    const pecaId = peca.id;
                    const quantidadeCarrinho = peca.quantidadeCarrinho || 0;
                    return (
                      <tr key={pecaId}>
                        <td className="px-4 py-2 font-semibold text-gray-800">
                          {peca.nome || "Peça desconhecida"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {peca.categoria || "-"}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {quantidadeCarrinho}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            className={`px-3 py-1 rounded text-xs font-semibold ${
                              quantidadeCarrinho > 0
                                ? "bg-red-500 hover:bg-red-600 text-white"
                                : "bg-gray-200 text-gray-500 cursor-not-allowed"
                            }`}
                            onClick={() => removerDoCarrinho(pecaId)}
                            disabled={quantidadeCarrinho === 0}
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Modal de Edição de Peça */}
      {showEditModal && pecaEditando && (
        <ModalEditarPeca
          peca={pecaEditando}
          onFechar={() => {
            setShowEditModal(false);
            setPecaEditando(null);
          }}
          onSalvar={handleSalvarEdicao}
        />
      )}

      <Footer />
    </>
  );
}

// Componente Modal de Edição
function ModalEditarPeca({ peca, onFechar, onSalvar }) {
  const [formData, setFormData] = useState({
    nome: peca.nome || '',
    categoria: peca.categoria || '',
    quantidade: peca.quantidade !== undefined && peca.quantidade !== null ? peca.quantidade : 0,
    descricao: peca.descricao || '',
    preco: peca.preco || '',
    ativo: peca.ativo !== false
  });

  console.log('📦 Peça sendo editada:', peca);
  console.log('📝 Estado inicial do formulário:', formData);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validar dados antes de enviar
    if (!formData.nome || !formData.categoria) {
      alert("❌ Nome e Categoria são obrigatórios!");
      return;
    }

    if (formData.quantidade < 0) {
      alert("❌ Quantidade não pode ser negativa!");
      return;
    }

    console.log('📋 Dados do formulário:', formData);
    onSalvar(formData);
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onFechar}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-linear-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            ✏️ Editar Peça
          </h2>
          <button
            onClick={onFechar}
            className="text-white hover:text-gray-200 text-3xl font-bold leading-none"
            title="Fechar"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            {/* Nome */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nome da Peça *
              </label>
              <input
                type="text"
                value={formData.nome}
                onChange={(e) => setFormData({...formData, nome: e.target.value})}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Rolamento 6203"
              />
            </div>

            {/* Categoria */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categoria *
              </label>
              <input
                type="text"
                value={formData.categoria}
                onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Ex: Rolamentos"
              />
            </div>

            {/* Quantidade e Preço */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantidade em Estoque *
                </label>
                <input
                  type="number"
                  value={formData.quantidade}
                  onChange={(e) => {
                    const valor = e.target.value === '' ? 0 : parseInt(e.target.value);
                    setFormData({...formData, quantidade: valor});
                  }}
                  min="0"
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center font-bold text-lg"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Preço Unitário (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(e) => setFormData({...formData, preco: e.target.value})}
                  min="0"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            {/* Descrição */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Descrição
              </label>
              <textarea
                value={formData.descricao}
                onChange={(e) => setFormData({...formData, descricao: e.target.value})}
                rows="3"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Descrição opcional da peça..."
              />
            </div>

            {/* Status Ativo */}
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <input
                type="checkbox"
                id="ativo"
                checked={formData.ativo}
                onChange={(e) => setFormData({...formData, ativo: e.target.checked})}
                className="w-5 h-5 rounded cursor-pointer"
              />
              <label htmlFor="ativo" className="cursor-pointer font-medium text-gray-700">
                ✅ Peça ativa no sistema
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t rounded-b-xl">
            <button
              type="button"
              onClick={onFechar}
              className="px-6 py-2 bg-gray-500 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              💾 Salvar Alterações
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
