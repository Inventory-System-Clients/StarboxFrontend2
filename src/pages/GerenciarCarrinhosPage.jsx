import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext.jsx";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader } from "../components/UIComponents";
import { PageLoader } from "../components/Loading";

export default function GerenciarCarrinhosPage() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcionarioSelecionado, setFuncionarioSelecionado] = useState(null);
  const [carrinhoFuncionario, setCarrinhoFuncionario] = useState([]);
  const [pecasDisponiveis, setPecasDisponiveis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buscaFuncionario, setBuscaFuncionario] = useState("");
  const [buscaPeca, setBuscaPeca] = useState("");

  // Carregar funcionários ao montar o componente
  useEffect(() => {
    carregarFuncionarios();
    carregarPecas();
  }, []);

  // Carregar carrinho quando funcionário for selecionado
  useEffect(() => {
    if (funcionarioSelecionado) {
      carregarCarrinhoFuncionario(funcionarioSelecionado.id);
    }
  }, [funcionarioSelecionado]);

  const carregarFuncionarios = async () => {
    try {
      const response = await api.get("/usuarios/funcionarios");
      setFuncionarios(response.data || []);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar funcionários:", error);
      setLoading(false);
    }
  };

  const carregarPecas = async () => {
    try {
      const response = await api.get("/pecas");
      setPecasDisponiveis(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar peças:", error);
    }
  };

  const carregarCarrinhoFuncionario = async (funcionarioId) => {
    try {
      const response = await api.get(`/usuarios/${funcionarioId}/carrinho`);
      console.log("Dados do carrinho recebidos:", response.data);
      setCarrinhoFuncionario(response.data || []);
    } catch (error) {
      console.error("Erro ao carregar carrinho do funcionário:", error);
      setCarrinhoFuncionario([]);
    }
  };

  const adicionarPecaAoCarrinho = async (pecaId) => {
    if (!funcionarioSelecionado) {
      alert("Selecione um funcionário primeiro");
      return;
    }

    const peca = pecasDisponiveis.find((p) => p.id === pecaId);
    if (!peca || peca.quantidade === 0) {
      alert("Peça sem estoque disponível");
      return;
    }

    try {
      await api.post(`/usuarios/${funcionarioSelecionado.id}/carrinho`, {
        pecaId: String(pecaId),
        quantidade: 1,
      });

      // Atualizar lista de peças (decrementar estoque localmente)
      setPecasDisponiveis((prev) =>
        prev.map((p) =>
          p.id === pecaId ? { ...p, quantidade: p.quantidade - 1 } : p,
        ),
      );

      // Recarregar carrinho
      await carregarCarrinhoFuncionario(funcionarioSelecionado.id);
      alert("Peça adicionada ao carrinho do funcionário com sucesso!");
    } catch (error) {
      console.error("Erro ao adicionar peça ao carrinho:", error);
      alert(
        error.response?.data?.error || "Erro ao adicionar peça ao carrinho",
      );
    }
  };

  const removerPecaDoCarrinho = async (pecaId) => {
    if (!funcionarioSelecionado) return;

    if (
      !window.confirm(
        "Deseja realmente remover esta peça do carrinho? Ela será devolvida ao estoque.",
      )
    ) {
      return;
    }

    try {
      await api.delete(
        `/usuarios/${funcionarioSelecionado.id}/carrinho/${pecaId}`,
      );

      // Atualizar lista de peças (incrementar estoque localmente)
      const item = carrinhoFuncionario.find(
        (i) => i.pecaId === pecaId || i.Peca?.id === pecaId,
      );
      if (item) {
        setPecasDisponiveis((prev) =>
          prev.map((p) =>
            p.id === pecaId
              ? { ...p, quantidade: p.quantidade + (item.quantidade || 1) }
              : p,
          ),
        );
      }

      // Recarregar carrinho
      await carregarCarrinhoFuncionario(funcionarioSelecionado.id);
      alert("Peça removida e devolvida ao estoque!");
    } catch (error) {
      console.error("Erro ao remover peça do carrinho:", error);
      alert(error.response?.data?.error || "Erro ao remover peça do carrinho");
    }
  };

  const funcionariosFiltrados = funcionarios.filter(
    (f) =>
      f.nome?.toLowerCase().includes(buscaFuncionario.toLowerCase()) ||
      f.email?.toLowerCase().includes(buscaFuncionario.toLowerCase()),
  );

  const pecasFiltradas = pecasDisponiveis.filter(
    (p) =>
      p.nome?.toLowerCase().includes(buscaPeca.toLowerCase()) ||
      p.codigo?.toLowerCase().includes(buscaPeca.toLowerCase()),
  );

  const carrinhoPorPecaId = carrinhoFuncionario.reduce((acc, item) => {
    const pecaId = String(item.pecaId || item.Peca?.id || item.peca?.id || "");
    if (!pecaId) return acc;
    acc[pecaId] = (acc[pecaId] || 0) + Number(item.quantidade || 0);
    return acc;
  }, {});

  const pecasNoCarrinhoComZero = pecasDisponiveis.map((peca) => ({
    ...peca,
    quantidadeCarrinho: carrinhoPorPecaId[String(peca.id)] || 0,
  }));

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Gerenciar Carrinhos de Funcionários"
          subtitle="Adicione ou remova peças dos carrinhos dos funcionários"
          icon="🛒"
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de Funcionários */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="bg-blue-100 p-2 rounded mr-2">👥</span>
              Funcionários
            </h3>

            <div className="mb-4">
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                placeholder="Buscar funcionário..."
                value={buscaFuncionario}
                onChange={(e) => setBuscaFuncionario(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {funcionariosFiltrados.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Nenhum funcionário encontrado
                </p>
              ) : (
                funcionariosFiltrados.map((func) => (
                  <button
                    key={func.id}
                    onClick={() => setFuncionarioSelecionado(func)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      funcionarioSelecionado?.id === func.id
                        ? "bg-indigo-100 border-2 border-indigo-500"
                        : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                    }`}
                  >
                    <div className="font-semibold text-gray-800">
                      {func.nome}
                    </div>
                    <div className="text-xs text-gray-500">{func.email}</div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Carrinho do Funcionário Selecionado */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="bg-green-100 p-2 rounded mr-2">🛒</span>
              Carrinho
              {funcionarioSelecionado && (
                <span className="ml-2 text-sm font-normal text-gray-600">
                  - {funcionarioSelecionado.nome}
                </span>
              )}
            </h3>

            {!funcionarioSelecionado ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Selecione um funcionário para ver o carrinho
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pecasNoCarrinhoComZero.map((peca) => {
                  const quantidadeCarrinho = peca.quantidadeCarrinho || 0;
                  return (
                    <div
                      key={peca.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {peca.nome || `Peça ID: ${peca.id || "desconhecida"}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          Código: {peca.codigo || "N/A"}
                        </div>
                        <div className="text-xs text-gray-600 mt-1">
                          Quantidade: <strong>{quantidadeCarrinho}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => removerPecaDoCarrinho(peca.id)}
                        disabled={quantidadeCarrinho === 0}
                        className={`ml-2 px-3 py-1 rounded text-sm transition-colors ${
                          quantidadeCarrinho > 0
                            ? "bg-red-500 hover:bg-red-600 text-white"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        ❌
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Peças Disponíveis para Adicionar */}
          <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <span className="bg-purple-100 p-2 rounded mr-2">🔧</span>
              Peças Disponíveis
            </h3>

            <div className="mb-4">
              <input
                type="text"
                className="w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                placeholder="Buscar peça..."
                value={buscaPeca}
                onChange={(e) => setBuscaPeca(e.target.value)}
              />
            </div>

            {!funcionarioSelecionado ? (
              <p className="text-gray-500 text-sm text-center py-8">
                Selecione um funcionário para adicionar peças
              </p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {pecasFiltradas.length === 0 ? (
                  <p className="text-gray-500 text-sm">
                    Nenhuma peça disponível
                  </p>
                ) : (
                  pecasFiltradas.map((peca) => (
                    <div
                      key={peca.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">
                          {peca.nome}
                        </div>
                        <div className="text-xs text-gray-500">
                          Código: {peca.codigo}
                        </div>
                        <div
                          className={`text-xs mt-1 ${
                            peca.quantidade > 10
                              ? "text-green-600"
                              : peca.quantidade > 0
                                ? "text-yellow-600"
                                : "text-red-600"
                          }`}
                        >
                          Estoque: <strong>{peca.quantidade}</strong>
                        </div>
                      </div>
                      <button
                        onClick={() => adicionarPecaAoCarrinho(peca.id)}
                        disabled={peca.quantidade === 0}
                        className={`ml-2 px-3 py-1 rounded text-sm transition-colors ${
                          peca.quantidade === 0
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-green-500 hover:bg-green-600 text-white"
                        }`}
                      >
                        ➕
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resumo por Funcionário */}
        <div className="mt-8 bg-white rounded-lg shadow p-6 border border-gray-100">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <span className="bg-yellow-100 p-2 rounded mr-2">📊</span>
            Resumo de Carrinhos
          </h3>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Funcionário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Itens no Carrinho
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {funcionarios.map((func) => {
                  const totalItens = 0; // Precisaríamos buscar isso do backend
                  return (
                    <tr key={func.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {func.nome}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {func.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {funcionarioSelecionado?.id === func.id
                            ? carrinhoFuncionario.length
                            : "•••"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                        <button
                          onClick={() => navigate(`/carrinho/${func.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          Ver Carrinho
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
