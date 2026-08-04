import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer.jsx";
import { PageHeader, Badge } from "../components/UIComponents";
import { PageLoader, EmptyState } from "../components/Loading";

export function QuebraOrdemPage() {
  const navigate = useNavigate();
  const [quebrasOrdem, setQuebrasOrdem] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroLoja, setFiltroLoja] = useState("");
  const [filtroRoteiro, setFiltroRoteiro] = useState("");
  // Controle de ocultação agora é feito pelo campo status_justificativa no banco

  useEffect(() => {
    carregarQuebrasOrdem();
  }, []);

  const carregarQuebrasOrdem = async () => {
    try {
      setLoading(true);
      const [movRes, lojasRes, roteirosRes] = await Promise.all([
        api.get("/movimentacoes?apenasJustificativasNovas=true&limite=1000"),
        api.get("/lojas"),
        api.get("/roteiros"),
      ]);

      // Filtrar apenas justificativas de quebra de ordem com status 'nova'
      const movimentacoesComQuebra = movRes.data.filter(
        (mov) => mov.justificativa_ordem && mov.status_justificativa === "nova",
      );

      // Enriquecer dados com informações de loja e roteiro
      const quebrasEnriquecidas = movimentacoesComQuebra.map((mov) => {
        const loja = lojasRes.data.find((l) => l.id === mov.lojaId);
        const lojaEsperada = mov.lojaIdEsperada
          ? lojasRes.data.find((l) => l.id === mov.lojaIdEsperada)
          : null;

        // Encontrar o roteiro que contém esta loja
        const roteiro = roteirosRes.data.find((rot) =>
          rot.lojas?.some((l) => l.id === mov.lojaId),
        );

        return {
          ...mov,
          lojaNome: loja?.nome || "Ponto não encontrado",
          lojaEsperadaNome: lojaEsperada?.nome || null,
          roteiroNome: roteiro?.nome || "Sem roteiro",
          roteiroId: roteiro?.id || null,
        };
      });

      // Ordenar por data mais recente primeiro
      quebrasEnriquecidas.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );

      setQuebrasOrdem(quebrasEnriquecidas);
    } catch (error) {
      console.error("Erro ao carregar quebras de ordem:", error);
      setError(
        "Erro ao carregar dados: " +
          (error.response?.data?.error || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  // Filtrar quebras
  const quebrasFiltradas = quebrasOrdem.filter(
    (quebra) =>
      (!filtroLoja ||
        quebra.lojaNome?.toLowerCase().includes(filtroLoja.toLowerCase())) &&
      (!filtroRoteiro ||
        quebra.roteiroNome
          ?.toLowerCase()
          .includes(filtroRoteiro.toLowerCase())),
  );

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-background-light bg-pattern teddy-pattern">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Quebras de Ordem do Roteiro"
          subtitle="Histórico de pontos visitados fora da ordem estabelecida"
          icon="⚠️"
          action={{
            label: "← Voltar ao Dashboard",
            onClick: () => navigate("/"),
          }}
        />

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="stat-card bg-linear-to-br from-orange-500/10 to-orange-500/5">
            <div className="text-3xl mb-2">⚠️</div>
            <div className="text-2xl font-bold text-gray-900">
              {quebrasOrdem.length}
            </div>
            <div className="text-sm text-gray-600">Total de Quebras</div>
          </div>

          <div className="stat-card bg-linear-to-br from-blue-500/10 to-blue-500/5">
            <div className="text-3xl mb-2">🏪</div>
            <div className="text-2xl font-bold text-gray-900">
              {new Set(quebrasOrdem.map((q) => q.lojaId)).size}
            </div>
            <div className="text-sm text-gray-600">Pontos Diferentes</div>
          </div>

          <div className="stat-card bg-linear-to-br from-purple-500/10 to-purple-500/5">
            <div className="text-3xl mb-2">🗺️</div>
            <div className="text-2xl font-bold text-gray-900">
              {
                new Set(quebrasOrdem.map((q) => q.roteiroId).filter(Boolean))
                  .size
              }
            </div>
            <div className="text-sm text-gray-600">Roteiros Afetados</div>
          </div>
        </div>

        {/* Filtros */}
        <div className="card-gradient mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            🔍 Filtros
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Ponto
              </label>
              <input
                type="text"
                value={filtroLoja}
                onChange={(e) => setFiltroLoja(e.target.value)}
                placeholder="Digite o nome do ponto..."
                className="input-field w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Filtrar por Roteiro
              </label>
              <input
                type="text"
                value={filtroRoteiro}
                onChange={(e) => setFiltroRoteiro(e.target.value)}
                placeholder="Digite o nome do roteiro..."
                className="input-field w-full"
              />
            </div>
          </div>
          {(filtroLoja || filtroRoteiro) && (
            <button
              onClick={() => {
                setFiltroLoja("");
                setFiltroRoteiro("");
              }}
              className="mt-3 text-sm text-primary hover:text-primary-dark flex items-center gap-1"
            >
              ✕ Limpar filtros
            </button>
          )}
        </div>

        {/* Lista de Quebras */}
        <div className="card-gradient">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            📋 Histórico de Quebras ({quebrasFiltradas.length})
          </h3>

          {quebrasFiltradas.length > 0 ? (
            <div className="space-y-4">
              {quebrasFiltradas.map((quebra) => (
                <div
                  key={quebra.id}
                  className="p-4 sm:p-6 bg-white border-2 border-orange-200 rounded-lg hover:shadow-lg transition-shadow"
                >
                  {/* Cabeçalho */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">⚠️</span>
                        <h4 className="text-lg font-bold text-gray-900">
                          {quebra.lojaNome}
                        </h4>
                        <Badge variant="warning">Quebra de Ordem</Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        📅{" "}
                        {new Date(quebra.createdAt).toLocaleDateString("pt-BR")}{" "}
                        às{" "}
                        {new Date(quebra.createdAt).toLocaleTimeString(
                          "pt-BR",
                          { hour: "2-digit", minute: "2-digit" },
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Informações do Roteiro */}
                  <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm font-semibold text-blue-900 mb-1">
                      🗺️ Roteiro
                    </p>
                    <p className="text-blue-800">{quebra.roteiroNome}</p>
                  </div>

                  {/* Ordem - Ponto Esperado vs Ponto Visitado */}
                  <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-500 rounded-lg">
                    <p className="text-sm font-bold text-yellow-900 mb-3 flex items-center gap-2">
                      <span>🔄</span> Alteração de Ordem
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-start gap-2">
                        <span className="text-lg">❌</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-600">
                            Ponto Pulado (Esperado):
                          </p>
                          <p className="text-sm font-bold text-red-700">
                            {quebra.lojaEsperadaNome || "Não registrada"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <span className="text-lg">✅</span>
                        <div>
                          <p className="text-xs font-semibold text-gray-600">
                            Ponto Visitado:
                          </p>
                          <p className="text-sm font-bold text-green-700">
                            {quebra.lojaNome}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Justificativa */}
                  <div className="p-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-orange-900 mb-2">
                        📝 Justificativa do Funcionário:
                      </p>
                      <p className="text-gray-900 whitespace-pre-wrap">
                        {quebra.justificativa_ordem}
                      </p>
                    </div>
                    <button
                      className="ml-4 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      onClick={async () => {
                        try {
                          await api.patch(
                            `/movimentacoes/${quebra.id}/ocultar-justificativa`,
                          );
                          carregarQuebrasOrdem();
                        } catch (err) {
                          alert(
                            "Erro ao ocultar justificativa: " +
                              (err.response?.data?.error || err.message),
                          );
                        }
                      }}
                    >
                      OK
                    </button>
                  </div>

                  {/* Informações Adicionais */}
                  {quebra.observacoes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        <strong>Observações da movimentação:</strong>{" "}
                        {quebra.observacoes}
                      </p>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="mt-4 flex gap-2">
                    <button
                      onClick={() => navigate(`/lojas/${quebra.lojaId}`)}
                      className="btn-secondary text-sm"
                    >
                      Ver Ponto
                    </button>
                    {quebra.roteiroId && (
                      <button
                        onClick={() => navigate("/roteiros")}
                        className="btn-secondary text-sm"
                      >
                        Ver Roteiros
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="✅"
              title={
                filtroLoja || filtroRoteiro
                  ? "Nenhuma quebra encontrada"
                  : "Nenhuma quebra de ordem registrada"
              }
              message={
                filtroLoja || filtroRoteiro
                  ? "Não há quebras de ordem que correspondam aos filtros aplicados."
                  : "Ótimo! Todos os roteiros estão sendo seguidos corretamente."
              }
            />
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
}
