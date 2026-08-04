import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, Badge, AlertBox } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function EstoqueDepositoPrincipal() {
  const navigate = useNavigate();
  const [lojaDeposito, setLojaDeposito] = useState(null);
  const [estoque, setEstoque] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    try {
      setLoading(true);
      setError("");

      // Buscar todas as lojas
      const lojasResponse = await api.get("/lojas");
      const lojas = lojasResponse.data;

      // Encontrar a loja marcada como depósito principal
      const deposito = lojas.find((l) => l.isDepositoPrincipal === true);

      if (!deposito) {
        setError(
          "Nenhum ponto está configurado como Depósito Principal. Configure um ponto como depósito principal no banco de dados.",
        );
        setLoading(false);
        return;
      }

      setLojaDeposito(deposito);

      // Buscar estoque do depósito
      const estoqueResponse = await api.get(`/estoque-lojas/${deposito.id}`);
      const estoqueData = Array.isArray(estoqueResponse.data)
        ? estoqueResponse.data
        : [];

      setEstoque(estoqueData);
    } catch (err) {
      console.error("Erro ao carregar estoque do depósito:", err);
      setError(
        err.response?.data?.error ||
          "Erro ao carregar dados do depósito principal",
      );
    } finally {
      setLoading(false);
    }
  };

  const estoqueFiltrado = estoque.filter((item) => {
    if (!filtro.trim()) return true;

    const termo = filtro.toLowerCase();
    const nomeProduto = (item.produto?.nome || "").toLowerCase();
    const codigoProduto = (item.produto?.codigo || "").toLowerCase();

    return nomeProduto.includes(termo) || codigoProduto.includes(termo);
  });

  const estatisticas = {
    totalProdutos: estoqueFiltrado.length,
    totalUnidades: estoqueFiltrado.reduce(
      (sum, item) => sum + (item.quantidade || 0),
      0,
    ),
    estoqueBaixo: estoqueFiltrado.filter(
      (item) => (item.quantidade || 0) <= (item.estoqueMinimo || 0),
    ).length,
  };

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-linear-to-br from-[#62A1D9] via-[#A6806A] to-[#24094E] text-[#24094E]">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Estoque do Depósito Principal"
          subtitle={
            lojaDeposito
              ? `${lojaDeposito.nome} - ${lojaDeposito.cidade || ""}`
              : "Carregando..."
          }
          icon="🏭"
          action={
            lojaDeposito && (
              <button
                onClick={() => navigate(`/lojas/${lojaDeposito.id}`)}
                className="btn-secondary flex items-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                  />
                </svg>
                Ver Detalhes do Ponto
              </button>
            )
          }
        />

        {error && <AlertBox type="error" message={error} />}

        {lojaDeposito && (
          <>
            {/* Card com informações do depósito */}
            <div className="bg-linear-to-r from-orange-50 to-yellow-50 border-l-4 border-orange-500 rounded-lg p-6 mb-6 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  <span className="text-4xl">🏭</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">
                    Sobre o Depósito Principal
                  </h3>
                  <p className="text-sm text-gray-700 mb-2">
                    Este é o <strong>estoque central</strong> do sistema. Todo
                    estoque adicionado em outros pontos ou funcionários é
                    automaticamente descontado daqui.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                    <div>
                      <strong>Nome:</strong> {lojaDeposito.nome}
                    </div>
                    <div>
                      <strong>Cidade:</strong>{" "}
                      {lojaDeposito.cidade || "Não informada"}
                    </div>
                    {lojaDeposito.endereco && (
                      <div className="md:col-span-2">
                        <strong>Endereço:</strong> {lojaDeposito.endereco}
                        {lojaDeposito.numero && `, nº ${lojaDeposito.numero}`}
                        {lojaDeposito.bairro && ` - ${lojaDeposito.bairro}`}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Cards de estatísticas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total de Produtos
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {estatisticas.totalProdutos}
                    </p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3">
                    <span className="text-2xl">📦</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Total de Unidades
                    </p>
                    <p className="text-3xl font-bold text-gray-900 mt-2">
                      {estatisticas.totalUnidades}
                    </p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <span className="text-2xl">📊</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Estoque Baixo
                    </p>
                    <p className="text-3xl font-bold text-red-600 mt-2">
                      {estatisticas.estoqueBaixo}
                    </p>
                  </div>
                  <div className="bg-red-100 rounded-full p-3">
                    <span className="text-2xl">⚠️</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filtro de busca */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center gap-3">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar por nome ou código do produto..."
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  className="flex-1 outline-none text-gray-700 placeholder-gray-400"
                />
                {filtro && (
                  <button
                    onClick={() => setFiltro("")}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Tabela de estoque */}
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Produto
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Código
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Quantidade
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Estoque Mínimo
                      </th>
                      <th
                        scope="col"
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider"
                      >
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {estoqueFiltrado.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-12">
                          <EmptyState
                            icon="📦"
                            title={
                              filtro
                                ? "Nenhum produto encontrado"
                                : "Nenhum produto no depósito"
                            }
                            description={
                              filtro
                                ? "Tente ajustar os filtros de busca"
                                : "Adicione produtos ao depósito principal"
                            }
                          />
                        </td>
                      </tr>
                    ) : (
                      estoqueFiltrado.map((item) => {
                        const estoqueBaixo =
                          (item.quantidade || 0) <=
                          (item.estoqueMinimo || 0);

                        return (
                          <tr
                            key={item.id}
                            className={`hover:bg-gray-50 ${
                              estoqueBaixo ? "bg-red-50" : ""
                            }`}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">
                                  {item.produto?.emoji || "📦"}
                                </span>
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {item.produto?.nome || "Produto sem nome"}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-500">
                                {item.produto?.codigo || "-"}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-lg font-bold text-gray-900">
                                {item.quantidade || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <div className="text-sm text-gray-600">
                                {item.estoqueMinimo || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              {estoqueBaixo ? (
                                <Badge variant="danger">⚠️ Estoque Baixo</Badge>
                              ) : (
                                <Badge variant="success">✅ OK</Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}

export default EstoqueDepositoPrincipal;
